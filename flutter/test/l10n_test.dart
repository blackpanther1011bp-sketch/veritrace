import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/contribute.dart';
import 'package:veritrace/l10n.dart';
import 'package:veritrace/l10n_ar.dart';
import 'package:veritrace/reliability.dart';

// Interface en arabe : chaque texte passé à tr() / tn() dans lib/ a sa traduction (mêmes {valeurs}),
// et le dictionnaire arabe ne garde pas de traduction orpheline.

final _sq = r"'(?:[^'\\\n]|\\.)*'";
final _dq = r'"(?:[^"\\\n]|\\.)*"';
final _lit = '$_sq|$_dq';
final _trCall = RegExp(r'\btr\(\s*(' + _lit + ')');
final _tnCall = RegExp(r'\btn\(\s*[^,()]+,\s*(' + _lit + r')\s*,\s*(' + _lit + ')');
final _interpolation = RegExp(r'(?<!\\)\$');
final _placeholder = RegExp(r'\{(\w+)\}');

String _unquote(String literal, String where) {
  final body = literal.substring(1, literal.length - 1);
  if (_interpolation.hasMatch(body)) {
    fail('$where : texte à traduire avec une interpolation (\$), utiliser {valeur} : $literal');
  }
  return body.replaceAllMapped(RegExp(r'\\(.)'), (m) => m[1] == 'n' ? '\n' : m[1]!);
}

/// Textes français passés à tr() et tn() dans lib/ (hors dictionnaire), avec le fichier où ils apparaissent.
Map<String, String> _usedKeys() {
  final keys = <String, String>{};
  final files = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart') && !f.path.endsWith('l10n_ar.dart'));
  for (final file in files) {
    final source = file.readAsStringSync();
    for (final m in _trCall.allMatches(source)) {
      keys.putIfAbsent(_unquote(m[1]!, file.path), () => file.path);
    }
    for (final m in _tnCall.allMatches(source)) {
      keys.putIfAbsent(_unquote(m[1]!, file.path), () => file.path);
      keys.putIfAbsent(_unquote(m[2]!, file.path), () => file.path);
    }
  }
  return keys;
}

Set<String> _placeholders(String s) => {for (final m in _placeholder.allMatches(s)) m[1]!};

void main() {
  tearDown(() => L10n.lang.value = Lang.fr);

  test('chaque texte de l\'interface a sa traduction arabe', () {
    final used = _usedKeys();
    expect(used.length, greaterThan(200), reason: 'extraction des textes : regex à revoir');
    final missing = [for (final e in used.entries) if (!arStrings.containsKey(e.key)) '${e.value} : ${e.key}'];
    expect(missing, isEmpty, reason: 'textes sans traduction arabe (lib/l10n_ar.dart)');
  });

  test('aucune traduction orpheline', () {
    final used = _usedKeys();
    expect([for (final k in arStrings.keys) if (!used.containsKey(k)) k], isEmpty);
  });

  test('mêmes {valeurs} en français et en arabe, aucune traduction vide', () {
    for (final e in arStrings.entries) {
      expect(e.value.trim(), isNotEmpty, reason: e.key);
      expect(_placeholders(e.value), _placeholders(e.key), reason: e.key);
    }
  });

  test('catégories et pays proposés affichables en arabe', () {
    for (final v in [...contributionCategories, ...contributionCountries]) {
      expect(arValues[v], isNotNull, reason: v);
    }
  });

  test('français par défaut, arabe sur demande', () {
    expect(L10n.lang.value, Lang.fr);
    expect(tr('Réessayer'), 'Réessayer');
    expect(tr('EAN {code}', {'code': '2 001000 000012'}), 'EAN 2 001000 000012');
    expect(tn(1, '{n} autre alternative', '{n} autres alternatives'), '1 autre alternative');
    expect(tn(3, '{n} autre alternative', '{n} autres alternatives'), '3 autres alternatives');
    expect(tr('Faible|fiabilité'), 'Faible');
    expect(tv('Maroc'), 'Maroc');
    expect(formatDateFr('2026-10-20'), '20 oct. 2026');

    L10n.lang.value = Lang.ar;
    expect(tr('Réessayer'), 'إعادة المحاولة');
    expect(tr('Faible|fiabilité'), 'ضعيفة');
    expect(tr('Faible'), 'ضعيف');
    // valeur insérée isolée : garde son sens de lecture dans la phrase arabe
    expect(tr('{n} pts', {'n': '1 266'}), '\u20681 266\u2069 نقطة');
    expect(tv('Maroc'), 'المغرب');
    expect(tv('Valeur inconnue'), 'Valeur inconnue');
    expect(serverMessage('illisible', 'Étiquette illisible'), arServer['illisible']);
    expect(serverMessage('code_inconnu', 'Message du serveur'), 'Message du serveur');
    expect(formatDateFr('2026-11-05'), '5 نونبر 2026');
    expect(db('60 % coton'), '\u206860 % coton\u2069');
  });
}
