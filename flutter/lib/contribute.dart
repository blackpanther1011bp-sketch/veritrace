// Ajout d'un vêtement depuis l'app : listes proposées et contrôle de la composition
// (mêmes règles que la web app). Les catégories et pays restent en français (valeurs envoyées au serveur) ;
// tv() les affiche en arabe dans l'interface arabe.

import 'l10n.dart';

/// Catégories proposées (reconnues par le calcul Ecobalyse).
const contributionCategories = [
  'T-shirt',
  'Polo',
  'Chemise',
  'Blouse',
  'Robe',
  'Jupe',
  'Jean',
  'Pantalon',
  'Short',
  'Pull',
  'Sweat',
  'Gilet',
  'Veste',
  'Manteau',
  'Maillot de bain',
  'Chaussettes',
  'Boxer / Slip',
];

/// Pays fréquents sur les étiquettes (suggestions, la saisie reste libre).
const contributionCountries = [
  'Maroc',
  'Turquie',
  'Chine',
  'Bangladesh',
  'Inde',
  'Pakistan',
  'Vietnam',
  'Cambodge',
  'Tunisie',
  'Égypte',
  'Sri Lanka',
  'Indonésie',
  'Myanmar',
  'Portugal',
  'Espagne',
  'Italie',
  'France',
];

/// Contrôle simple avant envoi : les pourcentages doivent faire 100 %.
/// Une seule matière sans pourcentage (« coton ») est acceptée. Renvoie null si tout va bien.
String? checkComposition(String text) {
  final value = text.trim();
  if (value.length < 3) return tr("Recopiez la composition écrite sur l'étiquette.");
  if (!RegExp(r'[a-zA-ZÀ-ÿ]').hasMatch(value)) return tr('Indiquez aussi les matières (coton, polyester…).');
  final percents = RegExp(r'(\d+(?:[.,]\d+)?)\s*%')
      .allMatches(value)
      .map((m) => double.parse(m.group(1)!.replaceAll(',', '.')))
      .toList();
  if (percents.isEmpty) {
    return RegExp(r'\d').hasMatch(value) ? tr('Ajoutez le signe % après chaque pourcentage.') : null;
  }
  final total = percents.fold<double>(0, (s, n) => s + n);
  if (total < 99 || total > 101) {
    final shown = (total * 10).round() / 10;
    final label = shown == shown.roundToDouble() ? shown.toInt().toString() : shown.toString().replaceAll('.', ',');
    return tr('Les pourcentages font {n} % au lieu de 100 %.', {'n': label});
  }
  return null;
}
