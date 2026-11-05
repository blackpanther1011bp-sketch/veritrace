import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config.dart';
import 'l10n.dart';
import 'screens/scan_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // l'app est pensée pour être tenue verticalement, comme en magasin
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await Supabase.initialize(url: AppConfig.supabaseUrl, publishableKey: AppConfig.supabaseKey);
  // langue choisie (ou celle du téléphone au premier lancement)
  await L10n.init();
  // Suivi des erreurs (Sentry), seulement dans l'app publiée. Réglage strict pour la vie privée : ni adresse IP
  // ni identité, ni capture d'écran, ni enregistrement des écrans ; seulement l'erreur, l'écran et le téléphone.
  // Pas de suivi des sessions : il compterait les ouvertures de l'app avec un identifiant d'installation.
  // Vérification : appui long sur « VeriTrace » à l'accueil (erreur de test, voir scan_screen.dart).
  await SentryFlutter.init(
    (options) {
      options.dsn = kReleaseMode ? AppConfig.sentryDsn : '';
      options.environment = kReleaseMode ? 'production' : 'development';
      options.tracesSampleRate = 0.2;
      options.sendDefaultPii = false;
      options.attachScreenshot = false;
      options.attachViewHierarchy = false;
      options.enableAutoSessionTracking = false;
      // Android ajoute de lui-même un identifiant d'installation tiré au hasard : retiré de chaque rapport
      options.beforeSend = (event, hint) {
        event.user = null;
        return event;
      };
      options.beforeSendTransaction = (transaction, hint) {
        transaction.user = null;
        return transaction;
      };
    },
    appRunner: () => runApp(const VeriTraceApp()),
  );
}

class VeriTraceApp extends StatelessWidget {
  const VeriTraceApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Changer de langue reconstruit toute l'application (textes, sens de lecture) et revient à l'accueil,
    // où se trouve le sélecteur « FR | العربية ».
    return ValueListenableBuilder<Lang>(
      valueListenable: L10n.lang,
      builder: (context, lang, _) => MaterialApp(
        key: ValueKey(lang),
        title: 'VeriTrace',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        // arabe : Directionality de droite à gauche et textes de Material (boutons, menus) traduits
        locale: Locale(lang.name),
        supportedLocales: const [Locale('fr'), Locale('ar')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: const ScanScreen(),
      ),
    );
  }
}
