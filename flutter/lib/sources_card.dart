import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'config.dart';
import 'l10n.dart';
import 'models.dart';
import 'reliability.dart';
import 'theme.dart';
import 'widgets.dart';

const _confidenceStyle = {
  'haute': (Color(0xFF1F6B4A), Color(0xFFDDF2E5)),
  'moyenne': (Color(0xFF7A5B00), Color(0xFFFCF1CF)),
  'faible': (Color(0xFFA3361F), Color(0xFFFCE6E1)),
};

/// Pastille de fiabilité (« Coût officiel » pour le registre, « Démo » pour les produits fictifs).
class ConfidencePill extends StatelessWidget {
  final Product product;
  const ConfidencePill({super.key, required this.product});

  @override
  Widget build(BuildContext context) {
    final c = product.isRegistry ? 'haute' : product.confidence;
    final demo = product.isDemo || c == null;
    final style = demo ? (VT.muted, VT.line) : _confidenceStyle[c]!;
    final label = demo ? tr('Démo') : (product.isRegistry ? tr('Coût officiel') : (confidenceLabel[c] ?? c));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: style.$2, borderRadius: BorderRadius.circular(999)),
      child: Text(label,
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
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr("Impossible d'ouvrir le lien"))));
    }
  }

  Widget _row(String label, Widget value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 13),
        child: Row(
          children: [
            Text(label, style: const TextStyle(color: VT.muted, fontSize: 15)),
            const SizedBox(width: 12),
            Expanded(child: Align(alignment: AlignmentDirectional.centerEnd, child: value)),
          ],
        ),
      );

  Widget _value(String text) =>
      Text(text, textAlign: TextAlign.end, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500));

  @override
  Widget build(BuildContext context) {
    final p = product;
    if (p.isDemo) {
      return MethodNote(
        text: tr("Produit fictif de démonstration : ses notes illustrent l'application et ne décrivent aucun vêtement réel. Les produits réels sont calculés avec Ecobalyse, la méthode officielle française d'affichage environnemental des vêtements."),
      );
    }

    final registry = p.isRegistry;
    final updated = formatDateFr(p.scoredAt);
    final sourceDate = formatDateFr(p.sourceDate);
    final cost = formatNumberFr(p.ecoCost, digits: 0);
    final climate = formatNumberFr(p.climateKg);
    final rows = <Widget>[
      _row(tr('Méthode'), _value(registry ? tr('Ecobalyse, déclarée par la marque') : tr('Ecobalyse (officielle, France)'))),
      if (cost != null)
        _row(
          tr('Coût environnemental'),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _value(tr('{n} points', {'n': cost})),
              if (p.envGrade != null) ...[const SizedBox(width: 8), GradeBadge(grade: p.envGrade!, size: 24)],
            ],
          ),
        ),
      if (climate != null) _row(tr('Impact climat'), _value(tr('{n} kg CO₂e', {'n': climate}))),
      _row(tr('Données'), _value(sourceLabel[p.dataSource] ?? p.dataSource)),
      _row(tr('Fiabilité'), ConfidencePill(product: p)),
      if (updated != null) _row(registry ? tr('Déclaré le') : tr('Calculé le'), _value(updated)),
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
        if (registry) ...[
          const SizedBox(height: 10),
          Text(
            tr("Coût déclaré par la marque sur le portail officiel de l'affichage environnemental (ministère de la Transition écologique). Le registre ne publie pas la composition ni les pays de fabrication."),
            style: const TextStyle(fontSize: 13, color: VT.muted2, height: 1.35),
          ),
        ] else if (p.confidence != null) ...[
          const SizedBox(height: 10),
          Text(confidenceHelp[p.confidence] ?? '', style: const TextStyle(fontSize: 13, color: VT.muted2, height: 1.35)),
        ],
        if (p.assumptions.isNotEmpty) ...[
          const SizedBox(height: 14),
          MethodNote(text: '${tr('Hypothèses du calcul :')}\n${p.assumptions.map((a) => '• ${db(capitalize(a))}').join('\n')}'),
        ],
        const SizedBox(height: 14),
        Text(
          tr("Note environnement : coût Ecobalyse à poids égal, comparé aux vêtements du même type déclarés au registre officiel. A : parmi les 10 % les mieux placés ; E : parmi les 20 % les moins bien placés."),
          style: const TextStyle(fontSize: 13, color: VT.muted2, height: 1.35),
        ),
        if (p.passportId != null) ...[
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: () => _open(context, '${AppConfig.siteUrl}/passeport/${p.passportId}'),
            child: Text(tr('Voir le passeport numérique')),
          ),
        ],
        if (p.ecoWebUrl != null) ...[
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: () => _open(context, p.ecoWebUrl!),
            child: Text(registry ? tr('Voir la fiche officielle') : tr('Voir le calcul sur Ecobalyse')),
          ),
        ],
        if (registry) ...[
          // La fiche officielle tient lieu de source.
        ] else if (isWebLink(p.sourceRef)) ...[
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => _open(context, p.sourceRef!),
            child: Text(sourceDate != null
                ? tr('Voir la source des données ({date})', {'date': sourceDate})
                : tr('Voir la source des données')),
          ),
        ] else if (p.sourceRef != null) ...[
          const SizedBox(height: 10),
          Text(
              sourceDate != null
                  ? tr('Source : {source}, {date}', {'source': p.sourceRef, 'date': sourceDate})
                  : tr('Source : {source}', {'source': p.sourceRef}),
              style: const TextStyle(fontSize: 13, color: VT.muted2)),
        ],
      ],
    );
  }
}
