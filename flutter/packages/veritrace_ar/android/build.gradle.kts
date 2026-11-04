// Réalité augmentée native (ARCore) : module Android du plugin local veritrace_ar.
// Même structure que le modèle de plugin Java de Flutter 3.47 (AGP 9.1, Java 17).
group = "com.veritrace.ar"
version = "1.0"

buildscript {
    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath("com.android.tools.build:gradle:9.1.0")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

plugins {
    id("com.android.library")
}

android {
    namespace = "com.veritrace.ar"

    compileSdk = 36

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // ARCore : Android 7.0 minimum (déjà le minimum de l'app)
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }
}

dependencies {
    // ARCore (« Services Google Play pour la RA ») : suivi du téléphone dans l'espace, ancres
    implementation("com.google.ar:core:1.57.0")
    // Lecture des codes-barres sur l'image d'ARCore (même version que mobile_scanner)
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
}
