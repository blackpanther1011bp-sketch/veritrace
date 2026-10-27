// Libellés et mises en forme de la provenance des données (mêmes textes que la web app).

const sourceLabel = {
  'demo': 'Données fictives (démo)',
  'marque': 'Transmises par la marque',
  'etiquette': "Relevées sur l'étiquette",
  'estimation': 'Estimation (valeurs par défaut)',
  'registre': 'Déclarées par la marque (registre officiel)',
};

const confidenceLabel = {'haute': 'Haute', 'moyenne': 'Moyenne', 'faible': 'Faible'};

const confidenceHelp = {
  'haute': 'Composition, poids et pays de fabrication fournis par la marque.',
  'moyenne': "Composition et pays de confection connus ; le reste suit les valeurs par défaut d'Ecobalyse.",
  'faible': "Peu d'informations connues : le calcul utilise surtout les valeurs par défaut d'Ecobalyse, "
      'volontairement pénalisantes.',
};

const _months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/// « 27 oct. 2026 » ; null si la date est absente ou illisible.
String? formatDateFr(String? value) {
  if (value == null) return null;
  final d = DateTime.tryParse(value)?.toLocal();
  if (d == null) return null;
  return '${d.day} ${_months[d.month - 1]} ${d.year}';
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
