import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/label_live.dart';

void main() {
  test('composition complète en plusieurs langues', () {
    final r = compositionInText('60% COTTON / COTON / ALGODÓN\n40% POLYESTER\nMADE IN MOROCCO');
    expect(r.complete, isTrue);
    expect(r.preview, '60 % cotton, 40 % polyester');
  });

  test("composition incomplète (image floue) : pas d'appel au serveur", () {
    final r = compositionInText('60% COTTON\n4O% POLY');
    expect(r.seen, isTrue);
    expect(r.complete, isFalse);
  });

  test('étiquette turque %100 PAMUK et matière avant le pourcentage', () {
    expect(compositionInText('%100 PAMUK\nMADE IN TURKEY').complete, isTrue);
    expect(compositionInText('Cotton 95%\nElastane 5%').complete, isTrue);
  });

  test('étiquette de prix sans composition', () {
    final r = compositionInText('BIM 39,95 DH -20% PROMO');
    expect(r.seen, isFalse);
    expect(r.complete, isFalse);
  });

  test('doublure lue seule : on attend le tissu principal', () {
    expect(compositionInText('SHELL / EXTERIOR\n5% COTTON\n5% ELASTANE\nLINING / DOUBLURE\n100% POLYESTER').complete, isFalse);
    final sharp = compositionInText('SHELL / EXTERIOR\n95% COTTON\n5% ELASTANE\nLINING / DOUBLURE\n100% POLYESTER');
    expect(sharp.complete, isTrue);
    expect(sharp.preview, '95 % cotton, 5 % elastane');
  });

  test('cadre autour des lignes de composition seulement', () {
    final box = labelBox([
      (text: 'RN 12345 CA 678', box: const Rect.fromLTRB(0, 0, 500, 20)),
      (text: '95% COTTON', box: const Rect.fromLTRB(40, 100, 300, 130)),
      (text: '5% ELASTANE', box: const Rect.fromLTRB(40, 140, 320, 170)),
      (text: 'MADE IN MOROCCO', box: const Rect.fromLTRB(30, 200, 360, 230)),
    ]);
    expect(box, const Rect.fromLTRB(30, 100, 360, 230));
    expect(labelBox([(text: 'WASH 30', box: const Rect.fromLTRB(0, 0, 1, 1))]), isNull);
  });
}
