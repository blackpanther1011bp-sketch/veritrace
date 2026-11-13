import 'package:flutter/material.dart';

import '../api.dart';
import '../l10n.dart';
import '../models.dart';
import '../navigation.dart';
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

  @override
  void initState() {
    super.initState();
    Api.instance.track('alternatives_view', ean: widget.product.ean, grade: widget.product.globalGrade);
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

  List<String> _tags(Product p) {
    final t = <String>[];
    final comp = p.composition.toLowerCase();
    if (p.brand.kind == 'seconde_main') t.add(tr('Seconde main'));
    if (comp.contains('bio')) t.add(tr('Coton bio'));
    if (comp.contains('recyclé')) t.add(tr('Fibres recyclées'));
    if (comp.contains('lin')) t.add(tr('Lin'));
    if (p.originCountry == 'Maroc' && p.brand.kind != 'seconde_main') t.add(tr('Fabriqué au Maroc'));
    return t.take(3).toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = _list;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Alternatives'))),
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
                        child: Text(
                            tr('Au lieu de : {name} · {brand}',
                                {'name': widget.product.name, 'brand': widget.product.brand.name}),
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (list.isEmpty)
                  CardBox(
                    padding: const EdgeInsets.all(28),
                    child: Text(tr('Déjà parmi les meilleurs : aucune alternative mieux notée dans cette catégorie.'),
                        textAlign: TextAlign.center, style: const TextStyle(color: VT.muted, fontSize: 15)),
                  )
                else ..._items(list),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
                  child: Text(tr('Scanner un autre article')),
                ),
              ],
            ),
    );
  }

  List<Widget> _items(List<Product> list) {
    // Toutes les alternatives mieux notées sont gratuites : ce qui informe n'est jamais payant.
    return [
      Text(tr('Même usage, meilleur impact.'), style: const TextStyle(fontSize: 15, color: VT.muted)),
      const SizedBox(height: 12),
      for (final p in list)
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
                      Text(db(p.name), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      Text(
                        '${db(p.brand.name)} · ${p.brand.kind == 'seconde_main' ? tr('Friperie solidaire') : p.isRegistry ? tr('Registre officiel') : tr('Fabriqué : {country}', {'country': p.originCountry})}',
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
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: VT.green)),
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
    ];
  }
}

