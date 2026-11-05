import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/models.dart';
import 'package:veritrace/social.dart';

SocialCheck _check(String status, {bool sourced = true}) => SocialCheck(
      label: 'critère',
      status: status,
      detail: 'détail',
      sourceUrl: sourced ? 'https://exemple.org/preuve' : null,
      sourceTitle: sourced ? 'Preuve' : null,
      checkedAt: sourced ? '2026-11-05' : null,
    );

void main() {
  test("barème : usines et contrôle valent 2, la certification de l'entreprise 1", () {
    expect(socialScore([_check('oui'), _check('oui'), _check('oui')]), (points: 5, grade: Grade.A));
    expect(socialScore([_check('oui'), _check('oui'), _check('non_demontre')]), (points: 4, grade: Grade.B));
    expect(socialScore([_check('partiel'), _check('oui'), _check('non_demontre')]), (points: 3, grade: Grade.C));
    expect(socialScore([_check('partiel'), _check('non_demontre'), _check('oui')]), (points: 2, grade: Grade.D));
    expect(socialScore([_check('non_demontre'), _check('non_demontre'), _check('oui')]), (points: 1, grade: Grade.E));
  });

  test('pas de source, pas de note', () {
    expect(socialScore([]), isNull);
    expect(socialScore([_check('oui'), _check('oui')]), isNull);
    expect(socialScore([_check('oui', sourced: false), _check('oui', sourced: false), _check('oui', sourced: false)]), isNull);
  });

  test('lecture JSON des critères sourcés', () {
    final c = SocialCheck.fromJson({
      'label': 'Liste des usines publiée',
      'status': 'oui',
      'detail': 'Fournisseurs publiés',
      'source_url': 'https://www.fairwear.org/brands/armedangels/',
      'source_title': 'Fair Wear',
      'source_period': '2026-09',
      'checked_at': '2026-11-05',
    });
    expect(c.isSourced, isTrue);
    expect(c.sourcePeriod, '2026-09');
    final demo = SocialCheck.fromJson({'label': 'Audit', 'status': 'oui'});
    expect(demo.isSourced, isFalse);
  });

  test('dates des sources en français', () {
    expect(formatPeriod('2022-08'), 'août 2022');
    expect(formatPeriod('2025-11-05'), '5 novembre 2025');
    expect(formatPeriod('2019'), '2019');
    expect(formatPeriod(null), isNull);
  });
}
