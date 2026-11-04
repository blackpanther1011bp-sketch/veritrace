import 'package:flutter/foundation.dart' show Uint8List;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../barcode.dart';
import '../contribute.dart';
import '../label_reader.dart';
import '../theme.dart';
import '../widgets.dart';
import 'contribute_screen.dart';
import 'product_screen.dart';

/// Lecture de l'étiquette cousue : photo (composition, « Made in ») et type de vêtement, lecture du texte
/// sur le téléphone, puis calcul de la note avec Ecobalyse. Marche pour n'importe quel vêtement.
class LabelScanScreen extends StatefulWidget {
  final String? ean;
  const LabelScanScreen({super.key, this.ean});

  @override
  State<LabelScanScreen> createState() => _LabelScanScreenState();
}

enum _Status { idle, reading, sending, error }

class _LabelScanScreenState extends State<LabelScanScreen> {
  final _brand = TextEditingController();
  String? _category;
  Uint8List? _photo;
  String? _photoPath;
  bool _touched = false;
  _Status _status = _Status.idle;
  String? _error;
  String? _errorCode;

  @override
  void initState() {
    super.initState();
    Api.instance.track('label_start', ean: widget.ean);
  }

  @override
  void dispose() {
    _brand.dispose();
    super.dispose();
  }

  bool get _busy => _status == _Status.reading || _status == _Status.sending;

  Future<void> _takePhoto() async {
    setState(() => _error = null);
    try {
      final shot = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1600, maxHeight: 1600, imageQuality: 82);
      if (shot == null) return;
      final bytes = await shot.readAsBytes();
      if (mounted) {
        setState(() {
          _photo = bytes;
          _photoPath = shot.path;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = "La photo n'a pas pu être prise. Réessayez.");
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _touched = true);
    final photo = _photo;
    final path = _photoPath;
    final category = _category;
    if (photo == null || path == null || category == null) return;
    setState(() {
      _status = _Status.reading;
      _error = null;
      _errorCode = null;
    });
    String text;
    try {
      text = await readLabelTextFromFile(path);
    } catch (_) {
      _fail('ocr', 'La lecture du texte a échoué : reprenez la photo.');
      return;
    }
    if (!mounted) return;
    setState(() => _status = _Status.sending);
    try {
      final product = await Api.instance.readLabel(text: text, photo: photo, category: category, ean: widget.ean, brand: _brand.text);
      Api.instance.track('label_read', ean: product.ean, grade: product.globalGrade);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => ProductScreen(ean: product.ean)));
    } on ServiceError catch (e) {
      _fail(e.code, e.message);
    } catch (_) {
      _fail('reseau', 'Pas de connexion : vérifiez Internet puis réessayez.');
    }
  }

  void _fail(String code, String message) {
    Api.instance.track('label_failed', ean: widget.ean);
    if (!mounted) return;
    setState(() {
      _status = _Status.error;
      _error = message;
      _errorCode = code;
    });
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
      );

  Widget _errorText(String text) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(text, style: const TextStyle(fontSize: 13, color: VT.danger)),
      );

  @override
  Widget build(BuildContext context) {
    final ean = widget.ean;
    final manual = ean != null && const ['illisible', 'composition_introuvable', 'composition_incomplete', 'ocr'].contains(_errorCode);
    return Scaffold(
      appBar: AppBar(title: const Text("Lire l'étiquette")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        children: [
          const Text(
            "Photographiez l'étiquette cousue à l'intérieur du vêtement : celle qui indique la composition "
            '(ex. « 100 % coton ») et le pays de fabrication. Le texte est lu sur votre téléphone, puis la note '
            'est calculée avec la méthode officielle Ecobalyse.',
            style: TextStyle(fontSize: 15, color: VT.muted, height: 1.45),
          ),
          if (ean != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: VT.line, borderRadius: BorderRadius.circular(999)),
                child: Text('EAN ${formatEan(ean)}', style: const TextStyle(fontSize: 13, color: VT.muted)),
              ),
            ),
          ],
          const SizedBox(height: 14),
          CardBox(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _label("Photo de l'étiquette"),
                if (_photo != null) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.memory(_photo!, height: 220, fit: BoxFit.contain),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(onPressed: _busy ? null : _takePhoto, child: const Text('Reprendre la photo')),
                  ),
                ] else
                  FilledButton.icon(
                    onPressed: _takePhoto,
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Prendre la photo'),
                  ),
                if (_touched && _photo == null) _errorText("Ajoutez la photo de l'étiquette."),
                const SizedBox(height: 16),
                _label('Type de vêtement'),
                InputDecorator(
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _category,
                      isExpanded: true,
                      hint: const Text('Choisir…'),
                      items: [for (final c in contributionCategories) DropdownMenuItem(value: c, child: Text(c))],
                      onChanged: _busy ? null : (v) => setState(() => _category = v),
                    ),
                  ),
                ),
                if (_touched && _category == null) _errorText('Choisissez le type de vêtement.'),
                const SizedBox(height: 16),
                _label('Marque (facultatif)'),
                TextField(
                  controller: _brand,
                  maxLength: 80,
                  textCapitalization: TextCapitalization.words,
                  decoration: InputDecoration(
                    hintText: 'Ex. Defacto, LC Waikiki, Marwa…',
                    counterText: '',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: VT.danger, height: 1.35)),
                  if (manual)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => Navigator.of(context)
                            .pushReplacement(MaterialPageRoute(builder: (_) => ContributeScreen(ean: ean))),
                        child: const Text('Saisir la composition à la main'),
                      ),
                    ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          const MethodNote(
            text: 'Conseils : étiquette bien à plat, sans reflet, texte net. Le résultat est une estimation : poids et '
                "lieux de tissage ou de teinture ne sont pas écrits sur l'étiquette, Ecobalyse applique alors ses valeurs par défaut.",
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(switch (_status) {
                  _Status.reading => "Lecture de l'étiquette…",
                  _Status.sending => 'Calcul de la note…',
                  _ => 'Calculer la note',
                }),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
