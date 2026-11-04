// Lecture du texte d'une photo d'étiquette directement sur le téléphone (ML Kit de Google, intégré à
// l'app) : gratuit et sans connexion. Le serveur ne reçoit que le texte lu (et la photo pour vérification).

import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

Future<String> readLabelTextFromFile(String path) async {
  final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
  try {
    final result = await recognizer.processImage(InputImage.fromFilePath(path));
    return result.text;
  } finally {
    await recognizer.close();
  }
}
