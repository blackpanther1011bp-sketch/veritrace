import 'package:flutter/material.dart';
import 'package:veritrace_ar/veritrace_ar.dart';

import 'api.dart';
import 'l10n.dart';
import 'navigation.dart';
import 'scanned_code.dart';
import 'screens/not_found_screen.dart';
import 'theme.dart';

/// Réalité augmentée native (Android, ARCore) : la note de chaque vêtement visé est posée en 3D sur son
/// code-barres et reste à sa place quand on se déplace. iPhone : pas encore disponible.
class NativeAr {
  NativeAr._();

  static ArAvailability? _availability;

  /// ARCore utilisable (ou installable) sur ce téléphone ?
  static Future<bool> available() async {
    final a = _availability ??= await VeritraceAr.availability();
    return a != ArAvailability.unsupported;
  }

  /// Fiche d'un code-barres lu par l'écran natif (affichée sur un panneau 3D).
  static Future<Map<String, Object?>> _lookup(String code) async {
    final ean = parseScannedCode(code)?.gtin;
    if (ean == null) return {'status': 'invalid'};
    Api.instance.track('scan', ean: ean);
    try {
      final p = await Api.instance.fetchProduct(ean);
      if (p == null) {
        Api.instance.track('not_found', ean: ean);
        return {'status': 'unknown', 'ean': ean};
      }
      return {
        'status': 'found',
        'ean': p.ean,
        'name': p.name,
        'brand': p.brand.name,
        'grade': p.globalGrade.name,
        'verdict': verdicts[p.globalGrade]!.$1,
        'carbon': p.carbonGrade.name,
        'social': p.socialGrade?.name,
        'category': p.category,
        'ecoCost': p.ecoCost,
        'climateKg': p.climateKg,
        'sample': p.isSample,
      };
    } catch (_) {
      return {'status': 'error', 'ean': ean};
    }
  }

  static void _event(String name, String code) {
    final ean = parseScannedCode(code)?.gtin ?? code;
    if (name == 'ar3d_place') {
      Api.instance.track('ar3d_place', ean: ean, grade: Api.instance.cached(ean)?.globalGrade);
    }
  }

  /// Textes de l'écran natif et des panneaux 3D, dans la langue de l'app (clés : packages/veritrace_ar,
  /// Texts.java ; les {valeurs} sont remplacées côté natif).
  static Map<String, String> _texts() => {
        'camera': tr("Caméra : la note des vêtements s'affiche en 3D sur leur code-barres"),
        'close': tr('Fermer la réalité augmentée'),
        'title': tr('Réalité augmentée 3D'),
        'starting': tr('Démarrage de la réalité augmentée…'),
        'unavailable': tr("La réalité augmentée 3D n'est pas disponible sur cet appareil."),
        'unsupported':
            tr("Ce téléphone n'est pas compatible avec la réalité augmentée 3D. Le scanner classique reste disponible."),
        'needServices':
            tr('La réalité augmentée 3D a besoin de « Services Google Play pour la RA » (gratuit, sur le Play Store).'),
        'installServices':
            tr('Installez ou mettez à jour « Services Google Play pour la RA » depuis le Play Store, puis réessayez.'),
        'updateApp': tr('Mettez à jour VeriTrace pour utiliser la réalité augmentée 3D.'),
        'startFailed': tr("La réalité augmentée 3D n'a pas pu démarrer sur ce téléphone."),
        'cameraBusy': tr('La caméra est occupée ou indisponible : réessayez dans un instant.'),
        'cameraPermission': tr("Autorisez l'accès à la caméra pour utiliser la réalité augmentée."),
        'cameraUnavailable': tr('Caméra indisponible : fermez puis rouvrez la réalité augmentée.'),
        'lowLight': tr("Pas assez de lumière : rapprochez-vous d'un éclairage."),
        'slower': tr('Bougez le téléphone plus lentement.'),
        'noFeatures': tr('Visez des vêtements ou des étiquettes, pas un mur uni.'),
        'moveToStart': tr('Bougez doucement le téléphone de gauche à droite pour démarrer.'),
        'aimBarcode': tr("Visez le code-barres d'un vêtement : sa note se pose dessus en 3D."),
        'tapToOpen': tr('Touchez une note pour ouvrir la fiche.'),
        'tapHint': tr('Touchez une note pour ouvrir la fiche. Tournez autour : elle reste en place.'),
        'crown': tr('Couronne : le mieux noté ici.'),
        'ratio': tr("{ratio} fois moins d'impact que le moins bon ({grade})"),
        'same': tr('Notes proches : tous notés {grade}'),
        'diff': tr('Note {best}, contre {worst} pour le moins bon'),
        'noBrand': tr('Marque non indiquée'),
        'sample': tr('fictif'),
        'garment': tr('Vêtement'),
        'searching': tr('Recherche…'),
        'code': tr('Code'),
        'newGarment': tr('Nouveau vêtement'),
        'noConnection': tr('Connexion impossible'),
        'bestHere': tr('Le mieux noté ici'),
        'grade': tr('Note {grade}'),
        'loadingSheet': tr('Recherche de la fiche…'),
        'notRated': tr('Pas encore noté'),
        'notLoaded': tr('Fiche non chargée'),
        'cost': tr('Coût environnemental'),
        'climate': tr('Climat'),
        'carbon': tr('Carbone'),
        'social': tr('Social'),
        'notEvaluated': tr('Non évalué'),
        'readLabel': tr('Lisez son étiquette pour obtenir sa note.'),
        'checkInternet': tr('Vérifiez la connexion Internet.'),
        'tapSheet': tr('Touchez pour la fiche'),
        'tapContinue': tr('Touchez pour continuer'),
        'tapRetry': tr('Touchez pour réessayer'),
        'pts': tr('pts'),
        'kg': tr('kg CO₂e'),
      };

  /// Ouvre la RA 3D en plein écran ; au retour, ouvre la fiche touchée (ou l'écran « pas encore noté »).
  static Future<void> open(BuildContext context) async {
    Api.instance.track('ar3d_view');
    final r = await VeritraceAr.open(lookup: _lookup, onEvent: _event, strings: _texts(), rtl: L10n.isArabic);
    if (!context.mounted) return;
    final ean = r.ean;
    switch (r.action) {
      case 'product':
        if (ean != null) await openProduct(context, ean, countScan: false);
      case 'unknown':
        if (ean != null) {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => NotFoundScreen(ean: ean)));
        }
      case 'unsupported':
        _availability = ArAvailability.unsupported;
        _message(context, r.message);
      case 'error':
        _message(context, r.message);
    }
  }

  static void _message(BuildContext context, String? message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message ?? tr("La réalité augmentée 3D n'a pas pu s'ouvrir. Le scanner classique reste disponible.")),
      behavior: SnackBarBehavior.floating,
      backgroundColor: VT.ink,
      duration: const Duration(seconds: 6),
    ));
  }
}
