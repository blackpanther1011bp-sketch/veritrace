import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config.dart';
import 'screens/scan_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // l'app est pensée pour être tenue verticalement, comme en magasin
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await Supabase.initialize(url: AppConfig.supabaseUrl, anonKey: AppConfig.supabaseKey);
  runApp(const VeriTraceApp());
}

class VeriTraceApp extends StatelessWidget {
  const VeriTraceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VeriTrace',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: const ScanScreen(),
    );
  }
}
