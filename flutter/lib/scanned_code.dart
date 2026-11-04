// Interprétation d'un code scanné : code-barres classique, QR code GS1 Digital Link
// (…/01/<GTIN>…, format des futurs passeports numériques européens) ou QR code d'un passeport VeriTrace.
// Mêmes règles que la web app (web/src/lib/outils.ts).

import 'barcode.dart';

class ScannedCode {
  final String? gtin;
  final String? passportId;
  const ScannedCode.gtin(String this.gtin) : passportId = null;
  const ScannedCode.passport(String this.passportId) : gtin = null;
}

final _passportId = RegExp(r'^[0-9a-f]{12}$');

String? _gtinOf(String digits) {
  final d = digits.length == 14 && digits.startsWith('0') ? digits.substring(1) : digits;
  final g = normalizeGtin(d);
  return isValidGtin(g) ? g : null;
}

/// null si le code n'est ni un code-barres valide ni un QR code reconnu.
ScannedCode? parseScannedCode(String raw) {
  final value = raw.trim();
  if (RegExp(r'^\d{8,14}$').hasMatch(value)) {
    final g = _gtinOf(value);
    return g == null ? null : ScannedCode.gtin(g);
  }
  final uri = Uri.tryParse(value);
  if (uri == null || !uri.hasScheme) return null;
  final fromQuery = uri.queryParameters['passeport'];
  final fromHash = RegExp(r'^/passeport/([0-9a-f]{12})').firstMatch(uri.fragment)?.group(1);
  final passport = fromQuery ?? fromHash;
  if (passport != null && _passportId.hasMatch(passport)) return ScannedCode.passport(passport);
  final dl = RegExp(r'(?:^|/)01/(\d{8,14})(?:/|$)').firstMatch(uri.path);
  if (dl != null) {
    final g = _gtinOf(dl.group(1)!);
    if (g != null) return ScannedCode.gtin(g);
  }
  return null;
}
