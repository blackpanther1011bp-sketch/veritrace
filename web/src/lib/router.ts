import { useEffect, useState } from "react";

const EVENT = "vt:navigate";

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash.length > 0 ? hash : "/";
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return path;
}

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  const url = `#${path}`;
  if (options.replace) {
    window.history.replaceState(window.history.state, "", url);
  } else {
    window.history.pushState({ vt: true }, "", url);
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Retour dans l'app si possible, sinon vers l'écran de repli (lien ouvert directement). */
export function goBack(fallback: string): void {
  const state = window.history.state as { vt?: boolean } | null;
  if (state?.vt) window.history.back();
  else navigate(fallback, { replace: true });
}

export type Route =
  | { name: "scan" }
  | { name: "ar" }
  | { name: "product"; ean: string }
  | { name: "details"; ean: string; tab: "carbone" | "social" }
  | { name: "alternatives"; ean: string }
  | { name: "notFound"; ean: string }
  | { name: "contribute"; ean: string }
  | { name: "label"; ean: string | null }
  | { name: "labelLive"; ean: string | null }
  | { name: "makers" }
  | { name: "passport"; id: string }
  | { name: "legal"; page: "confidentialite" | "mentions-legales" | "conditions" };

/** Code d'un vêtement : code-barres (8 à 14 chiffres) ou étiquette lue sans code-barres (L + 12 caractères). */
export const PRODUCT_CODE = /^(\d{8,14}|L[0-9a-f]{12})$/;

export function parseRoute(fullPath: string): Route {
  const [path, query = ""] = fullPath.split("?");
  const params = new URLSearchParams(query);
  const parts = path.split("/").filter(Boolean);
  const ean = parts[1] ?? "";
  if (parts[0] === "p" && PRODUCT_CODE.test(ean)) {
    if (parts[2] === "details") return { name: "details", ean, tab: params.get("onglet") === "social" ? "social" : "carbone" };
    if (parts[2] === "alternatives") return { name: "alternatives", ean };
    return { name: "product", ean };
  }
  if (parts[0] === "inconnu" && /^\d{8,14}$/.test(ean)) return { name: "notFound", ean };
  if (parts[0] === "ajouter" && /^\d{8,14}$/.test(ean)) return { name: "contribute", ean };
  if (parts[0] === "etiquette-direct") return { name: "labelLive", ean: /^\d{8,14}$/.test(ean) ? ean : null };
  if (parts[0] === "etiquette") return { name: "label", ean: /^\d{8,14}$/.test(ean) ? ean : null };
  if (parts[0] === "fabricants") return { name: "makers" };
  if (parts[0] === "passeport" && /^[0-9a-f]{12}$/.test(ean)) return { name: "passport", id: ean };
  if (parts[0] === "ar") return { name: "ar" };
  if (parts[0] === "confidentialite" || parts[0] === "mentions-legales" || parts[0] === "conditions") return { name: "legal", page: parts[0] };
  return { name: "scan" };
}
