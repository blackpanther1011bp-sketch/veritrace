"""Fabrique les fichiers d'identification des vêtements absents du registre officiel.

Source : base ouverte de codes-barres de Nudger (open4goods), copie Zenodo, licence CC BY 4.0.
Elle donne la marque et le nom d'un produit, pas son impact : VeriTrace s'en sert seulement pour dire
« on reconnaît ce vêtement, lisez son étiquette pour le noter », et préremplir la marque et le type.

Usage : unzip -p gtin.zip | python3 identification.py dossier_registre dossier_sortie

Tri strict : catégorie de vêtement, hors outillage, moto, jouets, accessoires… ; marque renseignée ; nom dans lequel
on reconnaît un type de vêtement de VeriTrace ; code-barres valide, hors codes internes aux magasins, et absent du
registre officiel (qui reste prioritaire). Sortie : 4 096 petits fichiers JSON, un par reste de la division du
code-barres par 4 096, que l'appli consulte seulement quand un code-barres est inconnu.
"""
import collections
import csv
import glob
import io
import json
import os
import re
import sys
import unicodedata

REGISTRY, OUT = sys.argv[1:3]
SHARDS = 4096
csv.field_size_limit(10**9)

# Types de vêtement de VeriTrace (mêmes libellés que web/src/lib/contribute.ts), du plus précis au plus général.
TYPES = [
    ("Maillot de bain", r"maillot de bain|\bswim|bikini|short de bain"),
    ("T-shirt", r"t-?shirt|tee-?shirt|\btee\b|debardeur|tank top|\bmaillots?\b|jersey"),
    ("Polo", r"\bpolos?\b"),
    ("Sweat", r"sweat|hoodie"),
    ("Blouse", r"blouse|chemisier|tunique"),
    ("Chemise", r"chemise|\bshirts?\b"),
    ("Robe", r"\brobes?\b|\bdress(es)?\b"),
    ("Jupe", r"\bjupes?\b|\bskirts?\b"),
    ("Jean", r"\bjeans?\b|denim"),
    ("Short", r"\bshorts?\b|bermuda"),
    ("Pantalon", r"pantalon|trousers|\bpants\b|\bchinos?\b|jogging|leggings?|jogger"),
    ("Pull", r"\bpulls?\b|pullover|sweater|jumper"),
    ("Gilet", r"\bgilets?\b|cardigan"),
    ("Manteau", r"manteau|parka|doudoune|\bcoats?\b|anorak"),
    ("Veste", r"\bvestes?\b|blouson|jackets?|blazer"),
    ("Chaussettes", r"chaussettes?|\bsocks?\b"),
    ("Boxer / Slip", r"\bboxers?\b|\bslips?\b|calecon|culotte|\bbriefs\b"),
]
TYPES = [(label, re.compile(rx)) for label, rx in TYPES]
LABELS = [label for label, _ in TYPES]

CLOTHING = re.compile(
    r"vetement|habillement|pret-a-porter|clothing|apparel|mode-homme|mode-femme|mode-enfant|"
    r"lifestyle > |multisports > |football > |department:(streetwear|merchandise)|\bmode \| (pantalons|pulls|robes|jupes|chemises|vestes|manteaux|jeans|t-shirts)"
)
BAD_CATEGORY = re.compile(
    r"outillage|quincaillerie|bricolage|\bdiy\b|hand tools|jardin|garden|motard|\bmoto\b|cross|cavalier|equitation|"
    r"\bfilm\b|hobby|sewing|couture|home & kitchen|housekeeping|deguisement|chaussure|shoes|bijou|montre|bagage|"
    r"maroquinerie|jouet|poupee|animal|chien|\bchat\b|linge|tapis|coque|parfum|cosmet|goodies|"
    r"hats|caps|echarpe|protection|securite|peche|chasse|puericulture|livre|papeterie|decoration|meuble"
)
BAD_NAME = re.compile(
    r"poupee|deguisement|figurine|coque|housse|cintre|patron de|tissu|peluche|jouet|pour chien|pour chat|pour poupee|"
    r"autocollant|poster|mug|porte-cle|sac a|casquette|bonnet|echarpe|gants?\b|ceinture|cravate|chaussure|basket|"
    r"lot de \d{2,}|protege|genouillere|casque"
)
BAD_BRAND = {"", "non communique", "nc", "n/a", "na", "generique", "sans marque", "no name", "noname", "var", "aucune",
             "autre", "divers", "inconnu", "unknown", "unbranded", "generic", "marque inconnue"}


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


def garment_type(text):
    for i, (_, rx) in enumerate(TYPES):
        if rx.search(text):
            return i
    return -1


def clean(text, limit):
    return re.sub(r"\s+", " ", text).strip()[:limit]


def main():
    registry = set()
    for path in sorted(glob.glob(f"{REGISTRY}/bloc-*.json")):
        with open(path, encoding="utf-8") as f:
            registry.update(key(str(row[0])) for row in json.load(f))

    shards = [dict() for _ in range(SHARDS)]
    stats = collections.Counter()
    brands = collections.Counter()
    types = collections.Counter()
    samples = []

    reader = csv.reader(io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", errors="replace", newline=""))
    col = {name: i for i, name in enumerate(next(reader))}
    g, b, nm, c = col["gtin"], col["brand"], col["name"], col["categories"]
    width = max(g, b, nm, c)
    for row in reader:
        stats["lignes"] += 1
        if len(row) <= width:
            continue
        category = norm(row[c])
        if not CLOTHING.search(category) or BAD_CATEGORY.search(category):
            continue
        stats["catégorie de vêtement"] += 1
        code = row[g].strip()
        if not gtin_ok(code):
            continue
        k = key(code)
        # codes internes aux magasins (préfixes 02 et 20 à 29), livres : jamais un vêtement identifiable partout
        if len(k) != 13 or k[0] == "2" or k[:2] == "02" or k[:3] in ("977", "978", "979"):
            continue
        brand, name = clean(row[b], 40), clean(row[nm], 90)
        nbrand, nname = norm(brand), norm(name)
        if nbrand in BAD_BRAND or len(nbrand) < 2 or nbrand.isdigit() or len(nname) < 8 or BAD_NAME.search(nname):
            continue
        t = garment_type(nname)
        if t < 0:
            continue
        stats["vêtements retenus"] += 1
        if k in registry:
            stats["déjà au registre officiel (écartés)"] += 1
            continue
        shards[int(k) % SHARDS][k] = [brand, name, LABELS[t]]
        brands[brand.upper()] += 1
        types[LABELS[t]] += 1
        if len(samples) < 30 and stats["vêtements retenus"] % 4001 == 1:
            samples.append(f"{k} | {brand} | {name} | {LABELS[t]}")

    os.makedirs(f"{OUT}/id", exist_ok=True)
    total = size = 0
    for i, shard in enumerate(shards):
        data = json.dumps(shard, ensure_ascii=False, separators=(",", ":"))
        with open(f"{OUT}/id/{i:04d}.json", "w", encoding="utf-8") as f:
            f.write(data)
        total += len(shard)
        size += len(data.encode())
    with open(f"{OUT}/manifest.json", "w", encoding="utf-8") as f:
        json.dump({"source": "Nudger / open4goods (Zenodo 10.5281/zenodo.14035436), CC BY 4.0", "shards": SHARDS,
                   "products": total, "types": LABELS}, f, ensure_ascii=False, indent=1)

    print("## Identification des vêtements (Nudger)\n")
    for name, n in stats.items():
        print(f"- {name} : {n:,}")
    print(f"- publiés : {total:,} vêtements dans {SHARDS} fichiers, {size / 1e6:.1f} Mo au total, {size / SHARDS / 1e3:.1f} ko par fichier en moyenne\n")
    print("### Par type\n")
    for name, n in types.most_common():
        print(f"- {name} : {n:,}")
    print("\n### Marques les plus présentes\n")
    for name, n in brands.most_common(50):
        print(f"- {name} : {n:,}")
    print("\n### Exemples\n")
    for s in samples:
        print("- " + s)


main()
