/** Garde uniquement les chiffres. */
export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

/** Vérifie la clé de contrôle d'un code GTIN (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // en partant de la droite, poids 3 puis 1
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

/** Ramène un UPC-A (12 chiffres) à sa forme EAN-13, comme les fiches en base. */
export function normalizeGtin(code: string): string {
  const d = digitsOnly(code);
  if (d.length === 12) return "0" + d;
  return d;
}

/** Affiche un EAN-13 lisiblement : 2 001000 000012 */
export function formatEan(code: string): string {
  if (code.length === 13) return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
  return code;
}
