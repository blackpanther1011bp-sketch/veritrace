// Libellés et mises en forme de la provenance des données (mêmes textes que la web app).

import 'l10n.dart';

// Libellés traduits : relus à chaque accès, dans la langue choisie.
Map<String, String> get sourceLabel => {
      'demo': tr('Données fictives (démo)'),
      'marque': tr('Transmises par la marque'),
      'etiquette': tr("Relevées sur l'étiquette"),
      'estimation': tr('Estimation (valeurs par défaut)'),
      'registre': tr('Déclarées par la marque (registre officiel)'),
    };

// « Faible|fiabilité » : même mot français que le niveau d'impact, accord différent en arabe (voir tr()).
Map<String, String> get confidenceLabel =>
    {'haute': tr('Haute'), 'moyenne': tr('Moyenne'), 'faible': tr('Faible|fiabilité')};

Map<String, String> get confidenceHelp => {
      'haute': tr('Composition, poids et pays de fabrication fournis par la marque.'),
      'moyenne': tr("Composition et pays de confection connus ; le reste suit les valeurs par défaut d'Ecobalyse."),
      'faible': tr(
          "Peu d'informations connues : le calcul utilise surtout les valeurs par défaut d'Ecobalyse, volontairement pénalisantes."),
    };

const _months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/// Mois en arabe, appellations en usage au Maroc (comme le site) ; chiffres occidentaux.
const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];

/// « 27 oct. 2026 » (« 27 أكتوبر 2026 » en arabe) ; null si la date est absente ou illisible.
String? formatDateFr(String? value) {
  if (value == null) return null;
  final d = DateTime.tryParse(value)?.toLocal();
  if (d == null) return null;
  final months = L10n.isArabic ? monthsAr : _months;
  return '${d.day} ${months[d.month - 1]} ${d.year}';
}

/// Nombre à la française : espace fine pour les milliers, virgule décimale.
String? formatNumberFr(double? value, {int digits = 1}) {
  if (value == null || !value.isFinite) return null;
  final fixed = value.toStringAsFixed(digits);
  var parts = fixed.split('.');
  var intPart = parts[0];
  final negative = intPart.startsWith('-');
  if (negative) intPart = intPart.substring(1);
  final groups = <String>[];
  for (var i = intPart.length; i > 0; i -= 3) {
    groups.insert(0, intPart.substring(i - 3 < 0 ? 0 : i - 3, i));
  }
  var out = '${negative ? '-' : ''}${groups.join(' ')}';
  if (parts.length > 1) {
    final dec = parts[1].replaceFirst(RegExp(r'0+$'), '');
    if (dec.isNotEmpty) out = '$out,$dec';
  }
  return out;
}

/// Lien cliquable uniquement pour les adresses web.
bool isWebLink(String? value) => value != null && RegExp(r'^https?://', caseSensitive: false).hasMatch(value.trim());

/// Première lettre en majuscule (hypothèses du calcul).
String capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

/// 1 266 (espace fine insécable entre les milliers, comme sur le site).
String formatPoints(double value) {
  final digits = value.round().abs().toString();
  final out = StringBuffer(value.round() < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write('\u202F');
    out.write(digits[i]);
  }
  return out.toString();
}
