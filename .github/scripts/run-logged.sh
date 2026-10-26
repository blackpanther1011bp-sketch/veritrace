#!/usr/bin/env bash
# Lance une commande et, si elle échoue, publie les erreurs et la fin du journal
# dans les annotations du run (lisibles sans télécharger les journaux complets).
LOG="$(mktemp)"
"$@" 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[0]}
if [ "$STATUS" -ne 0 ]; then
  {
    grep -E "error:|Error:|ERROR|FAILURE|Exception|❌" "$LOG" | tail -n 25
    echo "-----"
    tail -n 40 "$LOG"
  } | tr -d '\r' | sed -e 's/%/%25/g' | awk 'BEGIN{ORS="%0A"} {print}' > "$LOG.msg"
  NAME="$(basename "$1")"
  echo "::error title=Echec de ${NAME}::$(cat "$LOG.msg")"
fi
exit "$STATUS"
