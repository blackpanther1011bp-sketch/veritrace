#!/usr/bin/env bash
# Vérification du suivi des erreurs de l'app sur un émulateur Android (workflow « Vérification Sentry »).
# Installe l'APK, ouvre l'app, attend l'accueil, puis fait un appui long sur le nom « VeriTrace » : l'app publiée
# envoie alors une erreur de test à Sentry (projet veritrace-app). Captures d'écran et journaux dans le dossier $2,
# et résumé dans le journal de l'exécution (les artefacts ne sont pas toujours téléchargeables).
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

# Textes visibles d'un relevé d'écran (pour le journal)
textes() {
  python3 - "$1" <<'PY'
import sys
import xml.etree.ElementTree as ET
try:
    root = ET.parse(sys.argv[1]).getroot()
except Exception:
    print("(relevé illisible)"); sys.exit(0)
vus = [v for n in root.iter("node") for v in (n.get("text", "").strip(), n.get("content-desc", "").strip()) if v]
print(" | ".join(vus[:40]) or "(aucun texte : arbre d'accessibilité vide)")
PY
}

releve() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || return 1
  adb pull /sdcard/ui.xml "$OUT/$1.xml" >/dev/null 2>&1
}

# Capture d'écran (gardée en artefact)
capture() {
  adb exec-out screencap -p > "$OUT/$1.png" || true
}

echo "Écran : $(adb shell wm size | tr -d '\r') ; densité : $(adb shell wm density | tr -d '\r')"
adb install -r "$APK"
adb logcat -c || true
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null

# Accueil : jusqu'à 2 minutes (premier lancement d'une app Flutter sur émulateur). Flutter ne remplit l'arbre
# d'accessibilité qu'une fois l'accessibilité active : les premiers relevés peuvent être vides.
pos=""
for i in $(seq 1 24); do
  sleep 5
  releve accueil || continue
  pos=$(centre "$OUT/accueil.xml" "VeriTrace")
  [ -n "$pos" ] && break
  if [ $((i % 4)) -eq 0 ]; then echo "Relevé $i : $(textes "$OUT/accueil.xml")"; fi
done
echo "Activité au premier plan : $(adb shell dumpsys activity activities | grep -m1 -E 'topResumedActivity|mResumedActivity' | tr -s ' ' | tr -d '\r')"
capture 1-accueil

if [ -z "$pos" ]; then
  # Position calculée : marges de l'en-tête (24 dp à gauche, 20 dp en haut), icône 28 dp + 10 dp, puis le nom
  densite=$(adb shell wm density | tr -d '\r' | grep -oE '[0-9]+' | tail -n 1)
  haut=$(adb shell dumpsys window | grep -m1 -oE 'type=statusBars[^]]*frame=\[0,0\]\[[0-9]+,[0-9]+\]' | grep -oE '[0-9]+\]$' | tr -d ']' || true)
  haut=${haut:-$((24 * densite / 160))}
  x=$((105 * densite / 160))
  y=$((haut + 34 * densite / 160))
  pos="$x $y"
  echo "Nom « VeriTrace » absent du relevé : position calculée $pos (barre d'état $haut px, densité $densite)"
fi

echo "Appui long en $pos"
read -r x y <<<"$pos"
adb shell input swipe "$x" "$y" "$x" "$y" 1500

# Le message de confirmation s'affiche quelques secondes ; l'envoi part en arrière-plan
sleep 1
releve confirmation || true
capture 2-confirmation
echo "Après l'appui long : $(textes "$OUT/confirmation.xml" 2>/dev/null || echo '(pas de relevé)')"
sleep 15
adb logcat -d > "$OUT/logcat.txt" || true
echo "----- Journal de l'app (extraits) -----"
grep -iE "flutter|sentry|AndroidRuntime|FATAL" "$OUT/logcat.txt" | grep -viE "accessibility" | tail -n 60 || true
echo "---------------------------------------"

if grep -q "Rapport de test envoy" "$OUT/confirmation.xml" 2>/dev/null || grep -q "تقرير تجريبي" "$OUT/confirmation.xml" 2>/dev/null; then
  echo "Confirmation affichée par l'app : erreur de test envoyée à Sentry"
else
  echo "::warning::Message de confirmation non lu à l'écran ; vérifier dans Sentry"
fi
