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
  | { name: "contribute"; ean: string };

export function parseRoute(fullPath: string): Route {
  const [path, query = ""] = fullPath.split("?");
  const params = new URLSearchParams(query);
  const parts = path.split("/").filter(Boolean);
  const ean = parts[1] ?? "";
  if (parts[0] === "p" && /^\d{8,14}$/.test(ean)) {
    if (parts[2] === "details") return { name: "details", ean, tab: params.get("onglet") === "social" ? "social" : "carbone" };
    if (parts[2] === "alternatives") return { name: "alternatives", ean };
    return { name: "product", ean };
  }
  if (parts[0] === "inconnu" && /^\d{8,14}$/.test(ean)) return { name: "notFound", ean };
  if (parts[0] === "ajouter" && /^\d{8,14}$/.test(ean)) return { name: "contribute", ean };
  if (parts[0] === "ar") return { name: "ar" };
  return { name: "scan" };
}
