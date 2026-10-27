import 'package:flutter/material.dart';

import '../api.dart';
import '../barcode.dart';
import '../models.dart';
import '../sources_card.dart';
import '../storage.dart';
import '../theme.dart';
import '../widgets.dart';
import 'alternatives_screen.dart';
import 'details_screen.dart';
import 'not_found_screen.dart';

// Une vue de fiche n'est comptée qu'une fois par session.
final _viewedThisSession = <String>{};

class ProductScreen extends StatefulWidget {
  final String ean;
  const ProductScreen({super.key, required this.ean});

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> with WidgetsBindingObserver {
  Product? _product;
  bool _failed = false;
  int? _altCount;
  bool _exitSent = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _product = Api.instance.cached(widget.ean);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Mesure d'abandon : l'utilisateur quitte l'app sur un vêtement mal noté.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final p = _product;
    if (state == AppLifecycleState.paused && p != null && p.isBadGrade && !_exitSent) {
      _exitSent = true;
      Api.instance.track('exit_after_bad_grade', ean: p.ean, grade: p.globalGrade);
    }
  }

  Future<void> _load() async {
    setState(() => _failed = false);
    try {
      final p = await Api.instance.fetchProduct(widget.ean);
      if (!mounted) return;
      if (p == null) {
        Api.instance.track('not_found', ean: widget.ean);
        await LocalStore.addToHistory(HistoryEntry(ean: widget.ean, at: DateTime.now()));
        if (!mounted) return;
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => NotFoundScreen(ean: widget.ean)));
        return;
      }
      setState(() => _product = p);
      if (_viewedThisSession.add(p.ean)) {
        Api.instance.track('product_view', ean: p.ean, grade: p.globalGrade);
      }
      LocalStore.addToHistory(
          HistoryEntry(ean: p.ean, name: p.name, brand: p.brand.name, grade: p.globalGrade, at: DateTime.now()));
      final alts = await Api.instance.fetchAlternatives(p.ean);
      if (mounted) setState(() => _altCount = alts.length);
    } catch (_) {
      if (mounted && _product == null) setState(() => _failed = true);
    }
  }

  String _socialSummary(Product p) {
    if (p.socialGrade == null) return 'Pas encore évaluée pour cette marque';
    for (final c in p.brand.socialChecks) {
      if (c.status == 'non' || c.status == 'non_communique') {
        return '${c.label} : ${statusLabel[c.status]!.toLowerCase()}';
      }
    }
    for (final c in p.brand.socialChecks) {
      if (c.status == 'partiel') return '${c.label} : partielle';
    }
    return 'Engagements sociaux vérifiés';
  }

  String _carbonSummary(Product p) {
    final sorted = [...p.carbonBreakdown]..sort((a, b) => b.share.compareTo(a.share));
    return sorted.isEmpty ? '' : sorted.first.detail;
  }

  void _openDetails(Product p, {String tab = 'carbone'}) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => DetailsScreen(product: p, initialTab: tab)));

  @override
  Widget build(BuildContext context) {
    final p = _product;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Résultat du scan'),
        actions: [if (p != null && p.isSample) const SampleTag()],
      ),
      body: p == null
          ? (_failed ? ErrorView(onRetry: _load) : const Center(child: CircularProgressIndicator()))
          : _content(p),
      bottomNavigationBar: p == null ? null : _actions(p),
    );
  }

  Widget _content(Product p) {
    final verdict = verdicts[p.globalGrade]!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      children: [
        CardBox(
          child: Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(color: const Color(0xFFE8ECE7), borderRadius: BorderRadius.circular(14)),
                child: const Icon(Icons.checkroom, color: VT.green, size: 34),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.brand.name.toUpperCase(),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: VT.muted2)),
                    Text(p.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    Text('EAN ${formatEan(p.ean)}', style: const TextStyle(fontSize: 13, color: VT.muted2)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        CardBox(
          color: gradeTint[p.globalGrade]!,
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              GradeBadge(grade: p.globalGrade, size: 64, round: true),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(verdict.$1, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(verdict.$2, style: const TextStyle(fontSize: 14, color: VT.muted, height: 1.4)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _tile('Carbone', p.carbonGrade, _carbonSummary(p), () => _openDetails(p))),
            const SizedBox(width: 12),
            Expanded(child: _tile('Social', p.socialGrade, _socialSummary(p), () => _openDetails(p, tab: 'social'))),
          ],
        ),
        const SizedBox(height: 14),
        CardBox(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Column(
            children: [
              _info('Pays de fabrication', p.originCountry),
              const Divider(height: 1, color: VT.line),
              _info('Composition', p.composition),
              const Divider(height: 1, color: VT.line),
              _info('Transport', p.transport),
              const Divider(height: 1, color: VT.line),
              InkWell(
                onTap: () => _openDetails(p),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  child: Row(
                    children: [
                      const Text('Fiabilité des données', style: TextStyle(color: VT.muted, fontSize: 14)),
                      const Spacer(),
                      ConfidencePill(product: p),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _tile(String title, Grade? grade, String summary, VoidCallback onTap) {
    return CardBox(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const Spacer(),
              GradeBadge(grade: grade, size: 32),
            ],
          ),
          const SizedBox(height: 12),
          GradeScale(grade: grade),
          const SizedBox(height: 12),
          Text(summary, style: const TextStyle(fontSize: 13, color: VT.muted2, height: 1.35)),
        ],
      ),
    );
  }

  Widget _info(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 13),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: VT.muted, fontSize: 14)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(value,
                textAlign: TextAlign.right, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  Widget _actions(Product p) {
    final n = _altCount ?? 0;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (n > 0) ...[
              FilledButton(
                onPressed: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => AlternativesScreen(product: p))),
                child: Text('Voir $n alternative${n > 1 ? 's' : ''} mieux notée${n > 1 ? 's' : ''}'),
              ),
              const SizedBox(height: 10),
            ],
            OutlinedButton(onPressed: () => _openDetails(p), child: const Text('Comprendre la note')),
          ],
        ),
      ),
    );
  }
}
