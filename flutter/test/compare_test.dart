import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/compare.dart';
import 'package:veritrace/models.dart';

Product _p(String ean, Grade grade, double? cost, {String category = 'T-shirt'}) => Product(
      ean: ean,
      name: 'Article $ean',
      category: category,
      originCountry: 'Maroc',
      composition: '100 % coton',
      transport: 'Non communiqué',
      carbonGrade: grade,
      socialGrade: null,
      globalGrade: grade,
      carbonBreakdown: const [],
      isSample: false,
      brand: Brand(id: 'x', name: 'Marque', kind: 'non_classee', country: '', socialChecks: const []),
      ecoCost: cost,
    );

void main() {
  test('moins de deux articles : pas de comparaison', () {
    expect(compareProducts([_p('1', Grade.B, 500)]), isNull);
    expect(compareProducts([_p('1', Grade.B, 500), _p('1', Grade.B, 500)]), isNull);
  });

  test('classement par note puis par coût environnemental', () {
    final c = compareProducts([_p('1', Grade.D, 1400), _p('2', Grade.B, 600), _p('3', Grade.B, 520), _p('4', Grade.E, 2100)])!;
    expect(c.ranked.map((p) => p.ean), ['3', '2', '1', '4']);
    expect(c.summary, "4 fois moins d'impact que le moins bon (E)");
  });

  test('types différents : comparaison par note', () {
    expect(compareProducts([_p('1', Grade.B, 600), _p('2', Grade.D, 2400, category: 'Manteau')])!.summary,
        'Note B, contre D pour le moins bon');
    expect(compareProducts([_p('1', Grade.D, 900), _p('2', Grade.D, 2000, category: 'Jean')])!.summary,
        'Notes proches : tous notés D');
  });

  test('même note mais nettement moins d\'impact', () {
    expect(compareProducts([_p('1', Grade.C, 800), _p('2', Grade.C, 1200)])!.summary,
        "1,5 fois moins d'impact que le moins bon (C)");
  });
}
