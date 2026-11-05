import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'models.dart';

/// Accès au catalogue, aux alternatives, aux signalements et aux événements d'usage.
class Api {
  Api._();
  static final instance = Api._();

  SupabaseClient get _db => Supabase.instance.client;

  /// Délai maximal d'un appel : sur un réseau de magasin faible, l'écran « Réessayer » plutôt qu'une attente sans fin.
  static const _timeout = Duration(seconds: 12);
  final _sessionId = const Uuid().v4();

  // Petit cache en mémoire : fiche → détails → alternatives sans nouvel appel réseau.
  final Map<String, Product?> _products = {};
  final Map<String, List<Product>> _alternatives = {};

  Product? cached(String ean) => _products[ean];

  Future<Product?> fetchProduct(String ean) async {
    if (_products.containsKey(ean)) return _products[ean];
    // Catalogue VeriTrace d'abord, puis registre officiel de l'affichage environnemental.
    final row = await _db.rpc('get_product', params: {'p_ean': ean}).timeout(_timeout);
    final product = row == null ? null : Product.fromJson(Map<String, dynamic>.from(row as Map));
    _products[ean] = product;
    return product;
  }

  Future<List<Product>> fetchAlternatives(String ean) async {
    final hit = _alternatives[ean];
    if (hit != null) return hit;
    final rows = (await _db.rpc('get_alternatives_json', params: {'p_ean': ean}).timeout(_timeout) as List?) ?? const [];
    final list = rows.map((r) => Product.fromJson(Map<String, dynamic>.from(r as Map))).toList();
    _alternatives[ean] = list;
    for (final p in list) {
      _products[p.ean] = p;
    }
    return list;
  }

  /// Étiquette photographiée : le texte lu sur le téléphone (et la photo, gardée pour vérification) est
  /// envoyé au serveur, qui en tire la composition et le pays puis calcule la note avec Ecobalyse.
  Future<Product> readLabel({
    required String text,
    required Uint8List photo,
    required String category,
    String? ean,
    String? brand,
  }) async {
    try {
      final res = await _db.functions.invoke('outils', body: {
        'action': 'lire_etiquette',
        'text': text.length > 4000 ? text.substring(0, 4000) : text,
        'image': 'data:image/jpeg;base64,${base64Encode(photo)}',
        'category': category,
        'ean': ean,
        'brand': (brand ?? '').trim().isEmpty ? null : brand!.trim(),
        'client': 'android',
      }).timeout(const Duration(seconds: 60));
      final data = Map<String, dynamic>.from(res.data as Map);
      final product = Product.fromJson(Map<String, dynamic>.from(data['product'] as Map));
      _products[product.ean] = product;
      _alternatives.remove(product.ean);
      return product;
    } on TimeoutException {
      throw const ServiceError('delai', 'Le calcul prend trop de temps : réessayez dans un instant.');
    } on FunctionException catch (e) {
      final d = e.details;
      if (d is Map && d['message'] is String) {
        throw ServiceError((d['error'] ?? 'serveur').toString(), d['message'] as String);
      }
      throw const ServiceError('serveur', 'Le service ne répond pas correctement : réessayez dans un instant.');
    }
  }

  Future<void> reportMissingProduct(String ean, String brand) async {
    final clean = brand.trim();
    await _db.from('product_reports').insert({
      'ean': ean,
      'brand': clean.isEmpty ? null : (clean.length > 80 ? clean.substring(0, 80) : clean),
    }).timeout(_timeout);
  }

  /// Dépose la photo d'étiquette (lecture réservée à l'équipe) et renvoie son nom.
  Future<String> uploadLabelPhoto(Uint8List jpeg) async {
    final name = '${const Uuid().v4()}.jpg';
    await _db.storage
        .from('etiquettes')
        .uploadBinary(name, jpeg, fileOptions: const FileOptions(contentType: 'image/jpeg', upsert: false));
    return name;
  }

  /// Enregistre un vêtement ajouté depuis l'app, « à vérifier » : rien n'est publié avant validation.
  Future<void> submitContribution({
    required String ean,
    required String brandName,
    required String name,
    required String category,
    required String composition,
    String? countryMaking,
    String? photoPath,
  }) async {
    String cut(String s, int max) => s.length > max ? s.substring(0, max) : s;
    final country = countryMaking?.trim() ?? '';
    await _db.from('product_submissions').insert({
      'ean': ean,
      'brand_name': cut(brandName.trim(), 80),
      'name': cut(name.trim(), 120),
      'category': category,
      'composition': cut(composition.trim(), 300),
      'country_making': country.isEmpty ? null : cut(country, 40),
      'photo_path': photoPath,
      'session_id': _sessionId,
    });
  }

  /// Enregistre un événement d'usage sans bloquer l'interface.
  void track(String event, {String? ean, Grade? grade}) {
    _db
        .from('events')
        .insert({'session_id': _sessionId, 'event': event, 'ean': ean, 'grade': grade?.name})
        .catchError((Object e) {
          debugPrint('Événement non enregistré : $e');
          return null;
        });
  }
}

/// Erreur expliquée par le serveur (message en français, prêt à afficher).
class ServiceError implements Exception {
  final String code;
  final String message;
  const ServiceError(this.code, this.message);

  @override
  String toString() => message;
}
