import { useEffect, useReducer, useRef, useState } from "react";
import { GradeBadge } from "../components/Grade";
import { IconBack, IconChevron } from "../components/Icons";
import { fetchProduct } from "../lib/api";
import { badgeOrigin, boundsOf, expandThinBox, mapToView, pickCentral, type Box, type Pt, type Size } from "../lib/arGeometry";
import { formatEan, isValidGtin, normalizeGtin } from "../lib/barcode";
import { cameraErrorMessage, createDetector, openBackCamera, setTorch, torchAvailable } from "../lib/camera";
import { goBack, navigate } from "../lib/router";
import { addToHistory } from "../lib/storage";
import { track } from "../lib/track";
import type { Product } from "../lib/types";

/**
 * Réalité augmentée légère : la note du vêtement s'affiche sur l'image de la
 * caméra, accrochée au code-barres, et le suit quand on bouge le téléphone.
 */

const LOST_AFTER_MS = 900;
const BADGE: Size = { width: 240, height: 68 };
const PILL: Size = { width: 48, height: 48 };
const BOTTOM_RESERVED = 180;
const TOP_RESERVED = 72;

type Lookup = "loading" | "found" | "missing" | "error";

interface Tracked {
  ean: string;
  lookup: Lookup;
  product: Product | null;
  points: Pt[];
  lastSeen: number;
}

const isVisible = (t: Tracked) => t.points.length >= 4 && Date.now() - t.lastSeen < LOST_AFTER_MS;

export default function ArScanScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackedRef = useRef(new Map<string, Tracked>());
  const viewRef = useRef<Size>({ width: 0, height: 0 });
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // code visé : grand badge, cadre vert et panneau du bas
  const primaryRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"starting" | "running" | "error">("starting");
  const [errorMessage, setErrorMessage] = useState("");
  const [torch, setTorchState] = useState({ available: false, on: false });

  function lookup(t: Tracked) {
    t.lookup = "loading";
    fetchProduct(t.ean)
      .then((p) => {
        t.product = p;
        t.lookup = p ? "found" : "missing";
        if (!p) track("not_found", { ean: t.ean });
      })
      .catch(() => {
        t.lookup = "error";
      })
      .finally(rerender);
  }

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const measure = () => {
      const el = rootRef.current;
      if (el) viewRef.current = { width: el.clientWidth, height: el.clientHeight };
    };
    measure();
    window.addEventListener("resize", measure);

    async function start() {
      let stream: MediaStream;
      try {
        stream = await openBackCamera();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(cameraErrorMessage(error));
          setStatus("error");
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // la lecture démarre au prochain geste sur certains navigateurs
      }
      const detector = await createDetector();
      if (cancelled) return;
      setStatus("running");
      setTorchState({ available: torchAvailable(stream), on: false });

      const tick = async () => {
        if (cancelled) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const codes = await detector.detect(video);
            const now = Date.now();
            const source = { width: video.videoWidth, height: video.videoHeight };
            for (const code of codes) {
              const ean = normalizeGtin(code.rawValue);
              if (!isValidGtin(ean)) continue;
              let t = trackedRef.current.get(ean);
              if (!t) {
                t = { ean, lookup: "loading", product: null, points: [], lastSeen: now };
                trackedRef.current.set(ean, t);
                navigator.vibrate?.(40);
                track("scan", { ean });
                lookup(t);
              }
              t.lastSeen = now;
              if (code.cornerPoints.length >= 4) {
                t.points = mapToView(code.cornerPoints, source, viewRef.current);
              }
            }
            rerender();
          } catch {
            // image illisible : on passe à la suivante
          }
        }
        if (!cancelled) timer = window.setTimeout(tick, 100);
      };
      void tick();
    }

    void start();
    // cache les badges dont le code-barres a quitté l'image
    const ticker = window.setInterval(rerender, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(ticker);
      window.removeEventListener("resize", measure);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function open(t: Tracked) {
    switch (t.lookup) {
      case "loading":
        return;
      case "error":
        lookup(t);
        rerender();
        return;
      case "found":
        navigate(`/p/${t.ean}`);
        return;
      case "missing":
        addToHistory({ ean: t.ean, name: null, brand: null, grade: null });
        navigate(`/inconnu/${t.ean}`);
        return;
    }
  }

  async function toggleTorch() {
    const next = !torch.on;
    try {
      await setTorch(streamRef.current, next);
      setTorchState({ available: true, on: next });
    } catch {
      setTorchState({ available: false, on: false });
    }
  }

  const view = viewRef.current;
  const visible = [...trackedRef.current.values()]
    .filter(isVisible)
    .map((t) => ({ key: t.ean, tracked: t, box: expandThinBox(boundsOf(t.points)) }));
  // plusieurs étiquettes à l'image : le code le plus proche du centre a le grand badge, les autres une pastille
  const center = { x: view.width / 2, y: (TOP_RESERVED + view.height - BOTTOM_RESERVED) / 2 };
  const primary = pickCentral(visible, center, primaryRef.current);
  if (primary) primaryRef.current = primary.key;
  const focused = primaryRef.current ? trackedRef.current.get(primaryRef.current) ?? null : null;
  const place = (box: Box, size: Size, margin?: number) =>
    badgeOrigin({ box, view, badge: size, topLimit: TOP_RESERVED, bottomReserved: BOTTOM_RESERVED, margin });

  return (
    <div className="ar" ref={rootRef}>
      <video ref={videoRef} className="ar-video" playsInline muted autoPlay aria-label="Image de la caméra" />

      <svg className="ar-overlay" width={view.width} height={view.height} aria-hidden="true">
        {primary && (
          <rect
            x={primary.box.left}
            y={primary.box.top}
            width={primary.box.right - primary.box.left}
            height={primary.box.bottom - primary.box.top}
            rx="10"
          />
        )}
      </svg>

      {visible
        .filter((v) => v !== primary)
        .map((v) => (
          <ArPill key={`pill-${v.key}`} tracked={v.tracked} origin={place(v.box, PILL, 6)} onOpen={() => open(v.tracked)} />
        ))}
      {primary && (
        <ArBadge key={`badge-${primary.key}`} tracked={primary.tracked} origin={place(primary.box, BADGE)} onOpen={() => open(primary.tracked)} />
      )}

      <div className="ar-top">
        <button type="button" className="ar-round" aria-label="Retour" onClick={() => goBack("/")}>
          <IconBack />
        </button>
        <span className="ar-title">Visez l'étiquette</span>
        {torch.available ? (
          <button
            type="button"
            className={torch.on ? "ar-round ar-round-on" : "ar-round"}
            aria-label={torch.on ? "Éteindre la lampe" : "Allumer la lampe"}
            aria-pressed={torch.on}
            onClick={toggleTorch}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 2h8l-1 6H9z" />
              <path d="M9 8h6v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
              <path d="M12 12v3" />
            </svg>
          </button>
        ) : (
          <span className="ar-round-spacer" />
        )}
      </div>

      {status === "starting" && <p className="ar-status">Ouverture de la caméra…</p>}

      {status === "error" ? (
        <div className="ar-error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/?saisie=1", { replace: true })}>
            Saisir le code à la main
          </button>
          <button type="button" className="btn btn-text ar-error-back" onClick={() => goBack("/")}>
            Retour
          </button>
        </div>
      ) : (
        <div className="ar-bottom">
          {focused ? (
            <FocusCard tracked={focused} onOpen={() => open(focused)} />
          ) : (
            <p className="ar-hint">Visez le code-barres : la note du vêtement apparaît directement dessus.</p>
          )}
        </div>
      )}
    </div>
  );
}

function describe(t: Tracked): { title: string; subtitle: string } {
  const p = t.product;
  switch (t.lookup) {
    case "loading":
      return { title: "Analyse…", subtitle: `EAN ${formatEan(t.ean)}` };
    case "found":
      return { title: p!.name, subtitle: `Carbone ${p!.carbon_grade} · Social ${p!.social_grade ?? "non évaluée"}` };
    case "missing":
      return { title: "Non référencé", subtitle: "Touchez pour le signaler" };
    case "error":
      return { title: "Hors connexion", subtitle: "Touchez pour réessayer" };
  }
}

function ArBadge({ tracked, origin, onOpen }: { tracked: Tracked; origin: Pt; onOpen: () => void }) {
  const { title, subtitle } = describe(tracked);
  return (
    <button
      type="button"
      className="ar-badge"
      style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)` }}
      onClick={onOpen}
      aria-label={`${title}. ${subtitle}`}
    >
      {tracked.lookup === "loading" ? (
        <span className="ar-spinner" aria-hidden="true" />
      ) : tracked.lookup === "error" ? (
        <span className="ar-offline" aria-hidden="true">!</span>
      ) : (
        <GradeBadge grade={tracked.product?.global_grade ?? null} size={40} round />
      )}
      <span className="ar-badge-text">
        <span className="ar-badge-title">{title}</span>
        <span className="ar-badge-sub">{subtitle}</span>
      </span>
      {tracked.lookup === "found" && <IconChevron size={20} className="row-chevron" />}
    </button>
  );
}

/** Pastille compacte (note seule) pour les autres codes-barres visibles. */
function ArPill({ tracked, origin, onOpen }: { tracked: Tracked; origin: Pt; onOpen: () => void }) {
  const { title, subtitle } = describe(tracked);
  return (
    <button
      type="button"
      className="ar-pill"
      style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)` }}
      onClick={onOpen}
      aria-label={`${title}. ${subtitle}`}
    >
      {tracked.lookup === "loading" ? (
        <span className="ar-spinner" aria-hidden="true" />
      ) : tracked.lookup === "error" ? (
        <span className="ar-offline" aria-hidden="true">!</span>
      ) : (
        <GradeBadge grade={tracked.product?.global_grade ?? null} size={40} round />
      )}
    </button>
  );
}

function FocusCard({ tracked, onOpen }: { tracked: Tracked; onOpen: () => void }) {
  const p = tracked.product;
  const lines: Record<Lookup, { title: string; subtitle: string }> = {
    loading: { title: "Analyse du code…", subtitle: `EAN ${formatEan(tracked.ean)}` },
    found: { title: p?.name ?? "", subtitle: `${p?.brand.name ?? ""} · touchez pour voir la fiche` },
    missing: { title: "Article pas encore référencé", subtitle: "Touchez pour le signaler" },
    error: { title: "Connexion impossible", subtitle: "Touchez pour réessayer" },
  };
  const { title, subtitle } = lines[tracked.lookup];
  return (
    <button type="button" className="row-card ar-focus" onClick={onOpen}>
      <GradeBadge grade={p?.global_grade ?? null} />
      <span className="row-text">
        <span className="row-title">{title}</span>
        <span className="row-sub">{subtitle}</span>
      </span>
      <IconChevron size={20} className="row-chevron" />
    </button>
  );
}
