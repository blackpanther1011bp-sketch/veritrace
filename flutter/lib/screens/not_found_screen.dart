import 'package:flutter/material.dart';

import '../api.dart';
import '../barcode.dart';
import '../l10n.dart';
import '../theme.dart';
import '../widgets.dart';
import 'contribute_screen.dart';
import 'label_live_screen.dart';
import 'label_scan_screen.dart';

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
      appBar: AppBar(title: Text(tr('Résultat du scan'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          const CircleAvatar(
            radius: 44,
            backgroundColor: VT.line,
            child: Icon(Icons.help_outline, size: 40, color: VT.muted),
          ),
          const SizedBox(height: 14),
          Text(tr('Article pas encore référencé'),
              textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Text(
            tr("Ce code-barres n'est pas encore dans notre base. Photographiez l'étiquette cousue du vêtement : sa note est calculée tout de suite."),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, color: VT.muted, height: 1.45),
          ),
          const SizedBox(height: 12),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: VT.line, borderRadius: BorderRadius.circular(999)),
              child: Text(tr('EAN {code}', {'code': formatEan(widget.ean)}),
                  style: const TextStyle(fontSize: 13, color: VT.muted)),
            ),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => LabelLiveScreen(ean: widget.ean))),
            icon: const Icon(Icons.photo_camera_outlined),
            label: Text(tr("Viser l'étiquette : note en direct")),
          ),
          TextButton(
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => LabelScanScreen(ean: widget.ean))),
            child: Text(tr("Ou prendre une photo de l'étiquette")),
          ),
          TextButton(
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => ContributeScreen(ean: widget.ean))),
            child: Text(tr("Ou saisir l'étiquette à la main")),
          ),
          const SizedBox(height: 14),
          if (_status == _Status.sent)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: VT.mintTint, borderRadius: BorderRadius.circular(14)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const CircleAvatar(
                      radius: 18, backgroundColor: VT.green, child: Icon(Icons.check, color: Colors.white, size: 20)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(tr("Merci, c'est envoyé !"), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text(tr('Cet article rejoint la liste des produits à analyser.'),
                            style: const TextStyle(color: Color(0xFF1E4A35))),
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
                  Text(tr('Pas le temps ? Signalez-le simplement.'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  Text(tr('Marque (facultatif)'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _brand,
                    maxLength: 80,
                    decoration: InputDecoration(
                      hintText: tr("Celle écrite sur l'étiquette"),
                      counterText: '',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  if (_status == _Status.error)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(tr("L'envoi a échoué. Vérifiez votre connexion puis réessayez."),
                          style: const TextStyle(color: VT.danger)),
                    ),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: _status == _Status.sending ? null : _submit,
                    child: Text(_status == _Status.sending ? tr('Envoi…') : tr('Signaler cet article')),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
            child: Text(tr('Scanner un autre article')),
          ),
        ],
      ),
    );
  }
}
