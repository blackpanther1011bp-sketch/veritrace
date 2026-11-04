import 'package:flutter/material.dart';
import 'package:veritrace_ar/veritrace_ar.dart';

import 'api.dart';
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

  /// Ouvre la RA 3D en plein écran ; au retour, ouvre la fiche touchée (ou l'écran « pas encore noté »).
  static Future<void> open(BuildContext context) async {
    Api.instance.track('ar3d_view');
    final r = await VeritraceAr.open(lookup: _lookup, onEvent: _event);
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
      content: Text(message ?? "La réalité augmentée 3D n'a pas pu s'ouvrir. Le scanner classique reste disponible."),
      behavior: SnackBarBehavior.floating,
      backgroundColor: VT.ink,
      duration: const Duration(seconds: 6),
    ));
  }
}
