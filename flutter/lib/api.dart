import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'models.dart';

const _productFields =
    'ean,name,category,origin_country,composition,transport,carbon_grade,social_grade,global_grade,carbon_breakdown,is_sample,'
    'data_source,confidence,source_ref,source_date,env_grade,eco_cost,climate_kg,eco_web_url,assumptions,methodology,scored_at,'
    'brand:brands(id,name,kind,country,social_checks)';

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
    final row = await _db.from('products').select(_productFields).eq('ean', ean).maybeSingle();
    final product = row == null ? null : Product.fromJson(row);
    _products[ean] = product;
    return product;
  }

  Future<List<Product>> fetchAlternatives(String ean) async {
    final hit = _alternatives[ean];
    if (hit != null) return hit;
    final List<dynamic> rows = await _db.rpc('get_alternatives', params: {'p_ean': ean}).select(_productFields);
    final list = rows.map((r) => Product.fromJson(r as Map<String, dynamic>)).toList();
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
