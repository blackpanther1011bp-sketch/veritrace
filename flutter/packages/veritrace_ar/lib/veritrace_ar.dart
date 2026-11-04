/// Réalité augmentée native de VeriTrace (Android, ARCore) : la note de chaque vêtement visé est posée en 3D
/// sur son code-barres et reste à sa place quand on se déplace.
///
/// iPhone : pas encore disponible ([VeritraceAr.availability] renvoie [ArAvailability.unsupported]).
library;

import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/services.dart';

/// Disponibilité d'ARCore sur le téléphone.
enum ArAvailability {
  /// prêt à l'emploi
  supported,

  /// compatible : « Services Google Play pour la RA » sera installé ou mis à jour à l'ouverture
  needsInstall,

  /// réponse incertaine (pas de réseau, vérification en cours) : on peut essayer
  unknown,

  /// téléphone non compatible (ou iPhone)
  unsupported,
}

/// Ce que l'utilisateur a fait dans la réalité augmentée.
class ArResult {
  /// `product` (fiche à ouvrir), `unknown` (code pas encore noté), `closed`, `unsupported` ou `error`
  final String action;
  final String? ean;

  /// message à afficher (erreur ou téléphone non compatible)
  final String? message;

  /// nombre de notes posées dans l'espace
  final int placed;

  const ArResult(this.action, {this.ean, this.message, this.placed = 0});
}

/// Fiche d'un code-barres pour un panneau 3D : `{status: found|unknown|invalid|error, ean, name, brand, grade,
/// verdict, carbon, social, category, ecoCost, climateKg, sample}`.
typedef ArLookup = Future<Map<String, Object?>> Function(String code);

/// Mesure d'usage envoyée par l'écran natif (ex. `ar3d_place` quand une note est posée).
typedef ArEvent = void Function(String name, String code);

class VeritraceAr {
  VeritraceAr._();

  static const _channel = MethodChannel('veritrace_ar');
  static ArLookup? _lookup;
  static ArEvent? _event;

  static Future<ArAvailability> availability() async {
    if (!Platform.isAndroid) return ArAvailability.unsupported;
    try {
      // La première réponse peut être « vérification en cours »
      for (var attempt = 0; attempt < 6; attempt++) {
        final status = await _channel.invokeMethod<String>('availability');
        switch (status) {
          case 'SUPPORTED_INSTALLED':
            return ArAvailability.supported;
          case 'SUPPORTED_NOT_INSTALLED':
          case 'SUPPORTED_APK_TOO_OLD':
            return ArAvailability.needsInstall;
          case 'UNSUPPORTED_DEVICE_NOT_CAPABLE':
            return ArAvailability.unsupported;
          case 'UNKNOWN_CHECKING':
            await Future<void>.delayed(const Duration(milliseconds: 300));
            continue;
          default:
            return ArAvailability.unknown;
        }
      }
      return ArAvailability.unknown;
    } on PlatformException {
      return ArAvailability.unsupported;
    } on MissingPluginException {
      return ArAvailability.unsupported;
    }
  }

  /// Ouvre la réalité augmentée en plein écran ; [lookup] fournit la fiche de chaque code-barres lu.
  static Future<ArResult> open({required ArLookup lookup, ArEvent? onEvent}) async {
    _lookup = lookup;
    _event = onEvent;
    _channel.setMethodCallHandler(_handle);
    try {
      final r = await _channel.invokeMapMethod<String, Object?>('open');
      if (r == null) return const ArResult('closed');
      return ArResult(
        (r['action'] as String?) ?? 'closed',
        ean: r['ean'] as String?,
        message: r['message'] as String?,
        placed: (r['placed'] as num?)?.toInt() ?? 0,
      );
    } on PlatformException catch (e) {
      return ArResult('error', message: e.message);
    } on MissingPluginException {
      return const ArResult('unsupported', message: "La réalité augmentée 3D n'est pas disponible sur cet appareil.");
    }
  }

  static Future<Object?> _handle(MethodCall call) async {
    switch (call.method) {
      case 'lookup':
        final lookup = _lookup;
        if (lookup == null) return {'status': 'error'};
        try {
          return await lookup(call.arguments as String);
        } catch (_) {
          return {'status': 'error'};
        }
      case 'event':
        final args = Map<Object?, Object?>.from(call.arguments as Map);
        final name = args['name'];
        final code = args['ean'];
        if (name is String && code is String) _event?.call(name, code);
        return null;
    }
    return null;
  }
}
