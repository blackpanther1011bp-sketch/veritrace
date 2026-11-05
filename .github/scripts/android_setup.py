"""Prépare le projet Android généré par `flutter create` (lancé depuis le dossier flutter/).

- nom affiché « VeriTrace », accès Internet ;
- retrait des permissions ajoutées par les modules caméra et photo mais inutiles (micro, stockage) ;
- signature de publication lue dans android/key.properties (écrit par le workflow) ;
- Android 8.0 (API 26) au minimum, exigé par Sentry ;
- icône, icône adaptative et écran de démarrage VeriTrace (dossier branding/android/res) ;
- règles R8 pour les modules ML Kit non inclus.

Chaque modification est vérifiée : si le modèle de Flutter change, le build échoue avec un message clair
au lieu de produire un APK incomplet.
"""

import pathlib
import shutil
import sys

ANDROID = pathlib.Path("android")
MANIFEST = ANDROID / "app/src/main/AndroidManifest.xml"
GRADLE = ANDROID / "app/build.gradle.kts"
PROGUARD = ANDROID / "app/proguard-rules.pro"
BRANDING = pathlib.Path("branding/android/res")


def fail(message: str) -> None:
    print(f"::error title=Préparation Android::{message}")
    sys.exit(1)


def patch_manifest() -> None:
    m = MANIFEST.read_text(encoding="utf-8")
    opening = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"'
    if opening not in m:
        fail("balise <manifest> inattendue dans AndroidManifest.xml")
    if "xmlns:tools" not in m:
        m = m.replace(opening, opening + ' xmlns:tools="http://schemas.android.com/tools"', 1)
    start = m.index(">", m.index("<manifest")) + 1
    block = (
        "\n    <!-- Base Supabase et calcul des notes -->\n"
        '    <uses-permission android:name="android.permission.INTERNET"/>\n'
        "    <!-- Ajoutées par les modules caméra et photo, inutiles pour VeriTrace : retirées de l'APK -->\n"
        '    <uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>\n'
        '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" tools:node="remove"/>\n'
        '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" tools:node="remove"/>\n'
    )
    if "android.permission.INTERNET" in m:
        fail("permission INTERNET déjà présente : le modèle de Flutter a changé, vérifier le script")
    m = m[:start] + block + m[start:]
    if 'android:label="veritrace"' not in m:
        fail('android:label="veritrace" introuvable')
    m = m.replace('android:label="veritrace"', 'android:label="VeriTrace"', 1)
    MANIFEST.write_text(m, encoding="utf-8")


def patch_gradle() -> None:
    g = GRADLE.read_text(encoding="utf-8")
    old_signing = 'signingConfig = signingConfigs.getByName("debug")'
    for needed in ("android {", "    buildTypes {", old_signing):
        if needed not in g:
            fail(f"« {needed} » introuvable dans app/build.gradle.kts")
    g = "import java.io.FileInputStream\nimport java.util.Properties\n\n" + g
    g = g.replace(
        "android {",
        "// Signature de publication : android/key.properties, écrit par le workflow (clé de test ou secrets)\n"
        "val keystoreProperties = Properties().apply {\n"
        '    val f = rootProject.file("key.properties")\n'
        "    if (f.exists()) FileInputStream(f).use { load(it) }\n"
        "}\n\n"
        "android {",
        1,
    )
    g = g.replace(
        "    buildTypes {",
        "    signingConfigs {\n"
        '        create("release") {\n'
        '            keyAlias = keystoreProperties.getProperty("keyAlias")\n'
        '            keyPassword = keystoreProperties.getProperty("keyPassword")\n'
        '            storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }\n'
        '            storePassword = keystoreProperties.getProperty("storePassword")\n'
        "        }\n"
        "    }\n\n"
        "    buildTypes {",
        1,
    )
    g = g.replace(old_signing, 'signingConfig = signingConfigs.getByName("release")', 1)
    # Android 8.0 (API 26) au minimum : exigé par le SDK de suivi des erreurs (Sentry 10)
    if "minSdk = flutter.minSdkVersion" not in g:
        fail("« minSdk = flutter.minSdkVersion » introuvable dans app/build.gradle.kts")
    g = g.replace("minSdk = flutter.minSdkVersion", "minSdk = 26", 1)
    GRADLE.write_text(g, encoding="utf-8")


def copy_branding() -> None:
    res = ANDROID / "app/src/main/res"
    if not BRANDING.is_dir():
        fail("dossier branding/android/res introuvable")
    count = 0
    for src in BRANDING.rglob("*"):
        if src.is_file():
            dest = res / src.relative_to(BRANDING)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
            count += 1
    print(f"{count} fichiers d'icône et d'écran de démarrage copiés")


def patch_proguard() -> None:
    rules = (
        "# Lecture d'étiquette (ML Kit, alphabet latin) : les modules chinois, japonais, coréen et devanagari\n"
        "# ne sont pas inclus ; R8 doit ignorer leurs références.\n"
        "-dontwarn com.google.mlkit.vision.text.chinese.**\n"
        "-dontwarn com.google.mlkit.vision.text.devanagari.**\n"
        "-dontwarn com.google.mlkit.vision.text.japanese.**\n"
        "-dontwarn com.google.mlkit.vision.text.korean.**\n"
    )
    existing = PROGUARD.read_text(encoding="utf-8") if PROGUARD.exists() else ""
    PROGUARD.write_text(existing + rules, encoding="utf-8")


if __name__ == "__main__":
    patch_manifest()
    patch_gradle()
    copy_branding()
    patch_proguard()
    print(MANIFEST.read_text(encoding="utf-8"))
    print("Projet Android prêt.")
