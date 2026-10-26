import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/models.dart';
import 'package:veritrace/reliability.dart';

Map<String, dynamic> _row(Map<String, dynamic> extra) => {
      'ean': '6111000000028',
      'name': 'T-shirt basique',
      'category': 'T-shirt',
      'origin_country': 'Bangladesh',
      'composition': '60 % coton, 40 % polyester',
      'transport': 'Non communiqué',
      'carbon_grade': 'E',
      'social_grade': 'E',
      'global_grade': 'E',
      'carbon_breakdown': [
        {'label': 'Matière première', 'level': 'fort', 'detail': 'Production des fibres : 41 %', 'share': 41},
      ],
      'is_sample': false,
      'brand': {'id': 'urbanline', 'name': 'Urbanline', 'kind': 'fast_fashion', 'country': 'Espagne', 'social_checks': []},
      ...extra,
    };

void main() {
  test('produit calculé avec Ecobalyse : provenance lue', () {
    final p = Product.fromJson(_row({
      'data_source': 'etiquette',
      'confidence': 'moyenne',
      'source_ref': null,
      'source_date': '2026-10-20',
      'env_grade': 'E',
      'eco_cost': 1714.6,
      'climate_kg': 6.8,
      'eco_web_url': 'https://ecobalyse.beta.gouv.fr/#/textile/simulator/ecs/x',
      'assumptions': ['pays de teinture inconnu : valeur par défaut Ecobalyse (pénalisante)'],
      'scored_at': '2026-10-27T09:12:00+00:00',
    }));
    expect(p.isDemo, isFalse);
    expect(p.confidence, 'moyenne');
    expect(p.envGrade, Grade.E);
    expect(p.ecoCost, 1714.6);
    expect(p.climateKg, 6.8);
    expect(p.assumptions, hasLength(1));
  });

  test('produit de démonstration (anciennes colonnes seulement)', () {
    final p = Product.fromJson(_row({'is_sample': true}));
    expect(p.isDemo, isTrue);
    expect(p.envGrade, isNull);
    expect(p.assumptions, isEmpty);
  });

  test('nombres et dates à la française', () {
    expect(formatNumberFr(1714.6, digits: 0), '1 715');
    expect(formatNumberFr(6.8), '6,8');
    expect(formatNumberFr(2.0), '2');
    expect(formatNumberFr(null), isNull);
    expect(formatDateFr('2026-10-20'), '20 oct. 2026');
    expect(formatDateFr('pas une date'), isNull);
  });

  test('liens et majuscules', () {
    expect(isWebLink('https://exemple.ma/fiche'), isTrue);
    expect(isWebLink('Fiche AGEC du 12/10'), isFalse);
    expect(capitalize('pays inconnu'), 'Pays inconnu');
  });
}
