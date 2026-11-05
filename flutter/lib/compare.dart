import 'l10n.dart';
import 'models.dart';

/// Comparateur en rayon : classement des vêtements scannés pendant la visite, du mieux au moins bien noté
/// (même règle que le site web, `web/src/lib/compare.ts`).
class Comparison {
  final List<Product> ranked;
  final String summary;

  const Comparison(this.ranked, this.summary);

  Product get best => ranked.first;
  Product get worst => ranked.last;
}

String _norm(String s) => s.toLowerCase().trim();

String _fr(double v) {
  final rounded = (v * 10).round() / 10;
  final text = rounded == rounded.roundToDouble() ? rounded.toInt().toString() : rounded.toStringAsFixed(1);
  return text.replaceAll('.', ',');
}

/// Classe les vêtements (note, puis coût environnemental) ; null s'il y en a moins de deux.
Comparison? compareProducts(Iterable<Product> products) {
  final unique = <String, Product>{for (final p in products) p.ean: p}.values.toList();
  if (unique.length < 2) return null;
  double cost(Product p) => (p.ecoCost != null && p.ecoCost! > 0) ? p.ecoCost! : double.infinity;
  unique.sort((a, b) {
    final g = a.globalGrade.index.compareTo(b.globalGrade.index);
    if (g != 0) return g;
    final c = cost(a).compareTo(cost(b));
    if (c != 0) return c;
    return a.name.compareTo(b.name);
  });
  final best = unique.first;
  final worst = unique.last;
  final sameType = _norm(best.category) == _norm(worst.category);
  final muchLess = cost(best).isFinite && cost(worst).isFinite && cost(worst) > cost(best) * 1.15;
  final String summary;
  if (sameType && muchLess) {
    summary = tr("{ratio} fois moins d'impact que le moins bon ({grade})",
        {'ratio': _fr(cost(worst) / cost(best)), 'grade': worst.globalGrade.name});
  } else if (best.globalGrade == worst.globalGrade) {
    summary = tr('Notes proches : tous notés {grade}', {'grade': best.globalGrade.name});
  } else {
    summary = tr('Note {best}, contre {worst} pour le moins bon',
        {'best': best.globalGrade.name, 'worst': worst.globalGrade.name});
  }
  return Comparison(unique, summary);
}
