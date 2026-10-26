import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../barcode.dart';
import '../models.dart';
import '../navigation.dart';
import '../storage.dart';
import '../theme.dart';
import '../widgets.dart';
import 'ar_scan_screen.dart';
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
    _codeField.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    final h = await LocalStore.history();
    if (mounted) setState(() => _history = h);
  }

  /// Ouvre le scan en réalité augmentée (caméra plein écran).
  Future<void> _startScan() async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ArScanScreen()));
    _loadHistory();
  }

  Future<void> _open(String ean) async {
    await openProduct(context, ean);
    _loadHistory();
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
                  height: 300,
                  color: VT.ink2,
                  child: const _ArPreview(),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
              child: Text(
                "Visez l'étiquette d'un vêtement : sa note s'affiche directement sur l'image de la caméra.",
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

/// Aperçu de l'expérience : une note flottant au-dessus d'un code-barres.
class _ArPreview extends StatelessWidget {
  const _ArPreview();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: "Aperçu : la note du vêtement s'affiche au-dessus de son code-barres",
      excludeSemantics: true,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 190,
            height: 120,
            decoration: BoxDecoration(
              color: const Color(0xFFEDEAE2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: VT.mint, width: 3),
            ),
            child: const Icon(Icons.view_week, size: 84, color: VT.ink),
          ),
          Positioned(
            top: 48,
            child: Container(
              padding: const EdgeInsets.fromLTRB(8, 8, 14, 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 4))],
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GradeBadge(grade: Grade.D, size: 36, round: true),
                  SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Impact élevé', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: VT.ink)),
                      Text('Carbone D · Social E', style: TextStyle(fontSize: 12, color: VT.muted)),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
