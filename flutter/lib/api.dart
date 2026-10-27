import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'models.dart';

/// Accès au catalogue, aux alternatives, aux signalements et aux événements d'usage.
class Api {
  Api._();
  static final instance = Api._();

  SupabaseClient get _db => Supabase.instance.client;
  final _sessionId = const Uuid().v4();

  // Petit cache en mémoire : fiche → détails → alternatives sans nouvel appel réseau.
  final Map<String, Product?> _products = {};
  final Map<String, List<Product>> _alternatives = {};

  Product? cached(String ean) => _products[ean];

  Future<Product?> fetchProduct(String ean) async {
    if (_products.containsKey(ean)) return _products[ean];
    // Catalogue VeriTrace d'abord, puis registre officiel de l'affichage environnemental.
    final row = await _db.rpc('get_product', params: {'p_ean': ean});
    final product = row == null ? null : Product.fromJson(Map<String, dynamic>.from(row as Map));
    _products[ean] = product;
    return product;
  }

  Future<List<Product>> fetchAlternatives(String ean) async {
    final hit = _alternatives[ean];
    if (hit != null) return hit;
    final rows = (await _db.rpc('get_alternatives_json', params: {'p_ean': ean}) as List?) ?? const [];
    final list = rows.map((r) => Product.fromJson(Map<String, dynamic>.from(r as Map))).toList();
    _alternatives[ean] = list;
    for (final p in list) {
      _products[p.ean] = p;
    }
    return list;
  }

  Future<void> reportMissingProduct(String ean, String brand) async {
    final clean = brand.trim();
    await _db.from('product_reports').insert({
      'ean': ean,
      'brand': clean.isEmpty ? null : (clean.length > 80 ? clean.substring(0, 80) : clean),
    });
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
