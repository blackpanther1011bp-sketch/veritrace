import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/contribute.dart';

void main() {
  test('compositions acceptées', () {
    expect(checkComposition('60 % coton, 40 % polyester'), isNull);
    expect(checkComposition('95% coton 5% élasthanne'), isNull);
    expect(checkComposition('33,3 % coton, 66,7 % lin'), isNull);
    expect(checkComposition('Coton'), isNull);
  });

  test('compositions refusées avec un message clair', () {
    expect(checkComposition(''), contains("Recopiez"));
    expect(checkComposition('60 % coton, 30 % polyester'), 'Les pourcentages font 90 % au lieu de 100 %.');
    expect(checkComposition('60 coton 40 polyester'), contains('signe %'));
    expect(checkComposition('100 %'), contains('matières'));
  });

  test('listes proposées', () {
    expect(contributionCategories, contains('T-shirt'));
    expect(contributionCountries.first, 'Maroc');
  });
}
