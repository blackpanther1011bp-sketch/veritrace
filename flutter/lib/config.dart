import 'l10n.dart';

/// Configuration du projet Supabase « veritrace ».
///
/// La clé publishable est publique par conception : la sécurité repose sur
/// les règles RLS de la base (lecture seule du catalogue, écriture limitée
/// aux signalements et aux événements d'usage).
class AppConfig {
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://vqegfoncyrqivtrbvorg.supabase.co',
  );
  static const supabaseKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue: 'sb_publishable_8qXYZf-_89RyBG8poHxY3Q_bVWAVbnZ',
  );

  /// Adresse de la version web (passeports numériques, espace fabricants).
  static const siteUrl = 'https://veritrace-wine.vercel.app';

  /// Nombre d'alternatives visibles sans Premium.
  static const freeAlternatives = 1;

  /// Libellé du tarif Premium, à remplacer par le vrai prix.
  static String get premiumPriceLabel => tr('Tarif à définir');
}
