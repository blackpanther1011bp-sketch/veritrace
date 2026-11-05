#!/usr/bin/env bash
# Vérification du suivi des erreurs de l'app sur un émulateur Android (workflow « Vérification Sentry »).
# Installe l'APK, ouvre l'app, attend l'accueil, puis fait un appui long sur le nom « VeriTrace » : l'app publiée
# envoie alors une erreur de test à Sentry (projet veritrace-app). Capture d'écran et journaux dans le dossier $2.
#
# Utilisation : sentry_app_check.sh <apk> <dossier de sortie>
set -euo pipefail

APK="$1"
OUT="${2:-sentry-check}"
PKG="ma.studiokante.veritrace"
mkdir -p "$OUT"

# Centre de l'élément dont le texte (ou la description) est exactement $2, le plus haut à l'écran
centre() {
  python3 - "$1" "$2" <<'PY'
import re, sys
import xml.etree.ElementTree as ET
try:
    root = ET.parse(sys.argv[1]).getroot()
except Exception:
    sys.exit(0)
best = None
for n in root.iter("node"):
    if sys.argv[2] in (n.get("text", "").strip(), n.get("content-desc", "").strip()):
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds", ""))
        if m:
            x1, y1, x2, y2 = map(int, m.groups())
            if best is None or y1 < best[1]:
                best = ((x1 + x2) // 2, y1, (y1 + y2) // 2)
if best:
    print(best[0], best[2])
PY
}

ecran() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || return 1
  adb pull /sdcard/ui.xml "$OUT/$1.xml" >/dev/null 2>&1
}

adb install -r "$APK"
adb logcat -c || true
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null

# Accueil : jusqu'à 2 minutes (premier lancement d'une app Flutter sur émulateur)
pos=""
for _ in $(seq 1 40); do
  sleep 3
  ecran accueil || continue
  pos=$(centre "$OUT/accueil.xml" "VeriTrace")
  [ -n "$pos" ] && break
done
adb exec-out screencap -p > "$OUT/1-accueil.png" || true
if [ -z "$pos" ]; then
  echo "::error::Nom « VeriTrace » introuvable à l'écran (voir la capture 1-accueil.png)"
  adb logcat -d > "$OUT/logcat.txt" || true
  exit 1
fi
echo "Nom « VeriTrace » trouvé en $pos : appui long"
read -r x y <<<"$pos"
adb shell input swipe "$x" "$y" "$x" "$y" 1500

# Le message de confirmation s'affiche quelques secondes ; l'envoi part en arrière-plan
sleep 2
ecran confirmation || true
adb exec-out screencap -p > "$OUT/2-confirmation.png" || true
sleep 15
adb logcat -d > "$OUT/logcat.txt" || true
grep -i "sentry" "$OUT/logcat.txt" | tail -n 80 > "$OUT/logcat-sentry.txt" || true

if grep -q "Rapport de test envoy" "$OUT/confirmation.xml" 2>/dev/null || grep -q "تقرير تجريبي" "$OUT/confirmation.xml" 2>/dev/null; then
  echo "Confirmation affichée par l'app : erreur de test envoyée à Sentry"
else
  echo "::warning::Message de confirmation non lu à l'écran (voir 2-confirmation.png) ; vérifier dans Sentry"
fi
