import 'package:flutter/material.dart';

import '../api.dart';
import '../barcode.dart';
import '../theme.dart';
import '../widgets.dart';

class NotFoundScreen extends StatefulWidget {
  final String ean;
  const NotFoundScreen({super.key, required this.ean});

  @override
  State<NotFoundScreen> createState() => _NotFoundScreenState();
}

enum _Status { idle, sending, sent, error }

class _NotFoundScreenState extends State<NotFoundScreen> {
  final _brand = TextEditingController();
  _Status _status = _Status.idle;

  @override
  void dispose() {
    _brand.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _status = _Status.sending);
    try {
      await Api.instance.reportMissingProduct(widget.ean, _brand.text);
      Api.instance.track('report_sent', ean: widget.ean);
      if (mounted) setState(() => _status = _Status.sent);
    } catch (_) {
      if (mounted) setState(() => _status = _Status.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Résultat du scan')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          const CircleAvatar(
            radius: 44,
            backgroundColor: VT.line,
            child: Icon(Icons.help_outline, size: 40, color: VT.muted),
          ),
          const SizedBox(height: 14),
          const Text('Article pas encore référencé',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          const Text(
            "Ce code-barres n'est pas encore dans notre base. Signalez-le : nous l'ajouterons en priorité.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, color: VT.muted, height: 1.45),
          ),
          const SizedBox(height: 12),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: VT.line, borderRadius: BorderRadius.circular(999)),
              child: Text('EAN ${formatEan(widget.ean)}', style: const TextStyle(fontSize: 13, color: VT.muted)),
            ),
          ),
          const SizedBox(height: 18),
          if (_status == _Status.sent)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: VT.mintTint, borderRadius: BorderRadius.circular(14)),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(radius: 18, backgroundColor: VT.green, child: Icon(Icons.check, color: Colors.white, size: 20)),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Merci, c'est envoyé !", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        SizedBox(height: 4),
                        Text('Cet article rejoint la liste des produits à analyser.',
                            style: TextStyle(color: Color(0xFF1E4A35))),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else
            CardBox(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Marque (facultatif)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _brand,
                    maxLength: 80,
                    decoration: InputDecoration(
                      hintText: "Celle écrite sur l'étiquette",
                      counterText: '',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  if (_status == _Status.error)
                    const Padding(
                      padding: EdgeInsets.only(top: 10),
                      child: Text("L'envoi a échoué. Vérifiez votre connexion puis réessayez.",
                          style: TextStyle(color: VT.danger)),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _status == _Status.sending ? null : _submit,
                    child: Text(_status == _Status.sending ? 'Envoi…' : 'Signaler cet article'),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
            child: const Text('Scanner un autre article'),
          ),
        ],
      ),
    );
  }
}
