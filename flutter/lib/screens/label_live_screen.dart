import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';
import '../ar_geometry.dart';
import '../contribute.dart';
import '../l10n.dart';
import '../label_live.dart';
import '../models.dart';
import '../navigation.dart';
import '../storage.dart';
import '../theme.dart';
import '../widgets.dart';
import 'label_scan_screen.dart';

/// Réalité augmentée sur l'étiquette cousue : on vise l'étiquette de composition, le texte est lu en
/// continu sur le téléphone (ML Kit), et la note s'affiche sur l'étiquette dès que la composition du
/// tissu principal est complète. Pas de photo à prendre, pas de code-barres nécessaire.
class LabelLiveScreen extends StatefulWidget {
  final String? ean;
  const LabelLiveScreen({super.key, this.ean});

  @override
  State<LabelLiveScreen> createState() => _LabelLiveScreenState();
}

enum _Phase { starting, scanning, sending, result, failed }

const _categoryKey = 'vt_live_category';
const _badgeSize = Size(260, 72);
const _topReserved = 72.0;
const _bottomReserved = 230.0;
const _minInterval = Duration(milliseconds: 250);
const _retryAfter = Duration(seconds: 4);

class _LabelLiveScreenState extends State<LabelLiveScreen> with WidgetsBindingObserver {
  final _recognizer = TextRecognizer(script: TextRecognitionScript.latin);
  CameraController? _controller;
  CameraDescription? _camera;
  _Phase _phase = _Phase.starting;
  String? _cameraError;
  String? _category;
  bool _busy = false;
  bool _torch = false;
  DateTime _lastFrame = DateTime.fromMillisecondsSinceEpoch(0);
  String _lastSent = '';
  DateTime _lastSentAt = DateTime.fromMillisecondsSinceEpoch(0);
  bool _seen = false;
  String? _preview;
  String? _message;
  Rect? _box; // dans l'image redressée
  Size? _imageSize; // image redressée (portrait)
  Product? _product;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Api.instance.track('label_live_start', ean: widget.ean);
    SharedPreferences.getInstance().then((prefs) {
      final c = prefs.getString(_categoryKey);
      if (mounted && c != null && contributionCategories.contains(c)) setState(() => _category = c);
    });
    unawaited(_start());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    final c = _controller;
    _controller = null;
    if (c != null) {
      if (c.value.isStreamingImages) unawaited(c.stopImageStream().catchError((_) {}));
      unawaited(c.dispose());
    }
    unawaited(_recognizer.close());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final c = _controller;
    if (c == null || !c.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      _controller = null;
      unawaited(c.dispose());
    } else if (state == AppLifecycleState.resumed) {
      unawaited(_start());
    }
  }

  Future<void> _start() async {
    try {
      final cameras = await availableCameras();
      _camera = cameras.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => cameras.first);
      final controller = CameraController(
        _camera!,
        ResolutionPreset.veryHigh, // texte des étiquettes : il faut une image nette
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid ? ImageFormatGroup.nv21 : ImageFormatGroup.bgra8888,
      );
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      _controller = controller;
      await controller.startImageStream(_onFrame);
      setState(() => _phase = _phase == _Phase.starting ? _Phase.scanning : _phase);
    } on CameraException catch (e) {
      if (!mounted) return;
      setState(() {
        _cameraError = e.code.contains('Access')
            ? tr("L'accès à la caméra est refusé. Autorisez-le dans les réglages du téléphone, ou prenez une photo de l'étiquette.")
            : tr("Impossible de démarrer la caméra. Prenez plutôt une photo de l'étiquette.");
      });
    } catch (_) {
      if (mounted) setState(() => _cameraError = tr("Aucune caméra disponible. Prenez plutôt une photo de l'étiquette."));
    }
  }

  InputImage? _inputImage(CameraImage image) {
    final camera = _camera;
    if (camera == null) return null;
    final rotation = InputImageRotationValue.fromRawValue(camera.sensorOrientation);
    final format = InputImageFormatValue.fromRawValue(image.format.raw as int);
    if (rotation == null || format == null || image.planes.length != 1) return null;
    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  Future<void> _onFrame(CameraImage image) async {
    final now = DateTime.now();
    if (_busy || (_phase != _Phase.scanning && _phase != _Phase.result) || now.difference(_lastFrame) < _minInterval) return;
    final input = _inputImage(image);
    if (input == null) return;
    _busy = true;
    _lastFrame = now;
    try {
      final recognized = await _recognizer.processImage(input);
      if (!mounted) return;
      final quarter = (_camera?.sensorOrientation ?? 0) % 180 != 0;
      final upright = quarter ? Size(image.height.toDouble(), image.width.toDouble()) : Size(image.width.toDouble(), image.height.toDouble());
      final lines = [
        for (final b in recognized.blocks)
          for (final l in b.lines) (text: l.text, box: l.boundingBox),
      ];
      final box = labelBox(lines);
      final comp = compositionInText(recognized.text);
      setState(() {
        _imageSize = upright;
        _box = box ?? (_phase == _Phase.result ? _box : null);
        if (_phase == _Phase.scanning) {
          _seen = comp.seen;
          if (comp.preview != null) _preview = comp.preview;
        }
      });
      final key = comp.preview ?? '';
      final tooSoon = key == _lastSent && DateTime.now().difference(_lastSentAt) < _retryAfter;
      if (_phase == _Phase.scanning && comp.complete && _category != null && !tooSoon) {
        await _send(recognized.text, key);
      }
    } catch (_) {
      // image illisible : on passe à la suivante
    } finally {
      _busy = false;
    }
  }

  Future<void> _send(String text, String key) async {
    final controller = _controller;
    final category = _category;
    if (controller == null || category == null) return;
    _lastSent = key;
    _lastSentAt = DateTime.now();
    setState(() => _phase = _Phase.sending);
    try {
      // photo nette de l'étiquette, gardée pour vérification
      if (controller.value.isStreamingImages) await controller.stopImageStream();
      final shot = await controller.takePicture();
      final photo = await shot.readAsBytes();
      final product = await Api.instance.readLabel(text: text, photo: photo, category: category, ean: widget.ean);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Api.instance.track('label_live_read', ean: product.ean, grade: product.globalGrade);
      unawaited(LocalStore.addToHistory(
        HistoryEntry(ean: product.ean, name: product.name, brand: product.brand.name, grade: product.globalGrade, at: DateTime.now()),
      ));
      setState(() {
        _product = product;
        _message = null;
        _phase = _Phase.result;
      });
    } on ServiceError catch (e) {
      if (!mounted) return;
      final retry = const ['composition_incomplete', 'composition_introuvable', 'illisible'].contains(e.code);
      setState(() {
        _message = retry ? tr("Lecture imprécise : rapprochez-vous et gardez l'étiquette bien à plat.") : e.message;
        _phase = retry ? _Phase.scanning : _Phase.failed;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _message = tr('Pas de connexion : vérifiez Internet puis réessayez.');
        _phase = _Phase.failed;
      });
    }
    // la lecture continue : nouvel essai (scanning) ou suivi de l'étiquette pour garder la note dessus (result)
    final c = _controller;
    if (mounted && c != null && !c.value.isStreamingImages && _phase != _Phase.failed) {
      await c.startImageStream(_onFrame);
    }
  }

  Future<void> _restart() async {
    setState(() {
      _product = null;
      _message = null;
      _preview = null;
      _seen = false;
      _box = null;
      _lastSent = '';
      _phase = _Phase.scanning;
    });
    final c = _controller;
    if (c != null && !c.value.isStreamingImages) await c.startImageStream(_onFrame);
  }

  Future<void> _chooseCategory(String c) async {
    setState(() => _category = c);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_categoryKey, c);
  }

  Future<void> _toggleTorch() async {
    final c = _controller;
    if (c == null) return;
    try {
      await c.setFlashMode(_torch ? FlashMode.off : FlashMode.torch);
      setState(() => _torch = !_torch);
    } catch (_) {
      // lampe indisponible sur cet appareil
    }
  }

  void _openPhoto() {
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => LabelScanScreen(ean: widget.ean)));
  }

  /// Cadre de l'étiquette à l'écran (aperçu affiché en « cover »).
  Rect? _boxOnScreen(Size view) {
    final b = _box;
    final img = _imageSize;
    if (b == null || img == null || img.isEmpty) return null;
    final scale = math.max(view.width / img.width, view.height / img.height);
    final dx = (view.width - img.width * scale) / 2;
    final dy = (view.height - img.height * scale) / 2;
    return Rect.fromLTRB(b.left * scale + dx, b.top * scale + dy, b.right * scale + dx, b.bottom * scale + dy).inflate(10);
  }

  String get _hint {
    if (_phase == _Phase.starting) return tr('Ouverture de la caméra…');
    if (_phase == _Phase.sending) return tr('Composition lue : calcul de la note avec Ecobalyse…');
    if (_message != null) return _message!;
    if (_preview != null && _category == null) {
      return tr('Composition lue : {composition}. Choisissez le type de vêtement.', {'composition': _preview});
    }
    if (_seen) return tr("Lecture en cours… Rapprochez-vous et gardez l'étiquette nette.");
    return tr("Visez l'étiquette de composition (ex. « 100 % coton »). La note s'affiche dessus.");
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _cameraError != null
          ? _CameraProblem(message: _cameraError!, onPhoto: _openPhoto)
          : LayoutBuilder(
              builder: (context, constraints) {
                final view = constraints.biggest;
                final controller = _controller;
                final box = _boxOnScreen(view);
                final top = MediaQuery.paddingOf(context).top + _topReserved;
                final done = _phase == _Phase.sending || _phase == _Phase.result;
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    if (controller != null && controller.value.isInitialized && controller.value.previewSize != null)
                      ClipRect(
                        child: FittedBox(
                          fit: BoxFit.cover,
                          child: SizedBox(
                            width: controller.value.previewSize!.height,
                            height: controller.value.previewSize!.width,
                            child: CameraPreview(controller),
                          ),
                        ),
                      ),
                    IgnorePointer(child: CustomPaint(painter: _LabelPainter(box: box, done: done, view: view))),
                    if (box != null && (_phase == _Phase.sending || (_phase == _Phase.result && _product != null)))
                      _badge(box, view, top),
                    Positioned(left: 0, right: 0, top: 0, child: _topBar(context)),
                    Positioned(left: 0, right: 0, bottom: 0, child: _bottomPanel(context)),
                  ],
                );
              },
            ),
    );
  }

  Widget _badge(Rect box, Size view, double top) {
    final origin = badgeOrigin(barcode: box, viewSize: view, badgeSize: _badgeSize, topLimit: top, bottomReserved: _bottomReserved);
    final p = _product;
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 150),
      left: origin.dx,
      top: origin.dy,
      width: _badgeSize.width,
      height: _badgeSize.height,
      child: Material(
        color: Colors.white,
        elevation: 6,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: p == null ? null : () => openProduct(context, p.ean, countScan: false),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                if (p != null)
                  GradeBadge(grade: p.globalGrade, size: 44, round: true)
                else
                  const SizedBox(
                    width: 44,
                    height: 44,
                    child: Padding(padding: EdgeInsets.all(10), child: CircularProgressIndicator(strokeWidth: 3, color: VT.green)),
                  ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p == null ? tr('Calcul de la note…') : verdicts[p.globalGrade]!.$1,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: VT.ink)),
                      Text(db(p?.composition ?? _preview),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: VT.muted)),
                    ],
                  ),
                ),
                if (p != null) const Icon(Icons.chevron_right, color: VT.muted2),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _topBar(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: Row(
          children: [
            _Round(icon: Icons.arrow_back, label: tr('Retour'), onPressed: () => Navigator.of(context).maybePop()),
            Expanded(
              child: Text(tr("Visez l'étiquette cousue"),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
            ),
            _Round(
              icon: _torch ? Icons.flashlight_off : Icons.flashlight_on,
              label: _torch ? tr('Éteindre la lampe') : tr('Allumer la lampe'),
              onPressed: _toggleTorch,
            ),
          ],
        ),
      ),
    );
  }

  Widget _bottomPanel(BuildContext context) {
    final p = _product;
    final List<Widget> children;
    if (_phase == _Phase.result && p != null) {
      children = [
        Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => openProduct(context, p.ean, countScan: false),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  GradeBadge(grade: p.globalGrade, size: 44),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(db(p.name), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: VT.ink)),
                        Text(
                          [
                            if (!p.originCountry.toLowerCase().startsWith('non ')) bidi(p.originCountry),
                            tr('touchez pour voir la fiche'),
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
        TextButton(
          onPressed: _restart,
          style: TextButton.styleFrom(foregroundColor: const Color(0xFFC9D4CD)),
          child: Text(tr('Lire une autre étiquette')),
        ),
      ];
    } else if (_phase == _Phase.failed) {
      children = [
        Text(_message ?? tr('Erreur inattendue.'),
            textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 15)),
        const SizedBox(height: 10),
        FilledButton(onPressed: _restart, child: Text(tr('Réessayer'))),
      ];
    } else {
      children = [
        Text(_hint, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.4)),
        const SizedBox(height: 10),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: contributionCategories.length,
            separatorBuilder: (context, i) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final c = contributionCategories[i];
              final on = c == _category;
              return ChoiceChip(
                label: Text(tv(c)),
                selected: on,
                onSelected: (_) => _chooseCategory(c),
                selectedColor: VT.mint,
                backgroundColor: const Color(0x8C0F1A14),
                labelStyle: TextStyle(color: on ? VT.ink : Colors.white, fontWeight: on ? FontWeight.w700 : FontWeight.w500),
                side: BorderSide(color: on ? VT.mint : Colors.white54),
                showCheckmark: false,
              );
            },
          ),
        ),
        TextButton.icon(
          onPressed: _openPhoto,
          style: TextButton.styleFrom(foregroundColor: const Color(0xFFC9D4CD)),
          icon: const Icon(Icons.photo_camera_outlined, size: 18),
          label: Text(tr('Prendre une photo à la place')),
        ),
      ];
    }
    return Container(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 12 + MediaQuery.paddingOf(context).bottom),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x00000000), Color(0xCC000000)],
        ),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
    );
  }
}

/// Cadre de visée (pointillés) tant que rien n'est lu, puis cadre autour de l'étiquette :
/// jaune pendant la lecture, vert quand la composition est complète.
class _LabelPainter extends CustomPainter {
  final Rect? box;
  final bool done;
  final Size view;
  _LabelPainter({required this.box, required this.done, required this.view});

  @override
  void paint(Canvas canvas, Size size) {
    final b = box;
    if (b == null) {
      final guide = RRect.fromRectAndRadius(
        Rect.fromLTWH(view.width * 0.08, view.height * 0.19, view.width * 0.84, view.height * 0.45),
        const Radius.circular(18),
      );
      final paint = Paint()
        ..color = Colors.white70
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3;
      canvas.drawRRect(guide, paint);
      return;
    }
    final color = done ? VT.mint : const Color(0xFFF2C94C);
    final rrect = RRect.fromRectAndRadius(b, const Radius.circular(12));
    canvas.drawRRect(rrect, Paint()..color = color.withValues(alpha: 0.12));
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(covariant _LabelPainter old) => old.box != box || old.done != done || old.view != view;
}

class _Round extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  const _Round({required this.icon, required this.label, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0x66000000),
      shape: const CircleBorder(),
      child: IconButton(tooltip: label, icon: Icon(icon, color: Colors.white), onPressed: onPressed),
    );
  }
}

class _CameraProblem extends StatelessWidget {
  final String message;
  final VoidCallback onPhoto;
  const _CameraProblem({required this.message, required this.onPhoto});

  @override
  Widget build(BuildContext context) {
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
              FilledButton(onPressed: onPhoto, child: Text(tr('Prendre une photo à la place'))),
              TextButton(
                onPressed: () => Navigator.of(context).maybePop(),
                style: TextButton.styleFrom(foregroundColor: Colors.white70),
                child: Text(tr('Retour')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
