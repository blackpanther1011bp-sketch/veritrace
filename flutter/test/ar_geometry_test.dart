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

  group('expandThinBox', () {
    test('agrandit un cadre trop fin autour de son centre', () {
      final r = expandThinBox(const Rect.fromLTWH(0, 100, 200, 20));
      expect(r.height, closeTo(90, 0.001)); // 0,45 × 200
      expect(r.center, const Offset(100, 110));
    });

    test('laisse un cadre déjà assez haut', () {
      const box = Rect.fromLTWH(0, 0, 200, 120);
      expect(expandThinBox(box), box);
    });
  });

  group('pickCentral', () {
    Rect boxAt(double cx, double cy) => Rect.fromCenter(center: Offset(cx, cy), width: 100, height: 50);
    final boxes = {'a': boxAt(50, 300), 'b': boxAt(200, 380), 'c': boxAt(340, 300)};
    final keys = boxes.keys.toList();

    test('choisit le code le plus proche du centre', () {
      expect(pickCentral(keys, boxOf: (k) => boxes[k]!, center: const Offset(195, 370)), 'b');
    });

    test('garde le code actuel tant qu\'il reste presque aussi proche', () {
      // « a » est à ~150 px du centre, « b » à ~11 px : écart trop grand, on change
      expect(pickCentral(keys, boxOf: (k) => boxes[k]!, center: const Offset(195, 370), current: 'a'), 'b');
      // centre entre « b » et « c » : « c » reste choisi malgré une légère avance de « b »
      expect(pickCentral(keys, boxOf: (k) => boxes[k]!, center: const Offset(260, 345), current: 'c'), 'c');
    });

    test('liste vide : aucun code', () {
      expect(pickCentral(<String>[], boxOf: (k) => Rect.zero, center: Offset.zero), isNull);
    });
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
