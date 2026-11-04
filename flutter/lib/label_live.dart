import 'dart:math' as math;
import 'dart:ui';

/// Lecture de l'étiquette en direct dans la caméra : contrôles faits sur le téléphone, image après image
/// (même règles que le site web, `web/src/lib/labelLive.ts`).
///  - [compositionInText] : la composition du tissu principal est-elle complète (un bloc de 100 %) ?
///    Tant que ce n'est pas le cas, on n'appelle pas le serveur.
///  - [labelBox] : où se trouve l'étiquette dans l'image, pour y accrocher la note.

final _material = RegExp(
  r'\b(cot+on|coton|algodon|cotone|baumwolle|katoen|algodao|pamuk|bawelna|polyest\w*|poliest\w*|elast\w*|spandex|lycra|'
  r'viscos\w*|viskos\w*|viskoz|rayon\w*|modal|lyocell|tencel|linen|lin|lino|leinen|linho|keten|wool|laine|lana|wolle|yun|'
  r'merino\w*|acryl\w*|acril\w*|akrilik|polyamid\w*|poliamid\w*|poliammid\w*|nylon|naylon|hemp|chanvre|jute|polypropyl\w*|'
  r'silk|soie|seda|seta|seide|cashmere|cachemire|leather|cuir)\b',
);
final _lining = RegExp(r'\b(lining|doublure|forro|fodera|futter|voering|astar)\b');
final _main = RegExp(r'\b(shell|outer|main fabric|exterior|exterieur|tissu principal|dessus|body|corps|cuerpo|corpo|tejido principal)\b');

const _accents = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ù': 'u',
  'ú': 'u', 'û': 'u', 'ü': 'u', 'ý': 'y', 'ÿ': 'y', 'ğ': 'g', 'ı': 'i', 'ş': 's', 'ł': 'l',
};

String _normalize(String text) {
  final lower = text.toLowerCase();
  final b = StringBuffer();
  for (final ch in lower.split('')) {
    b.write(_accents[ch] ?? ch);
  }
  return b.toString().replaceAll(RegExp(r'\s+'), ' ').trim();
}

/// Mêmes corrections que le serveur pour les erreurs de lecture des pourcentages.
String fixOcr(String text) {
  return text
      .replaceAllMapped(RegExp(r'(?<!\d\s?)%\s?(\d{1,3}(?:[.,]\d{1,2})?)'), (m) => '${m[1]}%')
      .replaceAllMapped(RegExp(r'(\d)[oO](?=\s*%|\d)'), (m) => '${m[1]}0')
      .replaceAllMapped(RegExp(r'\b[oO](?=\d)'), (m) => '0')
      .replaceAllMapped(RegExp(r'\b(100|[1-9]?\d)\s?96\b(?=\s*[a-zA-Z])'), (m) => '${m[1]}%')
      .replaceAllMapped(RegExp(r'\b(100|[1-9]?\d)\s?(?:o/o|°/o|0/0)', caseSensitive: false), (m) => '${m[1]}%');
}

class _Pair {
  final double pct;
  final String name;
  final int at;
  const _Pair(this.pct, this.name, this.at);
}

List<List<_Pair>> _blocks(List<_Pair> pairs) {
  final blocks = <List<_Pair>>[];
  var cur = <_Pair>[];
  var sum = 0.0;
  for (final p in pairs) {
    if (p.pct <= 0 || p.pct > 100) continue;
    cur.add(p);
    sum += p.pct;
    if (sum > 101) {
      cur = [p];
      sum = p.pct;
    }
    if (sum >= 99 && sum <= 101) {
      blocks.add(cur);
      cur = [];
      sum = 0;
    }
  }
  return blocks;
}

class LiveComposition {
  /// au moins un pourcentage et une matière lus
  final bool seen;

  /// le tissu principal a été lu en entier (100 %) : on peut demander la note au serveur
  final bool complete;

  /// aperçu lisible, ex. « 60 % cotton, 40 % polyester »
  final String? preview;

  const LiveComposition({required this.seen, required this.complete, this.preview});
}

String _pct(double v) => (v == v.roundToDouble() ? v.toInt().toString() : v.toString()).replaceAll('.', ',');

/// La composition du tissu principal lue dans le texte de l'image est-elle complète ?
LiveComposition compositionInText(String raw) {
  final clean = _normalize(fixOcr(raw)).replaceAll('|', ' ');
  List<_Pair> collect(RegExp re, int pctGroup, int nameGroup) => [
        for (final m in re.allMatches(clean))
          if (_material.firstMatch(m[nameGroup]!) case final word?)
            _Pair(double.parse(m[pctGroup]!.replaceAll(',', '.')), word[1]!, m.start),
      ];
  final a = collect(RegExp(r'(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*([a-z][a-z \-]{1,40})'), 1, 2);
  final b = collect(RegExp(r'([a-z][a-z \-]{1,30}?)\s*:?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%'), 2, 1);
  final blocks = _blocks(a).isNotEmpty ? _blocks(a) : _blocks(b);
  final linings = _lining.allMatches(clean).map((m) => m.start).toList();
  final mains = _main.allMatches(clean).map((m) => m.start).toList();
  bool inLining(int at) {
    final l = linings.where((i) => i < at).fold(-1, math.max);
    final m = mains.where((i) => i < at).fold(-1, math.max);
    return l >= 0 && l > m;
  }

  // tissu principal lu en entier ; une doublure lue seule ne suffit pas tant que le tissu principal
  // (pourcentages placés avant la mention « doublure ») reste incomplet
  final main = blocks.where((blk) => !inLining(blk.first.at)).firstOrNull;
  final pairs = a.isNotEmpty ? a : b;
  final mainPending = linings.isNotEmpty && pairs.any((p) => p.at < linings.first);
  final first = main ?? (mainPending ? null : blocks.firstOrNull);
  return LiveComposition(
    seen: a.isNotEmpty || b.isNotEmpty,
    complete: first != null,
    preview: first?.map((p) => '${_pct(p.pct)} % ${p.name}').join(', '),
  );
}

/// Cadre qui entoure les lignes utiles de l'étiquette (pourcentage, matière, pays) ; null si aucune.
Rect? labelBox(Iterable<({String text, Rect box})> lines) {
  Rect? out;
  for (final line in lines) {
    final t = _normalize(fixOcr(line.text));
    if (!RegExp(r'\d\s*%').hasMatch(t) && !_material.hasMatch(t) && !RegExp(r'made in|fabrique|hecho en|origin').hasMatch(t)) continue;
    out = out == null ? line.box : out.expandToInclude(line.box);
  }
  return out;
}
