import { useEffect, useReducer, useRef, useState } from "react";
import { GradeBadge } from "../components/Grade";
import { IconBack, IconCamera, IconChevron } from "../components/Icons";
import { badgeOrigin, mapToView, type Box, type Size } from "../lib/arGeometry";
import { cameraErrorMessage, openBackCamera, setTorch, torchAvailable } from "../lib/camera";
import { CATEGORIES } from "../lib/contribute";
import { VERDICT } from "../lib/grades";
import { compositionInText, labelLines, type Rect } from "../lib/labelLive";
import { createOcrWorker } from "../lib/ocr";
import { readLabel, ServiceError } from "../lib/outils";
import { goBack, navigate } from "../lib/router";
import { addToHistory } from "../lib/storage";
import { track } from "../lib/track";
import type { Product } from "../lib/types";

/**
 * Réalité augmentée sur l'étiquette cousue : on vise l'étiquette de composition, le texte est lu en continu
 * sur le téléphone, et la note s'affiche directement sur l'étiquette dès que la composition est complète.
 * Pas de photo à prendre, pas de code-barres nécessaire.
 */

const BADGE: Size = { width: 260, height: 72 };
const TOP_RESERVED = 72;
const BOTTOM_RESERVED = 230;
const MAX_SIDE = 1280; // taille de l'image analysée : assez nette pour lire, assez petite pour aller vite
const RETRY_AFTER_MS = 4000;
const CATEGORY_KEY = "vt_live_category";

type Phase = "scanning" | "sending" | "result" | "failed";

interface Frame {
  canvas: HTMLCanvasElement;
  /** passage des coordonnées de l'image analysée à celles de la vidéo */
  sx: number;
  sy: number;
  k: number;
}

function savedCategory(): string | null {
  try {
    const c = localStorage.getItem(CATEGORY_KEY);
    return c && (CATEGORIES as readonly string[]).includes(c) ? c : null;
  } catch {
    return null;
  }
}

/** Zone analysée, en fraction de l'écran : autour du cadre de visée (texte plus grand, lecture plus rapide). */
const ZONE = { x0: 0.04, y0: 0.13, x1: 0.96, y1: 0.7 };

/** Zone de visée de la vidéo (affichage « cover »), réduite si besoin pour la lecture. */
function grabVisible(video: HTMLVideoElement, view: Size, canvas: HTMLCanvasElement): Frame | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !view.width || !view.height) return null;
  const scale = Math.max(view.width / vw, view.height / vh);
  // coin haut-gauche de l'écran dans la vidéo, puis zone de visée
  const ox = (vw - view.width / scale) / 2;
  const oy = (vh - view.height / scale) / 2;
  const sx = ox + (ZONE.x0 * view.width) / scale;
  const sy = oy + (ZONE.y0 * view.height) / scale;
  const w = ((ZONE.x1 - ZONE.x0) * view.width) / scale;
  const h = ((ZONE.y1 - ZONE.y0) * view.height) / scale;
  const k = Math.min(1.5, MAX_SIDE / Math.max(w, h));
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext("2d")!.drawImage(video, sx, sy, w, h, 0, 0, canvas.width, canvas.height);
  return { canvas, sx, sy, k };
}

function toScreen(r: Rect, f: Frame, video: HTMLVideoElement, view: Size): Box {
  const pts = mapToView(
    [
      { x: f.sx + r.x0 / f.k, y: f.sy + r.y0 / f.k },
      { x: f.sx + r.x1 / f.k, y: f.sy + r.y1 / f.k },
    ],
    { width: video.videoWidth, height: video.videoHeight },
    view,
  );
  const pad = 10;
  return { left: pts[0].x - pad, top: pts[0].y - pad, right: pts[1].x + pad, bottom: pts[1].y + pad };
}

export default function LabelLiveScreen({ ean }: { ean: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewRef = useRef<Size>({ width: 0, height: 0 });
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const [camera, setCamera] = useState<"starting" | "running" | "error">("starting");
  const [cameraError, setCameraError] = useState("");
  const [engineReady, setEngineReady] = useState(false);
  const [torch, setTorchState] = useState({ available: false, on: false });
  const [category, setCategory] = useState<string | null>(savedCategory);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [seen, setSeen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // valeurs lues par la boucle de lecture (qui tourne hors du rendu React)
  const live = useRef({ category, phase, lastSentAt: 0, lastSent: "" });
  live.current.category = category;
  live.current.phase = phase;

  useEffect(() => {
    track("label_live_start", ean ? { ean } : {});
  }, [ean]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let worker: Awaited<ReturnType<typeof createOcrWorker>> | null = null;
    const canvas = document.createElement("canvas");

    const measure = () => {
      const el = rootRef.current;
      if (el) viewRef.current = { width: el.clientWidth, height: el.clientHeight };
      rerender();
    };
    measure();
    window.addEventListener("resize", measure);

    async function send(frame: Frame, text: string, key: string) {
      const cat = live.current.category;
      if (!cat) return;
      live.current.lastSent = key;
      live.current.lastSentAt = Date.now();
      setPhase("sending");
      try {
        const photo = await new Promise<Blob>((resolve, reject) =>
          frame.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image"))), "image/jpeg", 0.82),
        );
        const r = await readLabel({ photo, text, category: cat, ean, brand: "" });
        if (cancelled) return;
        navigator.vibrate?.(40);
        track("label_live_read", { ean: r.product.ean, grade: r.product.global_grade });
        addToHistory({ ean: r.product.ean, name: r.product.name, brand: r.product.brand.name, grade: r.product.global_grade });
        setProduct(r.product);
        setMessage(null);
        setPhase("result");
      } catch (err) {
        if (cancelled) return;
        const e = err instanceof ServiceError ? err : new ServiceError("serveur", "Erreur inattendue : réessayez.");
        // texte mal lu : on continue de lire (nouvel essai quand l'image change)
        if (["composition_incomplete", "composition_introuvable", "illisible"].includes(e.code)) {
          setMessage("Lecture imprécise : rapprochez-vous et gardez l'étiquette bien à plat.");
          setPhase("scanning");
        } else {
          setMessage(e.message);
          setPhase("failed");
        }
      }
    }

    async function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      const st = live.current;
      if (worker && video && video.readyState >= 2 && (st.phase === "scanning" || st.phase === "result")) {
        const frame = grabVisible(video, viewRef.current, canvas);
        if (frame) {
          try {
            const { data } = await worker.recognize(frame.canvas, {}, { text: true, blocks: true });
            if (cancelled) return;
            const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
            const rect = labelLines(lines);
            setBox(rect ? toScreen(rect, frame, video, viewRef.current) : null);
            if (live.current.phase === "scanning") {
              const c = compositionInText(data.text ?? "");
              setSeen(c.seen);
              if (c.preview) setPreview(c.preview);
              const key = c.preview ?? "";
              const tooSoon = key === live.current.lastSent && Date.now() - live.current.lastSentAt < RETRY_AFTER_MS;
              if (c.complete && live.current.category && !tooSoon) {
                // copie de l'image : le canvas est réutilisé pour l'image suivante
                const copy = document.createElement("canvas");
                copy.width = frame.canvas.width;
                copy.height = frame.canvas.height;
                copy.getContext("2d")!.drawImage(frame.canvas, 0, 0);
                void send({ ...frame, canvas: copy }, data.text ?? "", key);
              }
            }
          } catch {
            // image illisible : on passe à la suivante
          }
        }
      }
      if (!cancelled) timer = window.setTimeout(loop, live.current.phase === "result" ? 700 : 200);
    }

    async function start() {
      let stream: MediaStream;
      try {
        stream = await openBackCamera({ width: 1920, height: 1080 });
      } catch (error) {
        if (!cancelled) {
          setCameraError(cameraErrorMessage(error));
          setCamera("error");
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
      setCamera("running");
      setTorchState({ available: torchAvailable(stream), on: false });
      try {
        worker = await createOcrWorker();
      } catch {
        if (!cancelled) {
          setMessage("Le moteur de lecture n'a pas pu se charger : vérifiez la connexion Internet.");
          setPhase("failed");
        }
        return;
      }
      if (cancelled) {
        void worker.terminate();
        return;
      }
      setEngineReady(true);
      void loop();
    }

    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      void worker?.terminate();
    };
  }, [ean]);

  function chooseCategory(c: string) {
    setCategory(c);
    try {
      localStorage.setItem(CATEGORY_KEY, c);
    } catch {
      // préférence non mémorisée : sans conséquence
    }
  }

  function restart() {
    setProduct(null);
    setMessage(null);
    setPreview(null);
    setSeen(false);
    live.current.lastSent = "";
    setPhase("scanning");
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
  const complete = phase === "sending" || phase === "result";
  const origin = box ? badgeOrigin({ box, view, badge: BADGE, topLimit: TOP_RESERVED, bottomReserved: BOTTOM_RESERVED }) : null;

  let hint: string;
  if (!engineReady) hint = "Préparation de la lecture (environ 5 Mo la première fois)…";
  else if (phase === "sending") hint = "Composition lue : calcul de la note avec Ecobalyse…";
  else if (message) hint = message;
  else if (preview && !category) hint = `Composition lue : ${preview}. Choisissez le type de vêtement.`;
  else if (seen) hint = "Lecture en cours… Rapprochez-vous et gardez l'étiquette nette.";
  else hint = "Visez l'étiquette de composition (ex. « 100 % coton »). La note s'affiche dessus.";

  return (
    <div className="ar label-live" ref={rootRef}>
      <video ref={videoRef} className="ar-video" playsInline muted autoPlay aria-label="Image de la caméra" />

      <svg className="ar-overlay" width={view.width} height={view.height} aria-hidden="true">
        {box ? (
          <rect
            className={complete ? "live-box live-box-done" : "live-box"}
            x={box.left}
            y={box.top}
            width={Math.max(0, box.right - box.left)}
            height={Math.max(0, box.bottom - box.top)}
            rx="12"
          />
        ) : (
          camera === "running" &&
          phase === "scanning" && (
            <rect
              className="live-guide"
              x={view.width * (ZONE.x0 + 0.04)}
              y={view.height * (ZONE.y0 + 0.06)}
              width={view.width * (ZONE.x1 - ZONE.x0 - 0.08)}
              height={view.height * (ZONE.y1 - ZONE.y0 - 0.12)}
              rx="18"
            />
          )
        )}
      </svg>

      {origin && (phase === "sending" || (phase === "result" && product)) && (
        <button
          type="button"
          className="ar-badge live-badge"
          style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)` }}
          onClick={() => product && navigate(`/p/${product.ean}`)}
          aria-label={product ? `Note ${product.global_grade} : ${VERDICT[product.global_grade].title}` : "Calcul de la note"}
        >
          {product ? <GradeBadge grade={product.global_grade} size={44} round /> : <span className="ar-spinner" aria-hidden="true" />}
          <span className="ar-badge-text">
            <span className="ar-badge-title">{product ? VERDICT[product.global_grade].title : "Calcul de la note…"}</span>
            <span className="ar-badge-sub">{product ? product.composition : preview}</span>
          </span>
          {product && <IconChevron size={20} className="row-chevron" />}
        </button>
      )}

      <div className="ar-top">
        <button type="button" className="ar-round" aria-label="Retour" onClick={() => goBack(ean ? `/inconnu/${ean}` : "/")}>
          <IconBack />
        </button>
        <span className="ar-title">Visez l'étiquette cousue</span>
        {torch.available ? (
          <button type="button" className={torch.on ? "ar-round ar-round-on" : "ar-round"} aria-label={torch.on ? "Éteindre la lampe" : "Allumer la lampe"} aria-pressed={torch.on} onClick={toggleTorch}>
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

      {camera === "starting" && <p className="ar-status">Ouverture de la caméra…</p>}

      {camera === "error" ? (
        <div className="ar-error" role="alert">
          <p>{cameraError}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(ean ? `/etiquette/${ean}` : "/etiquette", { replace: true })}>
            Prendre une photo à la place
          </button>
          <button type="button" className="btn btn-text ar-error-back" onClick={() => goBack("/")}>
            Retour
          </button>
        </div>
      ) : (
        <div className="ar-bottom live-bottom">
          {phase === "result" && product ? (
            <>
              <button type="button" className="row-card ar-focus" onClick={() => navigate(`/p/${product.ean}`)}>
                <GradeBadge grade={product.global_grade} />
                <span className="row-text">
                  <span className="row-title">{product.name}</span>
                  <span className="row-sub">
                    {[product.origin_country !== "Non indiqué" ? product.origin_country : null, "touchez pour voir la fiche"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <IconChevron size={20} className="row-chevron" />
              </button>
              <button type="button" className="btn btn-text live-again" onClick={restart}>
                Lire une autre étiquette
              </button>
            </>
          ) : phase === "failed" ? (
            <>
              <p className="ar-hint" role="alert">
                {message}
              </p>
              <button type="button" className="btn btn-primary" onClick={restart}>
                Réessayer
              </button>
            </>
          ) : (
            <>
              <p className="ar-hint" aria-live="polite">
                {hint}
              </p>
              <div className="live-chips" role="radiogroup" aria-label="Type de vêtement">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === category} className={c === category ? "chip chip-on" : "chip"} onClick={() => chooseCategory(c)}>
                    {c}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-text live-photo" onClick={() => navigate(ean ? `/etiquette/${ean}` : "/etiquette")}>
                <IconCamera size={18} /> Prendre une photo à la place
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
