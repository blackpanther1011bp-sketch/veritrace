import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'models.dart';
import 'reliability.dart';
import 'theme.dart';
import 'widgets.dart';

const _confidenceStyle = {
  'haute': (Color(0xFF1F6B4A), Color(0xFFDDF2E5)),
  'moyenne': (Color(0xFF7A5B00), Color(0xFFFCF1CF)),
  'faible': (Color(0xFFA3361F), Color(0xFFFCE6E1)),
};

/// Pastille de fiabilité (ou « Démo » pour les produits fictifs).
class ConfidencePill extends StatelessWidget {
  final Product product;
  const ConfidencePill({super.key, required this.product});

  @override
  Widget build(BuildContext context) {
    final c = product.confidence;
    final demo = product.isDemo || c == null;
    final style = demo ? (VT.muted, VT.line) : _confidenceStyle[c]!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: style.$2, borderRadius: BorderRadius.circular(999)),
      child: Text(demo ? 'Démo' : (confidenceLabel[c] ?? c),
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: style.$1)),
    );
  }
}

/// Bloc « Sources et fiabilité » de l'onglet Carbone : méthode, chiffres, source, hypothèses.
class SourcesCard extends StatelessWidget {
  final Product product;
  const SourcesCard({super.key, required this.product});

  Future<void> _open(BuildContext context, String url) async {
    final ok = await launchUrl(Uri.parse(url.trim()), mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Impossible d'ouvrir le lien")));
    }
  }

  Widget _row(String label, Widget value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 13),
        child: Row(
          children: [
            Text(label, style: const TextStyle(color: VT.muted, fontSize: 14)),
            const SizedBox(width: 12),
            Expanded(child: Align(alignment: Alignment.centerRight, child: value)),
          ],
        ),
      );

  Widget _value(String text) =>
      Text(text, textAlign: TextAlign.right, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500));

  @override
  Widget build(BuildContext context) {
    final p = product;
    if (p.isDemo) {
      return const MethodNote(
        text: 'Produit fictif de démonstration : ses notes illustrent l\'application et ne décrivent aucun vêtement réel. '
            'Les produits réels sont calculés avec Ecobalyse, la méthode officielle française d\'affichage '
            'environnemental des vêtements.',
      );
    }

    final updated = formatDateFr(p.scoredAt);
    final sourceDate = formatDateFr(p.sourceDate);
    final cost = formatNumberFr(p.ecoCost, digits: 0);
    final climate = formatNumberFr(p.climateKg);
    final rows = <Widget>[
      _row('Méthode', _value('Ecobalyse (officielle, France)')),
      if (cost != null)
        _row(
          'Coût environnemental',
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _value('$cost points'),
              if (p.envGrade != null) ...[const SizedBox(width: 8), GradeBadge(grade: p.envGrade!, size: 24)],
            ],
          ),
        ),
      if (climate != null) _row('Impact climat', _value('$climate kg CO₂e')),
      _row('Données', _value(sourceLabel[p.dataSource] ?? p.dataSource)),
      _row('Fiabilité', ConfidencePill(product: p)),
      if (updated != null) _row('Calculé le', _value(updated)),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CardBox(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: 1, color: VT.line),
                rows[i],
              ],
            ],
          ),
        ),
        if (p.confidence != null) ...[
          const SizedBox(height: 10),
          Text(confidenceHelp[p.confidence] ?? '', style: const TextStyle(fontSize: 13, color: VT.muted2, height: 1.35)),
        ],
        if (p.assumptions.isNotEmpty) ...[
          const SizedBox(height: 14),
          MethodNote(text: 'Hypothèses du calcul :\n${p.assumptions.map((a) => '• ${capitalize(a)}').join('\n')}'),
        ],
        const SizedBox(height: 14),
        const Text(
          'Note environnement : coût Ecobalyse comparé à deux références du même type de vêtement. '
          'A, proche d\'un vêtement en coton bio fabriqué en France ; E, proche du « majorant par défaut » '
          'd\'Ecobalyse (fabrication inconnue).',
          style: TextStyle(fontSize: 13, color: VT.muted2, height: 1.35),
        ),
        if (p.ecoWebUrl != null) ...[
          const SizedBox(height: 14),
          OutlinedButton(onPressed: () => _open(context, p.ecoWebUrl!), child: const Text('Voir le calcul sur Ecobalyse')),
        ],
        if (isWebLink(p.sourceRef)) ...[
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => _open(context, p.sourceRef!),
            child: Text('Voir la source des données${sourceDate != null ? ' ($sourceDate)' : ''}'),
          ),
        ] else if (p.sourceRef != null) ...[
          const SizedBox(height: 10),
          Text('Source : ${p.sourceRef}${sourceDate != null ? ', $sourceDate' : ''}',
              style: const TextStyle(fontSize: 13, color: VT.muted2)),
        ],
      ],
    );
  }
}
