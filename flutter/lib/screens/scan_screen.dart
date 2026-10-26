import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../barcode.dart';
import '../models.dart';
import '../navigation.dart';
import '../storage.dart';
import '../theme.dart';
import '../widgets.dart';
import 'not_found_screen.dart';

// Produits fictifs présents en base, pour tester sans étiquette sous la main.
const _examples = [
  ('2001000000012', 'T-shirt col rond', 'Urbanline', Grade.D),
  ('2004000000044', 'Robe moulante', 'Flashwear', Grade.E),
  ('2005000000010', 'T-shirt col V', 'Pulse & Co', Grade.B),
];

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  MobileScannerController? _controller;
  bool _handled = false;
  bool _manualOpen = false;
  String? _manualError;
  final _codeField = TextEditingController();
  List<HistoryEntry> _history = [];

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _controller?.dispose();
    _codeField.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    final h = await LocalStore.history();
    if (mounted) setState(() => _history = h);
  }

  void _startScan() {
    setState(() {
      _handled = false;
      _controller = MobileScannerController(
        formats: const [BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.upcA],
        detectionSpeed: DetectionSpeed.noDuplicates,
      );
    });
  }

  void _stopScan() {
    final c = _controller;
    setState(() => _controller = null);
    // libéré après le retrait de l'aperçu caméra de l'écran
    WidgetsBinding.instance.addPostFrameCallback((_) => c?.dispose());
  }

  Future<void> _open(String ean) async {
    await openProduct(context, ean);
    _loadHistory();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null) continue;
      final code = normalizeGtin(raw);
      if (isValidGtin(code)) {
        _handled = true;
        HapticFeedback.mediumImpact();
        _stopScan();
        _open(code);
        return;
      }
    }
  }

  void _submitManual() {
    final code = normalizeGtin(_codeField.text);
    if (!isValidGtin(code)) {
      setState(() => _manualError = 'Ce code ne ressemble pas à un code-barres valide (8, 12 ou 13 chiffres).');
      return;
    }
    _open(code);
  }

  @override
  Widget build(BuildContext context) {
    final scanning = _controller != null;
    return Scaffold(
      backgroundColor: VT.ink,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
              child: Row(
                children: [
                  const Icon(Icons.verified_outlined, color: VT.mint, size: 28),
                  const SizedBox(width: 10),
                  const Text('VeriTrace',
                      style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFF2E4237)),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text('Démo', style: TextStyle(color: Color(0xFFA9B8AE), fontSize: 13)),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: Container(
                  height: 380,
                  color: VT.ink2,
                  child: scanning
                      ? Stack(
                          fit: StackFit.expand,
                          children: [
                            MobileScanner(controller: _controller, onDetect: _onDetect),
                            const _ScanFrame(),
                          ],
                        )
                      : const Center(child: Icon(Icons.qr_code_scanner, size: 120, color: Color(0xFF6E7F74))),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
              child: Text(
                scanning ? "Visez le code-barres de l'étiquette" : "Scannez le code-barres sur l'étiquette d'un vêtement",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFA9B8AE), fontSize: 15),
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                color: VT.ground,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (scanning)
                    OutlinedButton(onPressed: _stopScan, child: const Text('Arrêter le scan'))
                  else
                    FilledButton.icon(
                      onPressed: _startScan,
                      icon: const Icon(Icons.qr_code_scanner),
                      label: const Text("Scanner l'article"),
                    ),
                  const SizedBox(height: 8),
                  if (_manualOpen) _manualForm() else TextButton.icon(
                    onPressed: () => setState(() => _manualOpen = true),
                    icon: const Icon(Icons.keyboard_outlined, size: 20),
                    label: const Text('Saisir le code à la main'),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _history.isNotEmpty ? 'DERNIERS SCANS' : 'EXEMPLES À TESTER',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 1, color: VT.muted2),
                  ),
                  const SizedBox(height: 10),
                  if (_history.isNotEmpty)
                    for (final h in _history.take(4))
                      _Row(
                        grade: h.grade,
                        title: h.name ?? 'EAN ${formatEan(h.ean)}',
                        subtitle: '${h.brand ?? 'Non référencé'} · ${timeAgo(h.at)}',
                        onTap: () async {
                          if (h.grade == null) {
                            await Navigator.of(context)
                                .push(MaterialPageRoute(builder: (_) => NotFoundScreen(ean: h.ean)));
                          } else {
                            await openProduct(context, h.ean, countScan: false);
                          }
                          _loadHistory();
                        },
                      )
                  else
                    for (final ex in _examples)
                      _Row(grade: ex.$4, title: ex.$2, subtitle: '${ex.$3} · produit fictif', onTap: () => _open(ex.$1)),
                  if (_history.isNotEmpty)
                    TextButton(
                      onPressed: () async {
                        await LocalStore.resetDemo();
                        _loadHistory();
                      },
                      style: TextButton.styleFrom(foregroundColor: VT.muted2),
                      child: const Text('Réinitialiser la démo', style: TextStyle(fontWeight: FontWeight.w500)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _manualForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Code-barres', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _codeField,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(14)],
                onChanged: (_) => setState(() => _manualError = null),
                onSubmitted: (_) => _submitManual(),
                decoration: InputDecoration(
                  hintText: 'Ex. : 2001000000012',
                  errorText: _manualError,
                  errorMaxLines: 2,
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: _submitManual,
                style: FilledButton.styleFrom(minimumSize: const Size(88, 52)),
                child: const Text('Valider'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  final Grade? grade;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _Row({required this.grade, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: CardBox(
        padding: const EdgeInsets.all(12),
        onTap: onTap,
        child: Row(
          children: [
            GradeBadge(grade: grade),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(fontSize: 13, color: VT.muted2)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: VT.muted2),
          ],
        ),
      ),
    );
  }
}

/// Coins du viseur, dessinés au-dessus de l'image caméra.
class _ScanFrame extends StatelessWidget {
  const _ScanFrame();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: FractionallySizedBox(
          widthFactor: 0.76,
          heightFactor: 0.4,
          child: CustomPaint(painter: _CornerPainter()),
        ),
      ),
    );
  }
}

class _CornerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = VT.mint
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const l = 28.0;
    final w = size.width, h = size.height;
    canvas.drawPath(Path()..moveTo(0, l)..lineTo(0, 0)..lineTo(l, 0), p);
    canvas.drawPath(Path()..moveTo(w - l, 0)..lineTo(w, 0)..lineTo(w, l), p);
    canvas.drawPath(Path()..moveTo(w, h - l)..lineTo(w, h)..lineTo(w - l, h), p);
    canvas.drawPath(Path()..moveTo(l, h)..lineTo(0, h)..lineTo(0, h - l), p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
