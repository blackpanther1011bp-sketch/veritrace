"""Mesure ce que des bases ouvertes de codes-barres apporteraient à VeriTrace (vêtements seulement).

Usage :
  python3 explore_sources.py opf    produits.jsonl.gz  dossier_registre  sortie.csv.gz
  unzip -p gtin.zip | python3 explore_sources.py nudger -  dossier_registre  sortie.csv.gz

Écrit un résumé en Markdown sur la sortie standard et les vêtements retenus (gtin, marque, nom, catégorie)
dans sortie.csv.gz. Rien n'est envoyé à VeriTrace : c'est une étude avant de décider quoi charger.
"""
import collections
import csv
import glob
import gzip
import io
import json
import re
import sys
import unicodedata

KIND, SRC, REGISTRY, OUT = sys.argv[1:5]
csv.field_size_limit(10**9)

CLOTHING = re.compile(
    r"vetement|habillement|pret-a-porter|clothing|clothes|apparel|t-?shirt|tee-shirt|pantalon|\bjeans?\b|\brobes?\b|"
    r"\bjupes?\b|chemise|\bpulls?\b|sweat|\bvestes?\b|manteau|blouson|doudoune|parka|legging|lingerie|sous-vetement|"
    r"underwear|chaussettes?|\bsocks\b|maillot|\bpolos?\b|\bshorts?\b|trousers|\bdress(es)?\b|\bshirts?\b|jackets?|"
    r"\bcoats?\b|hoodie|sweater|knitwear|swimwear|pyjama|bermuda|cardigan|gilet|debardeur|combinaison|salopette"
)
NOT_CLOTHING = re.compile(
    r"chaussure|shoes|sneaker|basket|bijou|montre|sac\b|bagage|jouet|poupee|deguisement|costume de|animal|chien|chat\b|"
    r"lave-|seche-|machine|fer a|cintre|rangement|armoire|housse|meuble|livre|dvd|jeu video|figurine|protege|moto|"
    r"velo|casque|gant de|ski\b|peche|chasse|bebe confort|poussette|parfum|cosmet|maquillage"
)


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def gtin_ok(code):
    if not code.isdigit() or len(code) not in (8, 12, 13, 14) or int(code) == 0:
        return False
    d = [int(c) for c in code]
    total = sum(x * (3 if i % 2 == 0 else 1) for i, x in enumerate(reversed(d[:-1])))
    return (10 - total % 10) % 10 == d[-1]


def key(code):
    return code.lstrip("0").zfill(13)


registry = set()
for path in sorted(glob.glob(f"{REGISTRY}/bloc-*.json")):
    with open(path, encoding="utf-8") as f:
        for row in json.load(f):
            registry.add(key(str(row[0])))

total = valid = clothing = named = branded = overlap = 0
brands = collections.Counter()
cats = collections.Counter()
cloth_cats = collections.Counter()
prefixes = collections.Counter()
samples = []
out_file = gzip.open(OUT, "wt", encoding="utf-8", newline="")
out = csv.writer(out_file)
out.writerow(["gtin", "brand", "name", "category"])


def take(code, brand, name, category_text, category_label):
    global total, valid, clothing, named, branded, overlap
    total += 1
    code = (code or "").strip()
    if not gtin_ok(code):
        return
    valid += 1
    n = norm(category_text)
    if total % 50 == 0:
        cats[category_label[:70]] += 1
    if not CLOTHING.search(n) or NOT_CLOTHING.search(n):
        return
    brand, name = (brand or "").strip(), (name or "").strip()
    if not brand or not name:
        return
    clothing += 1
    cloth_cats[category_label[:70]] += 1
    brands[brand.upper()[:40]] += 1
    prefixes[key(code)[:3]] += 1
    if key(code) in registry:
        overlap += 1
    if len(samples) < 25 and clothing % 997 == 1:
        samples.append((code, brand, name[:70], category_label[:50]))
    out.writerow([key(code), brand[:60], name[:120], category_label[:80]])


if KIND == "opf":
    with gzip.open(SRC, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                p = json.loads(line)
            except ValueError:
                continue
            tags = p.get("categories_tags") or []
            text = " ".join(tags) + " " + (p.get("categories") or "")
            take(str(p.get("code") or ""), (p.get("brands") or "").split(",")[0], p.get("product_name") or "", text, (tags[-1] if tags else p.get("categories") or "(sans catégorie)"))
else:
    stream = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", errors="replace", newline="")
    reader = csv.reader(stream)
    header = next(reader)
    print("Colonnes :", ", ".join(header), "\n")
    col = {name: i for i, name in enumerate(header)}
    g, b, nm, c = col.get("gtin", 0), col.get("brand", 1), col.get("name", 3), col.get("categories", 10)
    for row in reader:
        if len(row) <= max(g, b, nm, c):
            continue
        take(row[g], row[b], row[nm], row[c], row[c] or "(sans catégorie)")

out_file.close()
print(f"## Source : {KIND}\n")
print(f"- lignes lues : {total:,}")
print(f"- codes-barres valides (clé de contrôle GS1) : {valid:,}")
print(f"- vêtements avec marque et nom : {clothing:,}")
print(f"- dont déjà dans le registre officiel : {overlap:,} ; nouveaux : {clothing - overlap:,}")
print(f"- codes du registre officiel chargés pour la comparaison : {len(registry):,}\n")
print("### Marques les plus présentes (vêtements)\n")
for name, n in brands.most_common(60):
    print(f"- {name} : {n:,}")
print("\n### Catégories retenues comme vêtements\n")
for name, n in cloth_cats.most_common(60):
    print(f"- {name} : {n:,}")
print("\n### Catégories de la source (1 ligne sur 50)\n")
for name, n in cats.most_common(60):
    print(f"- {name} : {n * 50:,}")
print("\n### Préfixes GS1 (pays d'attribution du code)\n")
print(", ".join(f"{p}: {n:,}" for p, n in prefixes.most_common(25)))
print("\n### Exemples\n")
for s in samples:
    print("- " + " | ".join(s))
