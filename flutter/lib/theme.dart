import 'package:flutter/material.dart';

import 'models.dart';

/// Couleurs reprises de la maquette et de la web app.
class VT {
  static const ink = Color(0xFF0F1A14);
  static const ink2 = Color(0xFF1A2A21);
  static const ground = Color(0xFFF4F6F3);
  static const card = Colors.white;
  static const line = Color(0xFFE3E8E4);
  static const muted = Color(0xFF4A5A50);
  static const muted2 = Color(0xFF5E6B63);
  static const green = Color(0xFF1F6B4A);
  static const mint = Color(0xFF3DDC97);
  static const mintTint = Color(0xFFDDF2E5);
  static const danger = Color(0xFFA3361F);
}

const gradeColor = {
  Grade.A: Color(0xFF4FB37A),
  Grade.B: Color(0xFFA6CF5A),
  Grade.C: Color(0xFFF2C94C),
  Grade.D: Color(0xFFF09A4A),
  Grade.E: Color(0xFFE0614B),
};

const gradeTint = {
  Grade.A: Color(0xFFE3F4EA),
  Grade.B: Color(0xFFEEF6DF),
  Grade.C: Color(0xFFFDF6DC),
  Grade.D: Color(0xFFFFF1E4),
  Grade.E: Color(0xFFFCE6E1),
};

const verdicts = {
  Grade.A: ('Excellent choix', 'Parmi les mieux notés pour ce type de vêtement.'),
  Grade.B: ('Bon choix', 'Impact maîtrisé, avec quelques points à améliorer.'),
  Grade.C: ('Impact moyen', 'Correct, mais des options mieux notées existent.'),
  Grade.D: ('Impact élevé', 'Des options nettement mieux notées existent pour ce vêtement.'),
  Grade.E: ('Impact très élevé', 'À éviter : de bien meilleures options existent.'),
};

const levelLabel = {'faible': 'Faible', 'moyen': 'Moyen', 'fort': 'Fort'};
const levelColor = {'faible': Color(0xFF4FB37A), 'moyen': Color(0xFFF2C94C), 'fort': Color(0xFFE0614B)};
const levelText = {'faible': Color(0xFF1F6B4A), 'moyen': Color(0xFF7A5B00), 'fort': Color(0xFFA3361F)};

const statusLabel = {'oui': 'Oui', 'partiel': 'Partielle', 'non': 'Non', 'non_communique': 'Non communiqué'};
const statusStyle = {
  'oui': (Color(0xFF1F6B4A), Color(0xFFDDF2E5)),
  'partiel': (Color(0xFF7A5B00), Color(0xFFFCF1CF)),
  'non': (Color(0xFFA3361F), Color(0xFFFCE6E1)),
  'non_communique': (Color(0xFF4A5A50), Color(0xFFE3E8E4)),
};

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: VT.green, primary: VT.green, surface: VT.ground),
    scaffoldBackgroundColor: VT.ground,
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: VT.ground,
      foregroundColor: VT.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(color: VT.ink, fontSize: 20, fontWeight: FontWeight.w700),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: VT.green,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: VT.green,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: VT.green, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: VT.green,
        minimumSize: const Size.fromHeight(44),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
  );
}
