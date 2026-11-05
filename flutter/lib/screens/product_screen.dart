import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../barcode.dart';
import '../config.dart';
import '../l10n.dart';
import '../models.dart';
import '../reliability.dart';
import '../social.dart';
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
    final checks = p.brand.socialChecks;
    if (p.socialGrade == null) {
      return isSourcedChecks(checks)
          ? tr('Évaluation incomplète : non notée')
          : tr('Non évaluée : aucune source publique vérifiable');
    }
    final score = socialScore(checks);
    if (score != null) {
      return tr('{points} points sur {max} · sources publiques', {'points': score.points, 'max': socialMaxPoints});
    }
    for (final c in checks) {
      if (c.status == 'non' || c.status == 'non_communique' || c.status == 'non_demontre') {
        return tr('{label} : {status}', {'label': c.label, 'status': statusLabel[c.status]!.toLowerCase()});
      }
    }
    for (final c in p.brand.socialChecks) {
      if (c.status == 'partiel') return tr('{label} : partielle', {'label': c.label});
    }
    return tr('Engagements sociaux vérifiés');
  }

  String _carbonSummary(Product p) {
    final sorted = [...p.carbonBreakdown]..sort((a, b) => b.share.compareTo(a.share));
    return sorted.isEmpty ? '' : db(sorted.first.detail);
  }

  void _openDetails(Product p, {String tab = 'carbone'}) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => DetailsScreen(product: p, initialTab: tab)));

  @override
  Widget build(BuildContext context) {
    final p = _product;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Résultat du scan')),
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
                    Text(db(p.brand.name.toUpperCase()),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: VT.muted2)),
                    Text(db(p.name), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    Text(
                        '${p.reference != null ? '${tr('Réf. {ref}', {'ref': p.reference})} · ' : ''}'
                        '${p.hasNoBarcode ? tr('Sans code-barres · étiquette lue') : tr('EAN {code}', {'code': formatEan(p.ean)})}',
                        style: const TextStyle(fontSize: 13, color: VT.muted2)),
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
                    Text(tr('NOTE VERITRACE'),
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            letterSpacing: L10n.isArabic ? 0 : 0.8,
                            color: VT.muted)),
                    Text(verdict.$1, style: const TextStyle(fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(verdict.$2, style: const TextStyle(fontSize: 15, color: VT.muted, height: 1.4)),
                    if (p.socialGrade == null) ...[
                      const SizedBox(height: 6),
                      Text(tr('Note environnement seule : note sociale non évaluée.'),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: VT.muted)),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        // Coût environnemental affiché avec la note (règles françaises du 1er octobre 2026)
        if (p.ecoCost != null) ...[
          const SizedBox(height: 14),
          CardBox(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(TextSpan(children: [
                  TextSpan(
                      text: formatPoints(p.ecoCost!),
                      style: const TextStyle(fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: FontWeight.w700)),
                  TextSpan(text: '  ${tr("points d'impact")}', style: const TextStyle(fontSize: 15, color: VT.muted)),
                ])),
                const SizedBox(height: 4),
                Text(
                  p.isRegistry
                      ? tr('Coût environnemental officiel, déclaré par la marque. La note VeriTrace le compare aux vêtements du même type.')
                      : tr('Coût environnemental estimé par VeriTrace avec Ecobalyse (non déclaré par la marque). La note VeriTrace le compare aux vêtements du même type.'),
                  style: const TextStyle(fontSize: 13, color: VT.muted2, height: 1.35),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 14),
        // Réalité augmentée ancrée : panneau 3D de la note posé dans la pièce (AR Quick Look sur iPhone,
        // WebXR sur Android), servi par le site et ouvert dans l'app
        Material(
          color: VT.ink,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () {
              Api.instance.track('ar3d_view', ean: p.ean, grade: p.globalGrade);
              launchUrl(Uri.parse('${AppConfig.siteUrl}/#/p/${p.ean}?ra=1'), mode: LaunchMode.inAppBrowserView);
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: VT.mint, borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.view_in_ar, color: VT.ink),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(tr('Voir en réalité augmentée'),
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                        Text(tr('Posez le panneau 3D de la note dans la pièce'),
                            style: const TextStyle(color: Color(0xFFA9B8AE), fontSize: 13)),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Color(0xFFA9B8AE)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _tile(tr('Carbone'), p.carbonGrade, _carbonSummary(p), () => _openDetails(p))),
            const SizedBox(width: 12),
            Expanded(
                child: _tile(tr('Social'), p.socialGrade, _socialSummary(p), () => _openDetails(p, tab: 'social'))),
          ],
        ),
        const SizedBox(height: 14),
        CardBox(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Column(
            children: [
              _info(tr('Pays de fabrication'), p.originCountry),
              const Divider(height: 1, color: VT.line),
              _info(tr('Composition'), p.composition),
              const Divider(height: 1, color: VT.line),
              _info(tr('Transport'), p.transport),
              const Divider(height: 1, color: VT.line),
              InkWell(
                onTap: () => _openDetails(p),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  child: Row(
                    children: [
                      Text(tr('Fiabilité des données'), style: const TextStyle(color: VT.muted, fontSize: 15)),
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
          Text(label, style: const TextStyle(color: VT.muted, fontSize: 15)),
          const SizedBox(width: 12),
          Expanded(
            // valeur de la base, en français : garde son sens de lecture, alignée en fin de ligne
            child: Text(db(value),
                textAlign: TextAlign.end, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
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
                child: Text(tn(n, 'Voir {n} alternative mieux notée', 'Voir {n} alternatives mieux notées')),
              ),
              const SizedBox(height: 10),
            ],
            OutlinedButton(onPressed: () => _openDetails(p), child: Text(tr('Comprendre la note'))),
          ],
        ),
      ),
    );
  }
}
