// Interface en deux langues : français (par défaut) et arabe standard moderne pour le Maroc (de droite à gauche).
//
// Les textes français servent de clés : tr('Réessayer') renvoie le texte français, ou sa traduction quand
// l'arabe est choisi (dictionnaire l10n_ar.dart). Le test test/l10n_test.dart vérifie que chaque texte passé
// à tr() ou tn() dans lib/ a sa traduction arabe, avec les mêmes {valeurs}, et qu'aucune traduction n'est orpheline.
// Les données de la base (matières, pays, noms des vêtements) restent en français.

import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'l10n_ar.dart';

enum Lang { fr, ar }

class L10n {
  L10n._();

  static const _prefKey = 'vt_lang';

  /// Langue de l'interface : l'application entière est reconstruite quand elle change (main.dart).
  static final lang = ValueNotifier<Lang>(Lang.fr);

  static bool get isArabic => lang.value == Lang.ar;

  /// Premier lancement : langue du téléphone ; ensuite : le choix enregistré sur l'appareil.
  static Future<void> init() async {
    try {
      final saved = (await SharedPreferences.getInstance()).getString(_prefKey);
      if (saved == 'ar' || saved == 'fr') {
        lang.value = saved == 'ar' ? Lang.ar : Lang.fr;
        return;
      }
    } catch (_) {
      // stockage indisponible : langue du téléphone
    }
    final locales = PlatformDispatcher.instance.locales;
    lang.value = locales.isNotEmpty && locales.first.languageCode == 'ar' ? Lang.ar : Lang.fr;
  }

  static Future<void> set(Lang value) async {
    if (lang.value == value) return;
    lang.value = value;
    try {
      await (await SharedPreferences.getInstance()).setString(_prefKey, value.name);
    } catch (_) {
      // le choix vaut pour cette session
    }
  }
}

/// Isole un fragment (nom de marque, composition, code-barres, nombre) pour qu'il garde son propre sens de
/// lecture dans une phrase arabe : « 60 % coton, 40 % polyester » ne doit pas être mélangé.
String bidi(String value) => L10n.isArabic && value.isNotEmpty ? '\u2068$value\u2069' : value;

/// Texte de l'interface dans la langue choisie ; {nom} est remplacé par vars['nom'].
/// « texte|contexte » : même texte français, traductions différentes selon le contexte (le français affiche
/// « texte »).
String tr(String fr, [Map<String, Object?> vars = const {}]) {
  final bar = fr.indexOf('|');
  var out = L10n.isArabic ? (arStrings[fr] ?? fr) : fr;
  if (bar >= 0 && out == fr) out = fr.substring(0, bar);
  for (final e in vars.entries) {
    out = out.replaceAll('{${e.key}}', bidi('${e.value}'));
  }
  return out;
}

/// Singulier ou pluriel selon n (« 1 alternative », « 3 alternatives ») ; {n} est remplacé par n.
String tn(int n, String one, String other, [Map<String, Object?> vars = const {}]) =>
    tr(n == 1 ? one : other, {'n': n, ...vars});

/// Valeur française envoyée au serveur (catégorie, pays, objet du message) affichée dans la langue choisie.
String tv(String value) => L10n.isArabic ? (arValues[value] ?? value) : value;

/// Message d'erreur du serveur (en français) : traduit d'après son code dans l'interface arabe.
String serverMessage(String code, String message) => L10n.isArabic ? (arServer[code] ?? message) : message;

/// Texte de la base (en français) affiché seul : isolé en arabe pour garder son sens de lecture.
String db(String? value) => bidi(value ?? '');
