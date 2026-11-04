import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/scanned_code.dart';

void main() {
  test('code-barres classique', () {
    expect(parseScannedCode('3609088774178')?.gtin, '3609088774178');
    expect(parseScannedCode('3609088774179'), isNull); // clé de contrôle fausse
    expect(parseScannedCode('03609088774178')?.gtin, '3609088774178'); // GTIN-14
  });

  test('QR code GS1 Digital Link', () {
    expect(parseScannedCode('https://id.gs1.org/01/03609088774178/10/LOT12')?.gtin, '3609088774178');
    expect(parseScannedCode('https://marque.example/01/3609088774178?x=1')?.gtin, '3609088774178');
    expect(parseScannedCode('https://marque.example/produit/42'), isNull);
  });

  test('QR code d’un passeport VeriTrace', () {
    expect(parseScannedCode('https://veritrace-wine.vercel.app/01/06111234567871?passeport=a1b2c3d4e5f6')?.passportId, 'a1b2c3d4e5f6');
    expect(parseScannedCode('https://veritrace-wine.vercel.app/#/passeport/a1b2c3d4e5f6')?.passportId, 'a1b2c3d4e5f6');
    expect(parseScannedCode('texte quelconque'), isNull);
  });
}
