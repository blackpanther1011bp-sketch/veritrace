import { useEffect, useRef, useState } from "react";
import { buildPanelGlb } from "../lib/ar3d";
import { t } from "../lib/i18n";
import { track } from "../lib/track";
import type { Product } from "../lib/types";

type ModelViewer = HTMLElement & { canActivateAR: boolean; activateAR(): Promise<void> };
type Status = "loading" | "ready" | "error";

/**
 * Réalité augmentée ancrée : le panneau 3D de la note est posé sur une surface (table, étagère, sol)
 * et reste fixé dans l'espace quand on se déplace. iPhone : AR Quick Look (Safari) ; Android : WebXR (Chrome).
 * Chargé à la demande (moteur 3D d'environ 1 Mo).
 */
export default function ArPanel({ product, onClose }: { product: Product; onClose: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const viewer = useRef<ModelViewer | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [canAR, setCanAR] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    let mv: ModelViewer | null = null;
    track("ar3d_view", { ean: product.ean, grade: product.global_grade });
    (async () => {
      try {
        await import("@google/model-viewer");
        url = await buildPanelGlb(product);
        if (!alive || !stage.current) return;
        mv = document.createElement("model-viewer") as ModelViewer;
        const attrs: Record<string, string> = {
          src: url,
          alt: t("ar3d.alt", { grade: product.global_grade, name: product.name }),
          ar: "",
          "ar-modes": "webxr quick-look",
          "ar-placement": "floor",
          "camera-controls": "",
          "touch-action": "pan-y",
          "camera-orbit": "-18deg 78deg auto",
          "shadow-intensity": "0.8",
          "interaction-prompt": "none",
          exposure: "0.95",
        };
        for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
        mv.className = "ar3d-viewer";
        // bouton RA par défaut de model-viewer masqué : on affiche le nôtre, plus visible
        const hidden = document.createElement("span");
        hidden.slot = "ar-button";
        hidden.style.display = "none";
        mv.appendChild(hidden);
        mv.addEventListener("load", () => {
          if (!alive || !mv) return;
          setCanAR(mv.canActivateAR);
          setStatus("ready");
        });
        mv.addEventListener("error", () => alive && setStatus("error"));
        mv.addEventListener("ar-status", (e) => {
          const s = (e as CustomEvent<{ status: string }>).detail?.status;
          if (s === "session-started" || s === "object-placed") setPlacing(false);
          if (s === "failed" && alive) setPlacing(false);
        });
        stage.current.appendChild(mv);
        viewer.current = mv;
      } catch (err) {
        console.warn("Panneau 3D indisponible", err);
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
      mv?.remove();
      if (url) URL.revokeObjectURL(url);
    };
  }, [product]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function place() {
    const mv = viewer.current;
    if (!mv) return;
    setPlacing(true);
    track("ar3d_place", { ean: product.ean, grade: product.global_grade });
    try {
      await mv.activateAR();
    } finally {
      // AR Quick Look s'ouvre par-dessus la page : rien à attendre de plus
      window.setTimeout(() => setPlacing(false), 1500);
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <section className="sheet-dialog ar3d-sheet" role="dialog" aria-modal="true" aria-labelledby="ar3d-title" onClick={(e) => e.stopPropagation()}>
        <span className="handle" aria-hidden="true" />
        <h2 id="ar3d-title" className="dialog-title">
          {t("ar3d.title")}
        </h2>
        <div ref={stage} className="ar3d-stage">
          {status === "loading" && <p className="ar3d-msg">{t("ar3d.preparing")}</p>}
          {status === "error" && <p className="ar3d-msg">{t("ar3d.failed")}</p>}
        </div>
        {status === "ready" && canAR && (
          <p className="muted-sm">{t("ar3d.howto")}</p>
        )}
        {status === "ready" && !canAR && (
          <p className="muted-sm">{t("ar3d.unavailable")}</p>
        )}
        <button type="button" className="btn btn-primary" disabled={status !== "ready" || !canAR || placing} onClick={place}>
          {placing ? t("common.openingCamera") : t("ar3d.place")}
        </button>
        <button type="button" className="btn btn-text" onClick={onClose}>
          {t("common.close")}
        </button>
      </section>
    </div>
  );
}
