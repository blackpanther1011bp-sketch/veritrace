"""Registre officiel « Affichage environnemental des vêtements » (data.gouv.fr) → blocs JSON pour Supabase.

Usage : python3 affichage_env.py registre.csv dossier_sortie

Écrit dans dossier_sortie :
  - manifest.json : lot, nombre de lignes, marques, catégories, liste des blocs ;
  - bloc-000.json… : tableaux de lignes compactes (25 000 produits par bloc) ;
  - apercu.md : colonnes, marques et catégories, pour vérification humaine.

Une ligne compacte : [gtin, i_marque, i_categorie, reference, cout, cout_100g, durabilite, co2_kg,
                      [accessoires, matieres, filature, tissage, ennoblissement, confection,
                       transport, utilisation, fin_de_vie], date_declaration]
"""
import collections
import csv
import hashlib
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

SRC, OUT = sys.argv[1], sys.argv[2]
CHUNK = 25_000
STAGES = [
    "Cycle de vie - Accessoires",
    "Cycle de vie - Matières premières",
    "Cycle de vie - Filature",
    "Cycle de vie - Tissage & Tricotage",
    "Cycle de vie - Ennoblissement",
    "Cycle de vie - Confection",
    "Cycle de vie - Transport",
    "Cycle de vie - Utilisation",
    "Cycle de vie - Fin de vie",
]

# Catégories Ecobalyse → identifiant produit Ecobalyse (comme core.ts)
RULES = [
    (r"maillot", "maillot-de-bain"),
    (r"chaussette", "chaussettes"),
    (r"calecon", "calecon"),
    (r"slip|boxer|culotte", "slip"),
    (r"jean", "jean"),
    (r"t-?shirt|polo|debardeur|\btop\b", "tshirt"),
    (r"chemise|blouse", "chemise"),
    (r"robe|jupe", "jupe"),
    (r"pantalon|short|chino|jogging|legging", "pantalon"),
    (r"manteau|veste|blouson|parka|doudoune|trench|blazer", "manteau"),
    (r"pull|sweat|gilet|cardigan|hoodie", "pull"),
]


def norm(s):
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def eco_product(label):
    n = norm(label)
    for pattern, pid in RULES:
        if re.search(pattern, n):
            return pid
    return None


def gtin_valid(code):
    """Clé de contrôle GS1 (modulo 10) : écarte les codes inventés des déclarations de test."""
    digits = [int(c) for c in code]
    body, check = digits[:-1], digits[-1]
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    return (10 - total % 10) % 10 == check


def num(v, digits):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x != x:  # NaN
        return None
    return round(x, digits)


csv.field_size_limit(10**9)
os.makedirs(OUT, exist_ok=True)

with open(SRC, "r", encoding="utf-8-sig", newline="") as f:
    first = f.readline()
sep = csv.Sniffer().sniff(first, delimiters=",;\t|").delimiter

latest = {}  # gtin → (date, ligne) : on garde la déclaration la plus récente
brands_count, cats_count, skipped, total = collections.Counter(), collections.Counter(), 0, 0
with open(SRC, "r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f, delimiter=sep)
    cols = reader.fieldnames
    for row in reader:
        total += 1
        gtin = re.sub(r"\D", "", row.get("GTIN") or "")
        score = num(row.get("Score"), 1)
        ref = (row.get("Référence interne") or "")
        if (not (8 <= len(gtin) <= 14) or not gtin_valid(gtin) or score is None or score <= 0
                or re.search(r"\btest\b", ref, re.I)):
            skipped += 1
            continue
        if len(gtin) < 13:
            gtin = gtin.zfill(13)
        date = (row.get("Date de création") or "")[:10]
        prev = latest.get(gtin)
        if prev is None or date >= prev[0]:
            latest[gtin] = (date, row)

brands = sorted({(r.get("Marque") or "").strip() for _, r in latest.values()})
cats = sorted({(r.get("Catégorie") or "").strip() for _, r in latest.values()})
bi = {b: i for i, b in enumerate(brands)}
ci = {c: i for i, c in enumerate(cats)}

rows = []
for gtin, (date, r) in sorted(latest.items()):
    b = (r.get("Marque") or "").strip()
    c = (r.get("Catégorie") or "").strip()
    brands_count[b] += 1
    cats_count[c] += 1
    rows.append([
        gtin,
        bi[b],
        ci[c],
        (r.get("Référence interne") or "").strip()[:120],
        num(r.get("Score"), 1),
        num(r.get("Score standardisé"), 1),
        num(r.get("Durabilité"), 2),
        num(r.get("Impact - Changement climatique"), 2),
        [num(r.get(s), 1) or 0 for s in STAGES],
        date,
    ])

chunks = []
for k in range(0, len(rows), CHUNK):
    name = f"bloc-{k // CHUNK:03d}.json"
    data = json.dumps(rows[k : k + CHUNK], ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(data)
    chunks.append({"file": name, "rows": len(rows[k : k + CHUNK]), "sha256": hashlib.sha256(data.encode()).hexdigest()})

stamp = datetime.now(timezone.utc)
manifest = {
    "batch": stamp.strftime("%Y%m%d%H%M"),
    "generated_at": stamp.isoformat(timespec="seconds"),
    "source": "https://www.data.gouv.fr/datasets/affichage-environnemental-des-vetements",
    "rows_in_source": total,
    "rows": len(rows),
    "skipped": skipped,
    "stages": STAGES,
    "brands": brands,
    "categories": [{"label": c, "eco_product": eco_product(c)} for c in cats],
    "chunks": chunks,
}
with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)

with open(os.path.join(OUT, "apercu.md"), "w", encoding="utf-8") as f:
    f.write(f"# Registre affichage environnemental\n\nLot {manifest['batch']} ; lignes source : {total} ; ")
    f.write(f"codes-barres retenus : {len(rows)} ; écartés : {skipped} ; blocs : {len(chunks)}\n\n## Colonnes\n\n")
    f.write("\n".join(f"- `{c}`" for c in cols))
    f.write("\n\n## Catégories\n\n")
    for c, n in cats_count.most_common():
        f.write(f"- {c} → {eco_product(c)} : {n}\n")
    f.write("\n## Marques\n\n")
    for b, n in brands_count.most_common():
        f.write(f"- {b} : {n}\n")

print(f"{total} lignes lues, {len(rows)} codes-barres, {len(brands)} marques, {len(cats)} catégories, {len(chunks)} blocs")
