import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
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
  runApp(const VeriTraceApp());
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
