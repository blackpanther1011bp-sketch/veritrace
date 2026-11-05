import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../config.dart';
import '../models.dart';
import '../social.dart';
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
              ButtonSegment(value: 'social', label: Text('Social · ${p.socialGrade?.name ?? '–'}')),
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
        Text(
            p.isRegistry
                ? "D'où vient le coût environnemental de ce vêtement (registre officiel) :"
                : "D'où vient l'impact climat de ce vêtement${p.isDemo ? '' : ' (calcul Ecobalyse)'} :",
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
                          Text(item.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          const Spacer(),
                          Text(levelLabel[item.level] ?? item.level,
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: levelText[item.level])),
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

  String _socialNote(Product p) {
    final checks = p.brand.socialChecks;
    if (p.socialGrade == null) {
      if (isSourcedChecks(checks)) {
        return "Évaluation incomplète : tous les critères n'ont pas encore été vérifiés, la note sociale n'est donc "
            "pas attribuée. La note globale reflète uniquement l'environnement.";
      }
      return 'Note sociale non évaluée : aucune source publique vérifiable pour cette marque. '
          "La note globale reflète donc uniquement l'environnement.";
    }
    if (!isSourcedChecks(checks)) {
      return "Données d'exemple, fictives et sans source : elles ne suivent pas la méthode de la note sociale sourcée.";
    }
    final score = socialScore(checks);
    final total = score == null ? 'barème' : '${score.points} points sur $socialMaxPoints';
    return "Note sociale VeriTrace : $total d'après les preuves publiques ci-dessus. Elle mesure ce que la marque "
        'rend public et vérifiable (usines, contrôles, certification), pas les conditions de travail dans chaque '
        'usine. « Non démontré » : aucune preuve trouvée par VeriTrace.';
  }

  Future<void> _open(String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Impossible d'ouvrir le lien")));
    }
  }

  Widget _pill(SocialCheck c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: (statusStyle[c.status] ?? statusStyle['non_communique']!).$2,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(statusLabel[c.status] ?? c.status,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: (statusStyle[c.status] ?? statusStyle['non_communique']!).$1)),
      );

  /// Un critère sourcé : statut, détail, source cliquable, date du document et date de vérification.
  Widget _sourcedCheck(SocialCheck c) {
    final period = formatPeriod(c.sourcePeriod);
    final checked = formatPeriod(c.checkedAt);
    final dates = [if (period != null) period, if (checked != null) 'vérifié le $checked'].join(' · ');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(c.label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500))),
              const SizedBox(width: 8),
              _pill(c),
            ],
          ),
          if (c.detail != null) ...[
            const SizedBox(height: 6),
            Text(c.detail!, style: const TextStyle(fontSize: 13, color: VT.muted2, height: 1.35)),
          ],
          const SizedBox(height: 4),
          Semantics(
            link: true,
            child: InkWell(
              onTap: () => _open(c.sourceUrl!),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Text.rich(
                  TextSpan(children: [
                    const TextSpan(text: 'Source : '),
                    TextSpan(
                      text: c.sourceTitle ?? 'voir la source',
                      style: const TextStyle(color: VT.green, fontWeight: FontWeight.w500, decoration: TextDecoration.underline),
                    ),
                    if (dates.isNotEmpty) TextSpan(text: ' ($dates)'),
                  ]),
                  style: const TextStyle(fontSize: 13, color: VT.muted2, height: 1.35),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _social(Product p) {
    final checks = p.brand.socialChecks;
    final sourced = isSourcedChecks(checks);
    return [
      Text('Engagements sociaux de la marque ${p.brand.name} :', style: const TextStyle(fontSize: 15, color: VT.muted)),
      const SizedBox(height: 14),
      if (checks.isNotEmpty) ...[
        CardBox(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Column(
            children: [
              for (final c in checks)
                if (sourced)
                  _sourcedCheck(c)
                else
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    child: Row(
                      children: [
                        Expanded(child: Text(c.label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500))),
                        _pill(c),
                      ],
                    ),
                  ),
            ],
          ),
        ),
        const SizedBox(height: 14),
      ],
      MethodNote(text: _socialNote(p)),
      if (!p.isDemo)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => _open('${AppConfig.siteUrl}/#/confidentialite?contact=1'),
            child: const Text('Une preuve manque ? Écrivez-nous'),
          ),
        ),
    ];
  }
}
