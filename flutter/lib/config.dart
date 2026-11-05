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

  /// Suivi des erreurs (Sentry, projet veritrace-app, région Europe). Public par conception : ne permet que
  /// d'envoyer des erreurs, pas de les lire. Utilisé seulement dans l'app publiée (pas en développement).
  static const sentryDsn = String.fromEnvironment(
    'SENTRY_DSN',
    defaultValue: 'https://5b18e9bdafafe3d4ac94662f113798ef@o4512380700721152.ingest.de.sentry.io/4512380737159248',
  );

  /// Adresse de la version web (passeports numériques, espace fabricants).
  static const siteUrl = 'https://veritrace-wine.vercel.app';

  /// Nombre d'alternatives visibles sans Premium.
  static const freeAlternatives = 1;

  /// Libellé du tarif Premium, à remplacer par le vrai prix.
  static String get premiumPriceLabel => tr('Tarif à définir');
}
