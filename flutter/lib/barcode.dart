/// Outils pour les codes GTIN (EAN-8, UPC-A, EAN-13, GTIN-14).
String digitsOnly(String value) => value.replaceAll(RegExp(r'\D+'), '');

/// Vérifie la clé de contrôle.
bool isValidGtin(String code) {
  if (!RegExp(r'^(\d{8}|\d{12}|\d{13}|\d{14})$').hasMatch(code)) return false;
  final digits = code.split('').map(int.parse).toList();
  final check = digits.removeLast();
  var sum = 0;
  // en partant de la droite, poids 3 puis 1
  final reversed = digits.reversed.toList();
  for (var i = 0; i < reversed.length; i++) {
    sum += reversed[i] * (i % 2 == 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 == check;
}

/// Ramène un UPC-A (12 chiffres) à sa forme EAN-13, comme les fiches en base.
String normalizeGtin(String code) {
  final d = digitsOnly(code);
  return d.length == 12 ? '0$d' : d;
}

/// Affiche un EAN-13 lisiblement : 2 001000 000012
String formatEan(String code) =>
    code.length == 13 ? '${code[0]} ${code.substring(1, 7)} ${code.substring(7)}' : code;
