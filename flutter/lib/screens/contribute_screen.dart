import 'package:flutter/foundation.dart' show Uint8List;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../barcode.dart';
import '../contribute.dart';
import '../l10n.dart';
import '../theme.dart';
import '../widgets.dart';

/// Ajout d'un vêtement absent de la base : l'utilisateur recopie l'étiquette,
/// l'équipe vérifie, puis la note est calculée avec Ecobalyse.
class ContributeScreen extends StatefulWidget {
  final String ean;
  const ContributeScreen({super.key, required this.ean});

  @override
  State<ContributeScreen> createState() => _ContributeScreenState();
}

enum _Status { idle, sending, sent, error }

class _ContributeScreenState extends State<ContributeScreen> {
  final _brand = TextEditingController();
  final _name = TextEditingController();
  final _composition = TextEditingController();
  final _country = TextEditingController();
  String? _category;
  Uint8List? _photo;
  String? _photoError;
  bool _touched = false;
  _Status _status = _Status.idle;

  @override
  void initState() {
    super.initState();
    Api.instance.track('contribution_start', ean: widget.ean);
    for (final c in [_brand, _name, _composition]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    for (final c in [_brand, _name, _composition, _country]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _brandMissing => _brand.text.trim().isEmpty;
  bool get _nameMissing => _name.text.trim().isEmpty;
  bool get _categoryMissing => _category == null;
  String? get _compositionError => checkComposition(_composition.text);
  bool get _valid => !_brandMissing && !_nameMissing && !_categoryMissing && _compositionError == null;

  Future<void> _takePhoto() async {
    setState(() => _photoError = null);
    try {
      final shot = await ImagePicker().pickImage(
        source: ImageSource.camera,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 82,
      );
      if (shot == null) return;
      final bytes = await shot.readAsBytes();
      if (mounted) setState(() => _photo = bytes);
    } catch (_) {
      if (mounted) setState(() => _photoError = tr("La photo n'a pas pu être prise. Réessayez."));
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _touched = true);
    if (!_valid) return;
    setState(() => _status = _Status.sending);
    try {
      final photo = _photo;
      final photoPath = photo == null ? null : await Api.instance.uploadLabelPhoto(photo);
      await Api.instance.submitContribution(
        ean: widget.ean,
        brandName: _brand.text,
        name: _name.text,
        category: _category!,
        composition: _composition.text,
        countryMaking: _country.text,
        photoPath: photoPath,
      );
      Api.instance.track('contribution_sent', ean: widget.ean);
      if (mounted) setState(() => _status = _Status.sent);
    } catch (_) {
      if (mounted) setState(() => _status = _Status.error);
    }
  }

  InputDecoration _decoration(String hint, {bool error = false}) => InputDecoration(
        hintText: hint,
        counterText: '',
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: error
            ? OutlineInputBorder(
                borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: VT.danger, width: 1.5))
            : null,
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsetsDirectional.only(bottom: 6),
        child: Text(text, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      );

  Widget _error(String text) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(text, style: const TextStyle(fontSize: 13, color: VT.danger)),
      );

  Widget _help(String text) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(text, style: const TextStyle(fontSize: 13, color: VT.muted2)),
      );

  @override
  Widget build(BuildContext context) {
    if (_status == _Status.sent) return _sent(context);
    final compositionError = _compositionError;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Ajouter ce vêtement'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        children: [
          Text(
            tr("Recopiez l'étiquette cousue à l'intérieur du vêtement. Nous vérifions chaque ajout avant de le noter."),
            style: const TextStyle(fontSize: 15, color: VT.muted, height: 1.45),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: VT.line, borderRadius: BorderRadius.circular(999)),
              child: Text(tr('EAN {code}', {'code': formatEan(widget.ean)}),
                  style: const TextStyle(fontSize: 13, color: VT.muted)),
            ),
          ),
          const SizedBox(height: 14),
          CardBox(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _label(tr('Marque')),
                TextField(
                  controller: _brand,
                  maxLength: 80,
                  textCapitalization: TextCapitalization.words,
                  decoration: _decoration(tr('Ex. Defacto, Zara, Marwa…'), error: _touched && _brandMissing),
                ),
                if (_touched && _brandMissing) _error(tr('Indiquez la marque.')),
                const SizedBox(height: 16),
                _label(tr('Nom du vêtement')),
                TextField(
                  controller: _name,
                  maxLength: 120,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: _decoration(tr('Ex. T-shirt col rond noir'), error: _touched && _nameMissing),
                ),
                if (_touched && _nameMissing) _error(tr('Donnez un nom au vêtement.')),
                const SizedBox(height: 16),
                _label(tr('Catégorie')),
                InputDecorator(
                  decoration: _decoration('', error: _touched && _categoryMissing)
                      .copyWith(contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4)),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _category,
                      isExpanded: true,
                      hint: Text(tr('Choisir…')),
                      // valeur envoyée en français, libellé dans la langue choisie
                      items: [
                        for (final c in contributionCategories) DropdownMenuItem(value: c, child: Text(tv(c))),
                      ],
                      onChanged: (v) => setState(() => _category = v),
                    ),
                  ),
                ),
                if (_touched && _categoryMissing) _error(tr('Choisissez une catégorie.')),
                const SizedBox(height: 16),
                _label(tr('Composition')),
                TextField(
                  controller: _composition,
                  maxLength: 300,
                  // recopiée de l'étiquette (lettres latines) : de gauche à droite, même dans l'interface arabe
                  textDirection: TextDirection.ltr,
                  decoration:
                      _decoration(tr('Ex. 60 % coton, 40 % polyester'), error: _touched && compositionError != null),
                ),
                if (_touched && compositionError != null)
                  _error(compositionError)
                else
                  _help(tr("Telle qu'écrite sur l'étiquette, avec les pourcentages.")),
                const SizedBox(height: 16),
                _label(tr('Fabriqué en (facultatif)')),
                Autocomplete<String>(
                  // pays proposés en français (valeur enregistrée) ; on peut aussi commencer à le taper en arabe
                  optionsBuilder: (value) {
                    final q = value.text.trim().toLowerCase();
                    if (q.isEmpty) return const Iterable<String>.empty();
                    return contributionCountries.where((c) => c.toLowerCase().startsWith(q) || tv(c).startsWith(q));
                  },
                  onSelected: (v) => _country.text = v,
                  fieldViewBuilder: (context, controller, focusNode, onSubmit) {
                    return TextField(
                      controller: controller,
                      focusNode: focusNode,
                      onChanged: (v) => _country.text = v,
                      maxLength: 40,
                      textCapitalization: TextCapitalization.words,
                      decoration: _decoration(tr('Ex. Maroc, Turquie, Bangladesh…')),
                    );
                  },
                ),
                const SizedBox(height: 16),
                _label(tr("Photo de l'étiquette (facultatif)")),
                if (_photo != null)
                  Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.memory(_photo!, width: 96, height: 96, fit: BoxFit.cover),
                      ),
                      const SizedBox(width: 12),
                      TextButton(onPressed: _takePhoto, child: Text(tr('Reprendre'))),
                    ],
                  )
                else
                  OutlinedButton.icon(
                    onPressed: _takePhoto,
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: Text(tr("Prendre l'étiquette en photo")),
                  ),
                _photoError != null ? _error(_photoError!) : _help(tr('Elle sert uniquement à vérifier votre saisie.')),
                if (_status == _Status.error) ...[
                  const SizedBox(height: 12),
                  Text(tr("L'envoi a échoué. Vérifiez votre connexion puis réessayez."),
                      style: const TextStyle(color: VT.danger)),
                ],
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: FilledButton(
            onPressed: _status == _Status.sending ? null : _submit,
            child: Text(_status == _Status.sending ? tr('Envoi…') : tr('Envoyer pour vérification')),
          ),
        ),
      ),
    );
  }

  Widget _sent(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('Ajouter ce vêtement'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
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
                      Text(
                        tr("L'équipe VeriTrace vérifie votre ajout, puis le vêtement est noté avec Ecobalyse, la méthode officielle française."),
                        style: const TextStyle(color: Color(0xFF1E4A35)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: FilledButton(
            onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
            child: Text(tr('Scanner un autre article')),
          ),
        ),
      ),
    );
  }
}
