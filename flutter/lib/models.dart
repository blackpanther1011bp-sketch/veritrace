// Les notes s'écrivent en majuscules, comme dans la base et l'interface.
// ignore_for_file: constant_identifier_names
enum Grade { A, B, C, D, E }

Grade gradeFrom(String value) => Grade.values.firstWhere((g) => g.name == value);

class BreakdownItem {
  final String label;
  final String level; // faible | moyen | fort
  final String detail;
  final int share;

  BreakdownItem({required this.label, required this.level, required this.detail, required this.share});

  factory BreakdownItem.fromJson(Map<String, dynamic> j) => BreakdownItem(
        label: j['label'] as String,
        level: j['level'] as String,
        detail: j['detail'] as String,
        share: (j['share'] as num).toInt(),
      );
}

class SocialCheck {
  final String label;
  final String status; // oui | partiel | non | non_communique

  SocialCheck({required this.label, required this.status});

  factory SocialCheck.fromJson(Map<String, dynamic> j) =>
      SocialCheck(label: j['label'] as String, status: j['status'] as String);
}

class Brand {
  final String id;
  final String name;
  final String kind; // fast_fashion | responsable | seconde_main
  final String country;
  final List<SocialCheck> socialChecks;

  Brand({required this.id, required this.name, required this.kind, required this.country, required this.socialChecks});

  factory Brand.fromJson(Map<String, dynamic> j) => Brand(
        id: j['id'] as String,
        name: j['name'] as String,
        kind: j['kind'] as String,
        country: j['country'] as String,
        socialChecks: (j['social_checks'] as List).map((e) => SocialCheck.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class Product {
  final String ean;
  final String name;
  final String category;
  final String originCountry;
  final String composition;
  final String transport;
  final Grade carbonGrade;
  final Grade socialGrade;
  final Grade globalGrade;
  final List<BreakdownItem> carbonBreakdown;
  final bool isSample;
  final Brand brand;

  Product({
    required this.ean,
    required this.name,
    required this.category,
    required this.originCountry,
    required this.composition,
    required this.transport,
    required this.carbonGrade,
    required this.socialGrade,
    required this.globalGrade,
    required this.carbonBreakdown,
    required this.isSample,
    required this.brand,
  });

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        ean: j['ean'] as String,
        name: j['name'] as String,
        category: j['category'] as String,
        originCountry: j['origin_country'] as String,
        composition: j['composition'] as String,
        transport: j['transport'] as String,
        carbonGrade: gradeFrom(j['carbon_grade'] as String),
        socialGrade: gradeFrom(j['social_grade'] as String),
        globalGrade: gradeFrom(j['global_grade'] as String),
        carbonBreakdown:
            (j['carbon_breakdown'] as List).map((e) => BreakdownItem.fromJson(e as Map<String, dynamic>)).toList(),
        isSample: j['is_sample'] as bool? ?? true,
        brand: Brand.fromJson(j['brand'] as Map<String, dynamic>),
      );

  bool get isBadGrade => globalGrade == Grade.D || globalGrade == Grade.E;
}
