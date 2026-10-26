import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../api.dart';
import '../ar_geometry.dart';
import '../barcode.dart';
import '../models.dart';
import '../navigation.dart';
import '../theme.dart';
import '../widgets.dart';
import 'not_found_screen.dart';

/// Réalité augmentée légère : la note du vêtement s'affiche sur l'image de la
/// caméra, accrochée au code-barres, et le suit quand on bouge le téléphone.
class ArScanScreen extends StatefulWidget {
  const ArScanScreen({super.key});

  @override
  State<ArScanScreen> createState() => _ArScanScreenState();
}

const _fit = BoxFit.cover;
const _lostAfter = Duration(milliseconds: 900);
const _badgeWidth = 240.0;
const _badgeHeight = 68.0;

enum _Lookup { loading, found, missing, error }

class _Tracked {
  _Tracked(this.ean);

  final String ean;
  _Lookup lookup = _Lookup.loading;
  Product? product;
  List<Offset> corners = const [];
  DateTime lastSeen = DateTime.now();

  bool get visible => corners.length >= 4 && DateTime.now().difference(lastSeen) < _lostAfter;

  Rect get box => boundsOf(corners);
}

class _ArScanScreenState extends State<ArScanScreen> {
  final _controller = MobileScannerController(
    formats: const [BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.upcA],
    detectionSpeed: DetectionSpeed.normal,
    // une analyse toutes les 100 ms : le badge suit le code-barres sans saccades
    detectionTimeoutMs: 100,
  );
  final Map<String, _Tracked> _tracked = {};
  String? _focus;
  Size? _viewSize;
  Timer? _ticker;
  bool _wasVisible = false;

  @override
  void initState() {
    super.initState();
    // cache les badges dont le code-barres a quitté l'image
    _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) {
      final anyVisible = _tracked.values.any((t) => t.visible);
      if (anyVisible != _wasVisible || anyVisible) {
        _wasVisible = anyVisible;
        if (mounted) setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    final view = _viewSize;
    if (view == null || capture.size.isEmpty) return;
    final now = DateTime.now();
    var changed = false;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null) continue;
      final ean = normalizeGtin(raw);
      if (!isValidGtin(ean)) continue;
      var tracked = _tracked[ean];
      if (tracked == null) {
        tracked = _Tracked(ean);
        _tracked[ean] = tracked;
        HapticFeedback.mediumImpact();
        Api.instance.track('scan', ean: ean);
        _lookupProduct(tracked);
      }
      tracked.lastSeen = now;
      if (barcode.corners.length >= 4) {
        tracked.corners = mapCornersToView(
          corners: barcode.corners,
          imageSize: capture.size,
          viewSize: view,
          orientation: _controller.value.deviceOrientation,
          fit: _fit,
        );
      }
      _focus = ean;
      changed = true;
    }
    if (changed && mounted) setState(() {});
  }

  Future<void> _lookupProduct(_Tracked tracked) async {
    try {
      final product = await Api.instance.fetchProduct(tracked.ean);
      tracked.product = product;
      tracked.lookup = product == null ? _Lookup.missing : _Lookup.found;
      if (product == null) Api.instance.track('not_found', ean: tracked.ean);
    } catch (_) {
      tracked.lookup = _Lookup.error;
    }
    if (mounted) setState(() {});
  }

  Future<void> _open(_Tracked tracked) async {
    switch (tracked.lookup) {
      case _Lookup.loading:
        return;
      case _Lookup.error:
        setState(() => tracked.lookup = _Lookup.loading);
        await _lookupProduct(tracked);
        return;
      case _Lookup.found:
      case _Lookup.missing:
        break;
    }
    await _controller.stop();
    if (!mounted) return;
    if (tracked.lookup == _Lookup.found) {
      await openProduct(context, tracked.ean, countScan: false);
    } else {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => NotFoundScreen(ean: tracked.ean)));
    }
    if (mounted) unawaited(_controller.start());
  }

  @override
  Widget build(BuildContext context) {
    final focus = _focus == null ? null : _tracked[_focus];
    return Scaffold(
      backgroundColor: Colors.black,
      body: LayoutBuilder(
        builder: (context, constraints) {
          _viewSize = constraints.biggest;
          final view = constraints.biggest;
          final visible = _tracked.values.where((t) => t.visible).toList();
          return Stack(
            fit: StackFit.expand,
            children: [
              MobileScanner(
                controller: _controller,
                fit: _fit,
                onDetect: _onDetect,
                errorBuilder: (context, error) => _CameraError(error: error),
              ),
              IgnorePointer(
                child: CustomPaint(painter: _OutlinePainter([for (final t in visible) t.corners])),
              ),
              for (final t in visible) _badgeFor(t, view),
              Positioned(left: 0, right: 0, top: 0, child: _topBar(context)),
              Positioned(left: 0, right: 0, bottom: 0, child: _bottomPanel(focus)),
            ],
          );
        },
      ),
    );
  }

  /// Badge accroché au-dessus du code-barres (ou en dessous s'il manque de place).
  Widget _badgeFor(_Tracked t, Size view) {
    final origin = badgeOrigin(
      barcode: t.box,
      viewSize: view,
      badgeSize: const Size(_badgeWidth, _badgeHeight),
      topLimit: MediaQuery.paddingOf(context).top + 72,
      bottomReserved: 180,
    );
    return AnimatedPositioned(
      key: ValueKey(t.ean),
      duration: const Duration(milliseconds: 110),
      curve: Curves.easeOut,
      left: origin.dx,
      top: origin.dy,
      width: _badgeWidth,
      height: _badgeHeight,
      child: _ArBadge(tracked: t, onTap: () => _open(t)),
    );
  }

  Widget _topBar(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: Row(
          children: [
            _RoundButton(
              icon: Icons.arrow_back,
              label: 'Retour',
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            const Expanded(
              child: Text(
                "Visez l'étiquette",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700),
              ),
            ),
            ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controller,
              builder: (context, state, _) {
                if (state.torchState == TorchState.unavailable) return const SizedBox(width: 44);
                final on = state.torchState == TorchState.on;
                return _RoundButton(
                  icon: on ? Icons.flashlight_off : Icons.flashlight_on,
                  label: on ? 'Éteindre la lampe' : 'Allumer la lampe',
                  onPressed: () => _controller.toggleTorch(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  /// Panneau du bas : rappel du dernier article détecté, utilisable même si le
  /// badge sort de l'écran.
  Widget _bottomPanel(_Tracked? focus) {
    Widget content;
    if (focus == null) {
      content = const Text(
        'Visez le code-barres : la note du vêtement apparaît directement dessus.',
        textAlign: TextAlign.center,
        style: TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
      );
    } else {
      final p = focus.product;
      final (title, subtitle) = switch (focus.lookup) {
        _Lookup.loading => ('Analyse du code…', 'EAN ${formatEan(focus.ean)}'),
        _Lookup.found => (p!.name, '${p.brand.name} · touchez pour voir la fiche'),
        _Lookup.missing => ('Article pas encore référencé', 'Touchez pour le signaler'),
        _Lookup.error => ('Connexion impossible', 'Touchez pour réessayer'),
      };
      content = Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _open(focus),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                GradeBadge(grade: p?.globalGrade, size: 44),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: VT.ink)),
                      Text(subtitle, style: const TextStyle(fontSize: 13, color: VT.muted2)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: VT.muted2),
              ],
            ),
          ),
        ),
      );
    }
    return Container(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.paddingOf(context).bottom),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x00000000), Color(0xCC000000)],
        ),
      ),
      child: content,
    );
  }
}

class _ArBadge extends StatelessWidget {
  final _Tracked tracked;
  final VoidCallback onTap;

  const _ArBadge({required this.tracked, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = tracked.product;
    final Widget leading;
    final String title;
    final String subtitle;
    switch (tracked.lookup) {
      case _Lookup.loading:
        leading = const SizedBox(
          width: 40,
          height: 40,
          child: Padding(padding: EdgeInsets.all(9), child: CircularProgressIndicator(strokeWidth: 3, color: VT.green)),
        );
        title = 'Analyse…';
        subtitle = 'EAN ${formatEan(tracked.ean)}';
      case _Lookup.found:
        leading = GradeBadge(grade: p!.globalGrade, size: 40, round: true);
        title = p.name;
        subtitle = 'Carbone ${p.carbonGrade.name} · Social ${p.socialGrade.name}';
      case _Lookup.missing:
        leading = const GradeBadge(grade: null, size: 40, round: true);
        title = 'Non référencé';
        subtitle = 'Touchez pour le signaler';
      case _Lookup.error:
        leading = const Icon(Icons.wifi_off, color: VT.danger, size: 28);
        title = 'Hors connexion';
        subtitle = 'Touchez pour réessayer';
    }
    return Semantics(
      button: true,
      label: '$title. $subtitle',
      excludeSemantics: true,
      child: Material(
        color: Colors.white,
        elevation: 6,
        shadowColor: Colors.black54,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                leading,
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: VT.ink)),
                      const SizedBox(height: 2),
                      Text(subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12.5, color: VT.muted)),
                    ],
                  ),
                ),
                if (tracked.lookup == _Lookup.found) const Icon(Icons.chevron_right, color: VT.muted2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Contour vert autour de chaque code-barres suivi.
class _OutlinePainter extends CustomPainter {
  final List<List<Offset>> polygons;
  _OutlinePainter(this.polygons);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = VT.mint
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeJoin = StrokeJoin.round;
    for (final poly in polygons) {
      if (poly.length < 4) continue;
      canvas.drawPath(Path()..addPolygon(poly, true), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _OutlinePainter oldDelegate) => true;
}

class _RoundButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  const _RoundButton({required this.icon, required this.label, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0x66000000),
      shape: const CircleBorder(),
      child: IconButton(
        tooltip: label,
        icon: Icon(icon, color: Colors.white),
        onPressed: onPressed,
      ),
    );
  }
}

class _CameraError extends StatelessWidget {
  final MobileScannerException error;
  const _CameraError({required this.error});

  @override
  Widget build(BuildContext context) {
    final message = switch (error.errorCode) {
      MobileScannerErrorCode.permissionDenied =>
        "L'accès à la caméra est refusé. Autorisez-le dans les réglages du téléphone, ou saisissez le code à la main.",
      MobileScannerErrorCode.unsupported => "Aucune caméra disponible sur cet appareil. Saisissez le code à la main.",
      _ => 'Impossible de démarrer la caméra. Réessayez ou saisissez le code à la main.',
    };
    return ColoredBox(
      color: VT.ink,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.no_photography_outlined, color: Colors.white70, size: 48),
              const SizedBox(height: 16),
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 15)),
              const SizedBox(height: 20),
              OutlinedButton(
                onPressed: () => Navigator.of(context).maybePop(),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white)),
                child: const Text('Retour'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
