import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/barcode.dart';

void main() {
  test('accepte les codes de la planche de test', () {
    expect(isValidGtin('2001000000012'), isTrue);
    expect(isValidGtin('2004000000044'), isTrue);
    expect(isValidGtin('2008000000035'), isTrue);
  });

  test('refuse une clé de contrôle fausse ou une longueur invalide', () {
    expect(isValidGtin('2001000000013'), isFalse);
    expect(isValidGtin('123'), isFalse);
  });

  test('ramène un UPC-A à 13 chiffres', () {
    expect(normalizeGtin('036000291452'), '0036000291452');
    expect(isValidGtin(normalizeGtin('036000291452')), isTrue);
  });

  test('formate un EAN-13 lisiblement', () {
    expect(formatEan('2001000000012'), '2 001000 000012');
  });
}
