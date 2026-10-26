import 'package:flutter/painting.dart';
import 'package:flutter/services.dart' show DeviceOrientation;
import 'package:flutter_test/flutter_test.dart';
import 'package:veritrace/ar_geometry.dart';

void main() {
  group('mapCornersToView', () {
    test('image deux fois plus grande que l\'écran : coordonnées divisées par deux', () {
      final out = mapCornersToView(
        corners: const [Offset(100, 200), Offset(300, 400)],
        imageSize: const Size(720, 1280),
        viewSize: const Size(360, 640),
        orientation: DeviceOrientation.portraitUp,
      );
      expect(out, const [Offset(50, 100), Offset(150, 200)]);
    });

    test("taille d'image annoncée à l'horizontale en mode portrait : même résultat", () {
      final out = mapCornersToView(
        corners: const [Offset(100, 200)],
        imageSize: const Size(1280, 720),
        viewSize: const Size(360, 640),
        orientation: DeviceOrientation.portraitUp,
      );
      expect(out, const [Offset(50, 100)]);
    });

    test("écran plus étroit que l'image (cover) : l'image est recadrée sur les côtés", () {
      // image 480x640 (3:4) dans un écran 390x844 : échelle 844/640 = 1,31875
      // largeur affichée 633 px, soit 121,5 px coupés de chaque côté
      final out = mapCornersToView(
        corners: const [Offset(240, 320)],
        imageSize: const Size(480, 640),
        viewSize: const Size(390, 844),
        orientation: DeviceOrientation.portraitUp,
      );
      expect(out.single.dx, closeTo(195, 0.001)); // centre de l'image = centre de l'écran
      expect(out.single.dy, closeTo(422, 0.001));
    });

    test('taille vide : aucun point', () {
      expect(
        mapCornersToView(
          corners: const [Offset(1, 1)],
          imageSize: Size.zero,
          viewSize: const Size(360, 640),
          orientation: DeviceOrientation.portraitUp,
        ),
        isEmpty,
      );
    });
  });

  test('boundsOf', () {
    expect(
      boundsOf(const [Offset(10, 40), Offset(50, 20), Offset(30, 60)]),
      const Rect.fromLTRB(10, 20, 50, 60),
    );
  });

  group('badgeOrigin', () {
    const view = Size(390, 844);
    const badge = Size(240, 68);

    test('au-dessus du code-barres, centré', () {
      final o = badgeOrigin(
        barcode: const Rect.fromLTWH(120, 400, 150, 80),
        viewSize: view,
        badgeSize: badge,
        topLimit: 100,
        bottomReserved: 180,
      );
      expect(o, const Offset(75, 320)); // 400 - 68 - 12 ; centre 195 - 120
    });

    test("en dessous quand le code-barres est trop haut", () {
      final o = badgeOrigin(
        barcode: const Rect.fromLTWH(120, 110, 150, 80),
        viewSize: view,
        badgeSize: badge,
        topLimit: 100,
        bottomReserved: 180,
      );
      expect(o.dy, 202); // 110 + 80 + 12
    });

    test("ne sort jamais de l'écran", () {
      final o = badgeOrigin(
        barcode: const Rect.fromLTWH(-50, 900, 40, 40),
        viewSize: view,
        badgeSize: badge,
        topLimit: 100,
        bottomReserved: 180,
      );
      expect(o.dx, 12);
      expect(o.dy, lessThanOrEqualTo(844 - 68 - 180));
    });

    test('petit écran : pas de plantage', () {
      final o = badgeOrigin(
        barcode: const Rect.fromLTWH(0, 0, 10, 10),
        viewSize: const Size(200, 200),
        badgeSize: badge,
        topLimit: 100,
        bottomReserved: 180,
      );
      expect(o.dy, 100);
    });
  });
}
