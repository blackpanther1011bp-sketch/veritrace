import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../sources_card.dart';
import '../theme.dart';
import '../widgets.dart';
import 'alternatives_screen.dart';

class DetailsScreen extends StatefulWidget {
  final Product product;
  final String initialTab; // carbone | social
  const DetailsScreen({super.key, required this.product, this.initialTab = 'carbone'});

  @override
  State<DetailsScreen> createState() => _DetailsScreenState();
}

class _DetailsScreenState extends State<DetailsScreen> {
  late String _tab = widget.initialTab;

  @override
  void initState() {
    super.initState();
    Api.instance.track('details_view', ean: widget.product.ean, grade: widget.product.globalGrade);
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    return Scaffold(
      appBar: AppBar(title: const Text('Comprendre la note')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        children: [
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'carbone', label: Text('Carbone · ${p.carbonGrade.name}')),
              ButtonSegment(value: 'social', label: Text('Social · ${p.socialGrade.name}')),
            ],
            selected: {_tab},
            showSelectedIcon: false,
            onSelectionChanged: (s) => setState(() => _tab = s.first),
          ),
          const SizedBox(height: 16),
          if (_tab == 'carbone') ..._carbon(p) else ..._social(p),
        ],
      ),
      bottomNavigationBar: p.globalGrade == Grade.A
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                child: FilledButton(
                  onPressed: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => AlternativesScreen(product: p))),
                  child: const Text('Voir les alternatives'),
                ),
              ),
            ),
    );
  }

  List<Widget> _carbon(Product p) => [
        Text("D'où vient l'impact climat de ce vêtement${p.isDemo ? '' : ' (calcul Ecobalyse)'} :",
            style: const TextStyle(fontSize: 15, color: VT.muted)),
        const SizedBox(height: 14),
        CardBox(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
          child: Column(
            children: [
              for (final item in p.carbonBreakdown)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(item.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          const Spacer(),
                          Text(levelLabel[item.level] ?? item.level,
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: levelText[item.level])),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: item.share / 100,
                          minHeight: 8,
                          backgroundColor: VT.line,
                          color: levelColor[item.level],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(item.detail, style: const TextStyle(fontSize: 13, color: VT.muted2)),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SourcesCard(product: p),
      ];

  List<Widget> _social(Product p) => [
        Text('Engagements sociaux de la marque ${p.brand.name} :', style: const TextStyle(fontSize: 15, color: VT.muted)),
        const SizedBox(height: 14),
        CardBox(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Column(
            children: [
              for (final c in p.brand.socialChecks)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  child: Row(
                    children: [
                      Expanded(child: Text(c.label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: statusStyle[c.status]!.$2,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(statusLabel[c.status] ?? c.status,
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: statusStyle[c.status]!.$1)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        MethodNote(
          text: p.isDemo
              ? "Données d'exemple. Sources à intégrer avant lancement : rapports d'audit, déclarations des marques, "
                  'bases de données publiques.'
              : 'Note sociale attribuée par VeriTrace à partir des engagements publics de la marque '
                  '(audits, salaires, liste des usines).',
        ),
      ];
}
