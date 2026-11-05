import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../ar_geometry.dart';
import '../barcode.dart';
import '../compare.dart';
import '../config.dart';
import '../l10n.dart';
import '../models.dart';
import '../reliability.dart';
import '../native_ar.dart';
import '../navigation.dart';
import '../scanned_code.dart';
import '../theme.dart';
import '../widgets.dart';
import 'alternatives_screen.dart';
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
const _pillSize = 48.0;
const _cardWidth = 300.0;
const _cardHeight = 270.0;
const _topReserved = 72.0;
const _bottomReserved = 180.0;

enum _Lookup { loading, found, missing, error }

class _Tracked {
  _Tracked(this.ean);

  final String ean;
  _Lookup lookup = _Lookup.loading;
  Product? product;
  List<Offset> corners = const [];
  DateTime lastSeen = DateTime.now();

  /// dernière position connue à l'écran : la fiche enrichie y reste quand le code sort de l'image
  Rect? lastBox;

  /// alternatives mieux notées (chargées à l'ouverture de la fiche enrichie) ; null : pas encore chargées
  List<Product>? alternatives;
  bool alternativesLoading = false;

  bool get visible => corners.length >= 4 && DateTime.now().difference(lastSeen) < _lostAfter;

  Rect get box => boundsOf(corners);
}

class _ArScanScreenState extends State<ArScanScreen> {
  final _controller = MobileScannerController(
    // QR code : passeports numériques (GS1 Digital Link) et passeports VeriTrace
    formats: const [BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.upcA, BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.normal,
    // une analyse toutes les 100 ms : le badge suit le code-barres sans saccades
    detectionTimeoutMs: 100,
  );
  final Map<String, _Tracked> _tracked = {};
  // code visé : grand badge, cadre vert et panneau du bas
  String? _primary;
  Size? _viewSize;
  Timer? _ticker;
  bool _openingPassport = false;
  bool _wasVisible = false;
  // fiche enrichie ouverte dans la caméra (code-barres concerné)
  String? _cardEan;
  // réalité augmentée 3D native disponible (Android avec ARCore)
  bool _nativeAr = false;

  @override
  void initState() {
    super.initState();
    NativeAr.available().then((ok) {
      if (ok && mounted) setState(() => _nativeAr = true);
    });
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
      final scanned = parseScannedCode(raw);
      if (scanned == null) continue;
      final passport = scanned.passportId;
      if (passport != null) {
        unawaited(_openPassport(passport));
        continue;
      }
      final ean = scanned.gtin!;
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

  /// QR code d'un passeport numérique : sa page s'ouvre (version web).
  Future<void> _openPassport(String id) async {
    if (_openingPassport) return;
    _openingPassport = true;
    HapticFeedback.mediumImpact();
    Api.instance.track('passport_view');
    await _controller.stop();
    await launchUrl(Uri.parse('${AppConfig.siteUrl}/passeport/$id'), mode: LaunchMode.externalApplication);
    _openingPassport = false;
    if (mounted) unawaited(_controller.start());
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
        _openCard(tracked);
        return;
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

  /// Réalité augmentée 3D (ARCore) : la caméra passe à l'écran natif, puis reprend au retour.
  Future<void> _openNativeAr() async {
    await _controller.stop();
    if (!mounted) return;
    await NativeAr.open(context);
    if (!mounted) return;
    if (!await NativeAr.available() && mounted) setState(() => _nativeAr = false);
    if (mounted) unawaited(_controller.start());
  }

  /// Fiche enrichie : répartition de l'impact, pays, alternatives, sans quitter la caméra.
  void _openCard(_Tracked t) {
    setState(() => _cardEan = t.ean);
    Api.instance.track('ar_card_open', ean: t.ean, grade: t.product?.globalGrade);
    if (t.alternatives == null && !t.alternativesLoading && t.product?.globalGrade != Grade.A) {
      t.alternativesLoading = true;
      Api.instance.fetchAlternatives(t.ean).then((list) => t.alternatives = list, onError: (_) => t.alternatives = const <Product>[]).whenComplete(() {
        t.alternativesLoading = false;
        if (mounted) setState(() {});
      });
    }
  }

  /// Fiche complète (ou alternatives) : la caméra est mise en pause pendant la visite.
  Future<void> _leaveTo(Future<void> Function() go) async {
    await _controller.stop();
    if (!mounted) return;
    await go();
    if (mounted) unawaited(_controller.start());
  }

  void _showComparison(Comparison c) {
    Api.instance.track('compare_view', ean: c.best.ean, grade: c.best.globalGrade);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (sheet) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.85),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            children: [
              Text(tr('Comparaison du rayon'),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: VT.ink)),
              const SizedBox(height: 4),
              Text(tr('Articles scannés pendant votre visite, du mieux au moins bien noté.'),
                  style: const TextStyle(fontSize: 13, color: VT.muted2)),
              const SizedBox(height: 12),
              for (final (i, p) in c.ranked.indexed)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Material(
                    color: VT.ground,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        Navigator.of(sheet).pop();
                        _leaveTo(() => openProduct(context, p.ean, countScan: false));
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 24,
                              child: i == 0
                                  ? const Icon(Icons.emoji_events, color: Color(0xFFD4A514), size: 20)
                                  : Text('${i + 1}',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(fontWeight: FontWeight.w700, color: VT.muted2)),
                            ),
                            const SizedBox(width: 8),
                            GradeBadge(grade: p.globalGrade, size: 40),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(db(p.name),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: VT.ink)),
                                  Text(
                                    [
                                      bidi(p.brand.name),
                                      if (p.ecoCost != null) tr('{n} pts', {'n': formatPoints(p.ecoCost!)}),
                                    ].join(' · '),
                                    style: const TextStyle(fontSize: 13, color: VT.muted2),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: VT.muted2),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              TextButton(
                onPressed: () {
                  Navigator.of(sheet).pop();
                  setState(() {
                    _tracked.clear();
                    _primary = null;
                    _cardEan = null;
                  });
                },
                child: Text(tr('Vider la comparaison')),
              ),
              FilledButton(onPressed: () => Navigator.of(sheet).pop(), child: Text(tr('Continuer à scanner'))),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: LayoutBuilder(
        builder: (context, constraints) {
          _viewSize = constraints.biggest;
          final view = constraints.biggest;
          final visible = _tracked.values.where((t) => t.visible).toList();
          for (final t in visible) {
            t.lastBox = expandThinBox(t.box);
          }
          // comparateur : tous les articles reconnus pendant la visite
          final comparison = compareProducts(_tracked.values.where((t) => t.product != null).map((t) => t.product!));
          final bestEan = comparison?.best.ean;
          final card = _cardEan == null ? null : _tracked[_cardEan];
          // plusieurs étiquettes à l'image : le code le plus proche du centre a le grand badge,
          // les autres une pastille avec leur note
          final top = MediaQuery.paddingOf(context).top + _topReserved;
          final primary = pickCentral<_Tracked>(
            visible,
            boxOf: (t) => expandThinBox(t.box),
            center: Offset(view.width / 2, (top + view.height - _bottomReserved) / 2),
            current: _primary == null ? null : _tracked[_primary],
          );
          if (primary != null) _primary = primary.ean;
          final focus = _primary == null ? null : _tracked[_primary];
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
                child: CustomPaint(painter: _OutlinePainter(primary == null ? null : expandThinBox(primary.box))),
              ),
              for (final t in visible)
                if (t != primary && t.ean != _cardEan) _pillFor(t, view, top, best: t.ean == bestEan),
              if (primary != null && primary.ean != _cardEan) _badgeFor(primary, view, top, best: primary.ean == bestEan),
              Positioned(left: 0, right: 0, top: 0, child: _topBar(context)),
              Positioned(left: 0, right: 0, bottom: 0, child: _bottomPanel(focus, comparison)),
              if (card != null && card.product != null && card.lastBox != null) _cardFor(card, view, top, best: card.ean == bestEan),
            ],
          );
        },
      ),
    );
  }

  /// Badge accroché au-dessus du code-barres (ou en dessous s'il manque de place).
  Widget _badgeFor(_Tracked t, Size view, double topLimit, {bool best = false}) {
    final origin = badgeOrigin(
      barcode: expandThinBox(t.box),
      viewSize: view,
      badgeSize: const Size(_badgeWidth, _badgeHeight),
      topLimit: topLimit,
      bottomReserved: _bottomReserved,
    );
    return AnimatedPositioned(
      key: ValueKey('badge-${t.ean}'),
      duration: const Duration(milliseconds: 110),
      curve: Curves.easeOut,
      left: origin.dx,
      top: origin.dy,
      width: _badgeWidth,
      height: _badgeHeight,
      child: _ArBadge(tracked: t, best: best, onTap: () => _open(t)),
    );
  }

  /// Fiche enrichie accrochée au code-barres (reste à sa dernière place si le code sort de l'image).
  Widget _cardFor(_Tracked t, Size view, double topLimit, {bool best = false}) {
    final origin = badgeOrigin(
      barcode: t.lastBox!,
      viewSize: view,
      badgeSize: const Size(_cardWidth, _cardHeight),
      topLimit: topLimit,
      bottomReserved: _bottomReserved,
    );
    final p = t.product!;
    return AnimatedPositioned(
      key: ValueKey('card-${t.ean}'),
      duration: const Duration(milliseconds: 110),
      curve: Curves.easeOut,
      left: origin.dx,
      top: origin.dy,
      width: _cardWidth,
      child: _ArCard(
        product: p,
        best: best,
        alternatives: t.alternatives,
        onClose: () => setState(() => _cardEan = null),
        onProduct: () => _leaveTo(() => openProduct(context, p.ean, countScan: false)),
        onAlternatives: () => _leaveTo(
          () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AlternativesScreen(product: p))),
        ),
      ),
    );
  }

  /// Pastille compacte (note seule) pour les autres codes-barres visibles.
  Widget _pillFor(_Tracked t, Size view, double topLimit, {bool best = false}) {
    final origin = badgeOrigin(
      barcode: expandThinBox(t.box),
      viewSize: view,
      badgeSize: const Size(_pillSize, _pillSize),
      topLimit: topLimit,
      bottomReserved: _bottomReserved,
      margin: 6,
    );
    return AnimatedPositioned(
      key: ValueKey('pill-${t.ean}'),
      duration: const Duration(milliseconds: 110),
      curve: Curves.easeOut,
      left: origin.dx,
      top: origin.dy,
      width: _pillSize,
      height: _pillSize,
      child: _ArPill(tracked: t, best: best, onTap: () => _open(t)),
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
              label: tr('Retour'),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            Expanded(
              child: Text(
                tr("Visez l'étiquette"),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ),
            if (_nativeAr) ...[
              _Ar3dButton(onPressed: _openNativeAr),
              const SizedBox(width: 8),
            ],
            ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controller,
              builder: (context, state, _) {
                if (state.torchState == TorchState.unavailable) return const SizedBox(width: 44);
                final on = state.torchState == TorchState.on;
                return _RoundButton(
                  icon: on ? Icons.flashlight_off : Icons.flashlight_on,
                  label: on ? tr('Éteindre la lampe') : tr('Allumer la lampe'),
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
  Widget _bottomPanel(_Tracked? focus, Comparison? comparison) {
    Widget content;
    if (focus == null) {
      content = Text(
        _nativeAr
            ? tr('Visez un ou plusieurs codes-barres : la note apparaît dessus. Bouton 3D : elle reste posée sur le vêtement.')
            : tr('Visez un ou plusieurs codes-barres : la note apparaît dessus, et le meilleur du rayon reçoit une couronne.'),
        textAlign: TextAlign.center,
        style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
      );
    } else {
      final p = focus.product;
      final (title, subtitle) = switch (focus.lookup) {
        _Lookup.loading => (tr('Analyse du code…'), tr('EAN {code}', {'code': formatEan(focus.ean)})),
        _Lookup.found => (db(p!.name), tr('{brand} · touchez pour la fiche enrichie', {'brand': p.brand.name})),
        _Lookup.missing => (tr('Article pas encore référencé'), tr('Touchez pour le signaler')),
        _Lookup.error => (tr('Connexion impossible'), tr('Touchez pour réessayer')),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (comparison != null) ...[
            _CompareBar(comparison: comparison, onTap: () => _showComparison(comparison)),
            const SizedBox(height: 10),
          ],
          content,
        ],
      ),
    );
  }
}

/// Couronne du meilleur article de la comparaison.
class _Crown extends StatelessWidget {
  final double size;
  const _Crown({this.size = 28});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [BoxShadow(color: Colors.black38, blurRadius: 6)],
      ),
      child: Icon(Icons.emoji_events, color: const Color(0xFFD4A514), size: size * 0.66),
    );
  }
}

class _CompareBar extends StatelessWidget {
  final Comparison comparison;
  final VoidCallback onTap;
  const _CompareBar({required this.comparison, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final best = comparison.best;
    return Material(
      color: const Color(0xD90F1A14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFF2C94C), width: 1.5),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              const Icon(Icons.emoji_events, color: Color(0xFFF2C94C)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr('Le meilleur ici : {name} ({grade})', {'name': best.name, 'grade': best.globalGrade.name}),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                    Text(comparison.summary, style: const TextStyle(color: Color(0xFFC9D4CD), fontSize: 13)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: const Color(0xFFF2C94C), borderRadius: BorderRadius.circular(999)),
                child: Text(tr('Comparer {n}', {'n': comparison.ranked.length}),
                    style: const TextStyle(color: VT.ink, fontWeight: FontWeight.w700, fontSize: 13)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fiche enrichie accrochée au code-barres : verdict, répartition de l'impact, pays, composition et
/// meilleure alternative, sans quitter la caméra.
class _ArCard extends StatelessWidget {
  final Product product;
  final bool best;
  final List<Product>? alternatives;
  final VoidCallback onClose;
  final VoidCallback onProduct;
  final VoidCallback onAlternatives;

  const _ArCard({
    required this.product,
    required this.best,
    required this.alternatives,
    required this.onClose,
    required this.onProduct,
    required this.onAlternatives,
  });

  @override
  Widget build(BuildContext context) {
    final p = product;
    final bars = [...p.carbonBreakdown]..sort((a, b) => b.share.compareTo(a.share));
    final facts = [
      if (!p.originCountry.toLowerCase().startsWith('non ')) tr('Fabriqué : {country}', {'country': p.originCountry}),
      if (!p.composition.toLowerCase().startsWith('non ')) bidi(p.composition),
    ].join(' · ');
    final alts = alternatives;
    final altText = alts == null
        ? tr("Recherche d'alternatives…")
        : alts.isEmpty
            ? tr("Pas d'alternative mieux notée connue")
            : [
                tr('Mieux noté : {name} ({grade})', {'name': alts.first.name, 'grade': alts.first.globalGrade.name}),
                if (alts.length > 1) tr('{n} alternatives', {'n': alts.length}),
              ].join(' · ');
    return Material(
      color: Colors.white,
      elevation: 10,
      shadowColor: Colors.black54,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 10, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    GradeBadge(grade: p.globalGrade, size: 44, round: true),
                    if (best) const PositionedDirectional(start: -10, top: -12, child: _Crown(size: 26)),
                  ],
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(verdicts[p.globalGrade]!.$1,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: VT.ink)),
                      Text(
                        [
                          bidi(p.brand.name),
                          if (p.ecoCost != null) tr('{n} pts', {'n': formatPoints(p.ecoCost!)}),
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, color: VT.muted),
                      ),
                    ],
                  ),
                ),
                IconButton(tooltip: tr('Fermer la fiche'), onPressed: onClose, icon: const Icon(Icons.close, color: VT.ink)),
              ],
            ),
            const SizedBox(height: 6),
            for (final b in bars.take(3))
              Padding(
                padding: const EdgeInsetsDirectional.only(bottom: 6, end: 4),
                child: Row(
                  children: [
                    SizedBox(
                      width: 110,
                      child: Text(db(b.label),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13, color: VT.muted)),
                    ),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: (b.share.clamp(4, 100)) / 100,
                          minHeight: 8,
                          backgroundColor: VT.line,
                          color: levelColor[b.level] ?? VT.green,
                        ),
                      ),
                    ),
                    SizedBox(
                      width: 40,
                      child: Text(bidi('${b.share} %'),
                          textAlign: TextAlign.end, style: const TextStyle(fontSize: 13, color: VT.muted2)),
                    ),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 4, bottom: 8),
              child: Text(facts.isEmpty ? tr('Composition et pays non communiqués') : facts,
                  style: const TextStyle(fontSize: 13, color: VT.muted, height: 1.35)),
            ),
            if (p.globalGrade != Grade.A)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 4),
                child: Material(
                  color: (alts?.isNotEmpty ?? false) ? VT.mintTint : VT.line,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: (alts?.isNotEmpty ?? false) ? onAlternatives : null,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                      child: Text(altText,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: (alts?.isNotEmpty ?? false) ? FontWeight.w700 : FontWeight.w500,
                            color: (alts?.isNotEmpty ?? false) ? VT.green : VT.muted2,
                          )),
                    ),
                  ),
                ),
              ),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton(
                onPressed: onProduct,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [Text(tr('Fiche complète')), const Icon(Icons.chevron_right, size: 18)],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArBadge extends StatelessWidget {
  final _Tracked tracked;
  final VoidCallback onTap;
  final bool best;

  const _ArBadge({required this.tracked, required this.onTap, this.best = false});

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
        title = tr('Analyse…');
        subtitle = tr('EAN {code}', {'code': formatEan(tracked.ean)});
      case _Lookup.found:
        leading = GradeBadge(grade: p!.globalGrade, size: 40, round: true);
        title = db(p.name);
        // coût environnemental affiché avec la note dès qu'il est connu
        subtitle = p.ecoCost != null
            ? tr('{n} pts · note VeriTrace {grade}', {'n': formatPoints(p.ecoCost!), 'grade': p.globalGrade.name})
            : tr('Carbone {carbon} · Social {social}',
                {'carbon': p.carbonGrade.name, 'social': p.socialGrade?.name ?? tr('non évaluée')});
      case _Lookup.missing:
        leading = const GradeBadge(grade: null, size: 40, round: true);
        title = tr('Non référencé');
        subtitle = tr('Touchez pour le signaler');
      case _Lookup.error:
        leading = const Icon(Icons.wifi_off, color: VT.danger, size: 28);
        title = tr('Hors connexion');
        subtitle = tr('Touchez pour réessayer');
    }
    final badge = Semantics(
      button: true,
      label: '$title. $subtitle${best ? '. ${tr('Le meilleur des articles scannés')}' : ''}',
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
                          style: const TextStyle(fontSize: 13, color: VT.muted)),
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
    if (!best) return badge;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFF2C94C), width: 3),
            ),
          ),
        ),
        Positioned.fill(child: badge),
        const PositionedDirectional(start: -9, top: -13, child: IgnorePointer(child: _Crown())),
      ],
    );
  }
}

/// Cadre vert autour du code-barres visé.
class _OutlinePainter extends CustomPainter {
  final Rect? box;
  _OutlinePainter(this.box);

  @override
  void paint(Canvas canvas, Size size) {
    final b = box;
    if (b == null) return;
    final rrect = RRect.fromRectAndRadius(b, const Radius.circular(10));
    canvas.drawRRect(rrect, Paint()..color = VT.mint.withValues(alpha: 0.12));
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = VT.mint
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(covariant _OutlinePainter oldDelegate) => oldDelegate.box != box;
}

class _ArPill extends StatelessWidget {
  final _Tracked tracked;
  final VoidCallback onTap;
  final bool best;

  const _ArPill({required this.tracked, required this.onTap, this.best = false});

  @override
  Widget build(BuildContext context) {
    final p = tracked.product;
    final Widget child;
    final String label;
    switch (tracked.lookup) {
      case _Lookup.loading:
        child = const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 3, color: VT.green));
        label = tr('Analyse en cours');
      case _Lookup.found:
        child = GradeBadge(grade: p!.globalGrade, size: 40, round: true);
        label = tr('{name}, note {grade}. Touchez pour voir la fiche', {'name': p.name, 'grade': p.globalGrade.name});
      case _Lookup.missing:
        child = const GradeBadge(grade: null, size: 40, round: true);
        label = tr('Article non référencé. Touchez pour le signaler');
      case _Lookup.error:
        child = const Icon(Icons.wifi_off, color: VT.danger, size: 24);
        label = tr('Hors connexion. Touchez pour réessayer');
    }
    final pill = Semantics(
      button: true,
      label: best ? '$label. ${tr('Le meilleur des articles scannés')}' : label,
      excludeSemantics: true,
      child: Material(
        color: Colors.white,
        elevation: 4,
        shadowColor: Colors.black54,
        shape: best ? const CircleBorder(side: BorderSide(color: Color(0xFFF2C94C), width: 3)) : const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Center(child: child),
        ),
      ),
    );
    if (!best) return pill;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(child: pill),
        const PositionedDirectional(start: -12, top: -12, child: IgnorePointer(child: _Crown(size: 24))),
      ],
    );
  }
}

/// Passage à la réalité augmentée 3D (note posée dans l'espace, Android avec ARCore).
class _Ar3dButton extends StatelessWidget {
  final VoidCallback onPressed;

  const _Ar3dButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tr('Réalité augmentée 3D : la note reste posée sur le vêtement'),
      child: Material(
        color: const Color(0x66000000),
        shape: const StadiumBorder(),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onPressed,
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.view_in_ar, color: VT.mint, size: 20),
                SizedBox(width: 6),
                Text('3D', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ),
      ),
    );
  }
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
        tr("L'accès à la caméra est refusé. Autorisez-le dans les réglages du téléphone, ou saisissez le code à la main."),
      MobileScannerErrorCode.unsupported => tr('Aucune caméra disponible sur cet appareil. Saisissez le code à la main.'),
      _ => tr('Impossible de démarrer la caméra. Réessayez ou saisissez le code à la main.'),
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
                child: Text(tr('Retour')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
