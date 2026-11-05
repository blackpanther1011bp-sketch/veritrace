// Note sociale sourcée (méthode v1, docs/methode-note-sociale.md) : même barème que la fonction SQL registry_social,
// pour expliquer la note à l'écran (« 4 points sur 5 »). Testé dans test/social_test.dart.

import 'models.dart';

const socialMaxPoints = 5;

/// Critères sourcés : tous portent une source (les données de démonstration n'en ont pas).
bool isSourcedChecks(List<SocialCheck> checks) => checks.isNotEmpty && checks.every((c) => c.isSourced);

/// Points d'un critère : usines et contrôle (oui 2, partiel 1), certification de l'entreprise (oui 1).
int socialPoints(SocialCheck check, int index) {
  final heavy = index < 2; // ordre fixe renvoyé par la base : usines, contrôle, entreprise
  if (check.status == 'oui') return heavy ? 2 : 1;
  if (check.status == 'partiel') return heavy ? 1 : 0;
  return 0;
}

/// Total et note d'après le barème ; null si les trois critères n'ont pas tous été vérifiés.
({int points, Grade grade})? socialScore(List<SocialCheck> checks) {
  if (checks.length != 3 || !isSourcedChecks(checks)) return null;
  var points = 0;
  for (var i = 0; i < checks.length; i++) {
    points += socialPoints(checks[i], i);
  }
  final grade = points >= 5
      ? Grade.A
      : points == 4
          ? Grade.B
          : points == 3
              ? Grade.C
              : points == 2
                  ? Grade.D
                  : Grade.E;
  return (points: points, grade: grade);
}

const _months = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/// « 2022-08 » → « août 2022 » ; « 2025-11-05 » → « 5 novembre 2025 » ; « 2019 » → « 2019 ».
String? formatPeriod(String? period) {
  if (period == null) return null;
  final m = RegExp(r'^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$').firstMatch(period);
  if (m == null) return null;
  final year = m.group(1)!;
  final month = m.group(2);
  if (month == null) return year;
  final i = int.parse(month) - 1;
  if (i < 0 || i > 11) return year;
  final day = m.group(3);
  return day == null ? '${_months[i]} $year' : '${int.parse(day)} ${_months[i]} $year';
}
