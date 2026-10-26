import 'dart:math' as math;

import 'package:flutter/painting.dart';
import 'package:flutter/services.dart' show DeviceOrientation;
import 'package:mobile_scanner/mobile_scanner.dart' show ScanWindowUtils;

/// Convertit les coins d'un code-barres, exprimés dans l'image de la caméra,
/// en coordonnées à l'écran. Même calcul que l'aperçu caméra de mobile_scanner
/// (mise à l'échelle [fit] puis recentrage).
List<Offset> mapCornersToView({
  required List<Offset> corners,
  required Size imageSize,
  required Size viewSize,
  required DeviceOrientation orientation,
  BoxFit fit = BoxFit.cover,
}) {
  if (imageSize.isEmpty || viewSize.isEmpty) return const [];
  final landscape = orientation == DeviceOrientation.landscapeLeft || orientation == DeviceOrientation.landscapeRight;
  // l'image peut être annoncée dans le sens du capteur : on la remet dans le sens de l'écran
  final image = landscape
      ? Size(imageSize.longestSide, imageSize.shortestSide)
      : Size(imageSize.shortestSide, imageSize.longestSide);
  final ratio = ScanWindowUtils.calculateBoxFitRatio(boxFit: fit, cameraPreviewSize: image, size: viewSize);
  final dx = (image.width * ratio.widthRatio - viewSize.width) / 2;
  final dy = (image.height * ratio.heightRatio - viewSize.height) / 2;
  return [for (final c in corners) Offset(c.dx * ratio.widthRatio - dx, c.dy * ratio.heightRatio - dy)];
}

/// Agrandit verticalement un cadre trop fin, autour de son centre : pour un
/// code-barres classique, le décodeur ne repère souvent qu'une bande horizontale.
Rect expandThinBox(Rect box, {double minRatio = 0.45}) {
  final minHeight = box.width * minRatio;
  if (box.height >= minHeight) return box;
  return Rect.fromCenter(center: box.center, width: box.width, height: minHeight);
}

/// Choisit le code-barres visé : le plus proche de [center]. L'élément [current]
/// est gardé tant qu'il n'est pas nettement plus loin ([stickiness] px), pour
/// que le grand badge ne saute pas d'un code à l'autre.
T? pickCentral<T>(
  List<T> items, {
  required Rect Function(T item) boxOf,
  required Offset center,
  T? current,
  double stickiness = 60,
}) {
  if (items.isEmpty) return null;
  double dist(T item) => (boxOf(item).center - center).distance;
  var best = items.first;
  for (final item in items) {
    if (dist(item) < dist(best)) best = item;
  }
  if (current != null && items.contains(current) && dist(current) <= dist(best) + stickiness) {
    return current;
  }
  return best;
}

/// Rectangle englobant une liste de points.
Rect boundsOf(List<Offset> points) {
  var left = points.first.dx, right = left, top = points.first.dy, bottom = top;
  for (final p in points) {
    left = math.min(left, p.dx);
    right = math.max(right, p.dx);
    top = math.min(top, p.dy);
    bottom = math.max(bottom, p.dy);
  }
  return Rect.fromLTRB(left, top, right, bottom);
}

/// Coin haut-gauche du badge : centré au-dessus du code-barres, ou en dessous
/// s'il manque de place, sans jamais sortir de l'écran ni passer sous les
/// barres du haut ([topLimit]) et du bas ([bottomReserved]).
Offset badgeOrigin({
  required Rect barcode,
  required Size viewSize,
  required Size badgeSize,
  required double topLimit,
  required double bottomReserved,
  double margin = 12,
}) {
  var top = barcode.top - badgeSize.height - margin;
  if (top < topLimit) top = barcode.bottom + margin;
  final maxTop = math.max(topLimit, viewSize.height - badgeSize.height - bottomReserved);
  top = top.clamp(topLimit, maxTop).toDouble();
  final maxLeft = math.max(margin, viewSize.width - badgeSize.width - margin);
  final left = (barcode.center.dx - badgeSize.width / 2).clamp(margin, maxLeft).toDouble();
  return Offset(left, top);
}
