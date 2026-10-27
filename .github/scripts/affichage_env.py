"""Aperçu du registre officiel « Affichage environnemental des vêtements » (data.gouv.fr).

Usage : python3 affichage_env.py registre.csv dossier_sortie
Écrit apercu.md (colonnes, exemples, marques, catégories) et echantillon.csv (300 premières lignes).
"""
import collections
import csv
import os
import sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
csv.field_size_limit(10**9)

with open(src, "r", encoding="utf-8-sig", newline="") as f:
    head = f.read(200_000)
dialect = csv.Sniffer().sniff(head.splitlines()[0] + "\n", delimiters=",;\t|")
sep = dialect.delimiter

def find(cols, *keys):
    for i, c in enumerate(cols):
        lc = c.lower()
        if any(k in lc for k in keys):
            return i
    return None

brands, cats, rows, sample = collections.Counter(), collections.Counter(), 0, []
with open(src, "r", encoding="utf-8-sig", newline="") as f:
    reader = csv.reader(f, delimiter=sep)
    cols = next(reader)
    ib = find(cols, "marque", "brand")
    ic = find(cols, "categ", "product")
    for row in reader:
        rows += 1
        if len(sample) < 300:
            sample.append(row)
        if ib is not None and ib < len(row):
            brands[row[ib]] += 1
        if ic is not None and ic < len(row):
            cats[row[ic]] += 1

with open(os.path.join(out, "echantillon.csv"), "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f)
    w.writerow(cols)
    w.writerows(sample)

with open(os.path.join(out, "apercu.md"), "w", encoding="utf-8") as f:
    f.write(f"# Aperçu du registre\n\nSéparateur : `{sep}` ; lignes : {rows} ; colonnes : {len(cols)}\n\n## Colonnes\n\n")
    for i, c in enumerate(cols):
        f.write(f"{i}. `{c}`\n")
    f.write("\n## Trois premières lignes\n\n")
    for r in sample[:3]:
        f.write("```\n" + "\n".join(f"{cols[i]} = {v}" for i, v in enumerate(r[: len(cols)])) + "\n```\n\n")
    f.write(f"## Marques (colonne {cols[ib] if ib is not None else '?'}) : {len(brands)}\n\n")
    for b, n in brands.most_common(150):
        f.write(f"- {b} : {n}\n")
    f.write(f"\n## Catégories (colonne {cols[ic] if ic is not None else '?'})\n\n")
    for c, n in cats.most_common(60):
        f.write(f"- {c} : {n}\n")
print(f"{rows} lignes, {len(cols)} colonnes, {len(brands)} marques")
