import 'package:flutter/material.dart';

import '../api.dart';
import '../config.dart';
import '../models.dart';
import '../navigation.dart';
import '../storage.dart';
import '../theme.dart';
import '../widgets.dart';

class AlternativesScreen extends StatefulWidget {
  final Product product;
  const AlternativesScreen({super.key, required this.product});

  @override
  State<AlternativesScreen> createState() => _AlternativesScreenState();
}

class _AlternativesScreenState extends State<AlternativesScreen> {
  List<Product>? _list;
  bool _failed = false;
  bool _premium = false;
  bool _justUnlocked = false;

  @override
  void initState() {
    super.initState();
    Api.instance.track('alternatives_view', ean: widget.product.ean, grade: widget.product.globalGrade);
    LocalStore.isPremium().then((v) {
      if (mounted) setState(() => _premium = v);
    });
    _load();
  }

  Future<void> _load() async {
    setState(() => _failed = false);
    try {
      final list = await Api.instance.fetchAlternatives(widget.product.ean);
      if (mounted) setState(() => _list = list);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _openPaywall() async {
    Api.instance.track('premium_view', ean: widget.product.ean);
    final start = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => const _PaywallSheet(),
    );
    if (start == true) {
      await LocalStore.setPremium(true);
      Api.instance.track('premium_start', ean: widget.product.ean);
      if (mounted) {
        setState(() {
          _premium = true;
          _justUnlocked = true;
        });
      }
    }
  }

  List<String> _tags(Product p) {
    final t = <String>[];
    final comp = p.composition.toLowerCase();
    if (p.brand.kind == 'seconde_main') t.add('Seconde main');
    if (comp.contains('bio')) t.add('Coton bio');
    if (comp.contains('recyclé')) t.add('Fibres recyclées');
    if (comp.contains('lin')) t.add('Lin');
    if (p.originCountry == 'Maroc' && p.brand.kind != 'seconde_main') t.add('Fabriqué au Maroc');
    return t.take(3).toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = _list;
    return Scaffold(
      appBar: AppBar(title: const Text('Alternatives')),
      body: list == null
          ? (_failed ? ErrorView(onRetry: _load) : const Center(child: CircularProgressIndicator()))
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: VT.line, borderRadius: BorderRadius.circular(14)),
                  child: Row(
                    children: [
                      GradeBadge(grade: widget.product.globalGrade, size: 28),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text('Au lieu de : ${widget.product.name} · ${widget.product.brand.name}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (list.isEmpty)
                  const CardBox(
                    padding: EdgeInsets.all(28),
                    child: Text('Déjà parmi les meilleurs : aucune alternative mieux notée dans cette catégorie.',
                        textAlign: TextAlign.center, style: TextStyle(color: VT.muted, fontSize: 15)),
                  )
                else ..._items(list),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
                  child: const Text('Scanner un autre article'),
                ),
              ],
            ),
    );
  }

  List<Widget> _items(List<Product> list) {
    final visible = _premium ? list : list.take(AppConfig.freeAlternatives).toList();
    final locked = _premium ? 0 : list.length - visible.length;
    return [
      const Text('Même usage, meilleur impact.', style: TextStyle(fontSize: 15, color: VT.muted)),
      const SizedBox(height: 12),
      for (final p in visible)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: CardBox(
            onTap: () => openProduct(context, p.ean, countScan: false),
            child: Row(
              children: [
                GradeBadge(grade: p.globalGrade),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      Text(
                        '${p.brand.name} · ${p.brand.kind == 'seconde_main' ? 'Friperie solidaire' : 'Fabriqué : ${p.originCountry}'}',
                        style: const TextStyle(fontSize: 13, color: VT.muted2),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final t in _tags(p))
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: VT.mintTint, borderRadius: BorderRadius.circular(999)),
                              child: Text(t,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: VT.green)),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: VT.muted2),
              ],
            ),
          ),
        ),
      if (_justUnlocked)
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: VT.mintTint, borderRadius: BorderRadius.circular(14)),
          child: const Row(
            children: [
              Icon(Icons.check, color: VT.green),
              SizedBox(width: 10),
              Text('Premium activé (simulation de démo)', style: TextStyle(color: VT.green, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      if (locked > 0)
        Container(
          margin: const EdgeInsets.only(top: 4),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: VT.ink, borderRadius: BorderRadius.circular(20)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.lock_outline, color: VT.mint),
                  const SizedBox(width: 10),
                  Text('$locked autre${locked > 1 ? 's' : ''} alternative${locked > 1 ? 's' : ''}',
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 12),
              const Text('Comparez toutes les options mieux notées, en ligne et près de chez vous.',
                  style: TextStyle(color: Color(0xFFC9D4CD), fontSize: 14, height: 1.45)),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _openPaywall,
                style: FilledButton.styleFrom(
                    backgroundColor: VT.mint, foregroundColor: VT.ink, minimumSize: const Size.fromHeight(48)),
                child: const Text('Débloquer avec Premium'),
              ),
            ],
          ),
        ),
    ];
  }
}

class _PaywallSheet extends StatelessWidget {
  const _PaywallSheet();

  @override
  Widget build(BuildContext context) {
    const benefits = [
      'Toutes les alternatives pour chaque article',
      'Historique complet de vos scans',
      'Alertes sur vos marques préférées',
    ];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('VeriTrace Premium', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            for (final b in benefits)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    const Icon(Icons.check, color: VT.green, size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Text(b, style: const TextStyle(fontSize: 15))),
                  ],
                ),
              ),
            const Text(AppConfig.premiumPriceLabel, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text("Commencer l'essai gratuit"),
            ),
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Plus tard')),
            const Text("Démo : aucun paiement n'est demandé.",
                textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: VT.muted2)),
          ],
        ),
      ),
    );
  }
}
