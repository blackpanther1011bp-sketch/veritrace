import { useEffect, useReducer, useRef, useState } from "react";
import { GradeBadge } from "../components/Grade";
import { IconBack, IconChevron } from "../components/Icons";
import { fetchAlternatives, fetchProduct } from "../lib/api";
import { badgeOrigin, boundsOf, expandThinBox, mapToView, pickCentral, type Box, type Pt, type Size } from "../lib/arGeometry";
import { formatEan } from "../lib/barcode";
import { cameraErrorMessage, createDetector, openBackCamera, setTorch, torchAvailable, tuneForBarcodes } from "../lib/camera";
import { compareProducts } from "../lib/compare";
import { GRADE_COLOR, LEVEL_COLOR, VERDICT } from "../lib/grades";
// « t » désigne ici l'article suivi par la caméra : la traduction s'appelle tr
import { t as tr } from "../lib/i18n";
import { formatNumber } from "../lib/reliability";
import { parseScannedCode } from "../lib/outils";
import { goBack, navigate } from "../lib/router";
import { addToHistory } from "../lib/storage";
import { track } from "../lib/track";
import type { Grade, Product } from "../lib/types";

/**
 * Réalité augmentée légère : un viseur flotte au centre de l'image ; dès qu'un code-barres est vu, il se
 * verrouille dessus et le suit à chaque image, puis la note du vêtement se déploie à côté, reliée au code
 * par un trait. Le bord de l'image prend la couleur de la note.
 */

const LOST_AFTER_MS = 900;
const BADGE: Size = { width: 264, height: 76 };
const MINT = "#3ddc97";
/** Viseur au repos, centré dans la zone caméra. */
const IDLE: Size = { width: 250, height: 150 };
/** Distance entre le code-barres et son badge (place du trait de liaison). */
const LEADER = 26;
const PILL: Size = { width: 48, height: 48 };
const CARD: Size = { width: 300, height: 286 };
const BOTTOM_RESERVED = 180;
const TOP_RESERVED = 72;

type Lookup = "loading" | "found" | "missing" | "error";

interface Tracked {
  ean: string;
  lookup: Lookup;
  product: Product | null;
  points: Pt[];
  lastSeen: number;
  /** dernière position connue à l'écran (la fiche enrichie y reste quand le code sort de l'image) */
  lastBox?: Box;
  /** alternatives mieux notées (chargées à l'ouverture de la fiche enrichie) */
  alternatives?: Product[] | null;
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixBox = (a: Box, b: Box, k: number): Box => ({
  left: mix(a.left, b.left, k),
  top: mix(a.top, b.top, k),
  right: mix(a.right, b.right, k),
  bottom: mix(a.bottom, b.bottom, k),
});
const boxGap = (a: Box, b: Box) =>
  Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.right - b.right), Math.abs(a.bottom - b.bottom));
const pad = (b: Box, by: number): Box => ({ left: b.left - by, top: b.top - by, right: b.right + by, bottom: b.bottom + by });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Inclinaison du code-barres dans l'image, en degrés (0 quand il est droit ; ignorée au-delà de 35°). */
function rollOf(points: ReadonlyArray<Pt>): number {
  if (points.length < 2) return 0;
  let a = (Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) * 180) / Math.PI;
  while (a >= 90) a -= 180;
  while (a < -90) a += 180;
  return Math.abs(a) > 35 ? 0 : a;
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Les quatre coins du viseur, tracés autour d'un cadre. */
function corners(b: Box): string {
  const c = Math.min(26, (b.right - b.left) / 3, (b.bottom - b.top) / 3);
  const { left: l, top: t, right: r, bottom: m } = b;
  return [
    `M${l} ${t + c}V${t}H${l + c}`,
    `M${r - c} ${t}H${r}V${t + c}`,
    `M${r} ${m - c}V${m}H${r - c}`,
    `M${l + c} ${m}H${l}V${m - c}`,
  ].join("");
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
  // positions lissées à chaque image : le viseur et les badges glissent avec le code-barres au lieu de sauter
  const smoothRef = useRef(new Map<string, Box>());
  const reticleRef = useRef<Box | null>(null);
  const reticleTargetRef = useRef<Box | null>(null);
  // inclinaison lissée du code visé : le panneau penche avec l'étiquette
  const rollRef = useRef(0);
  const [status, setStatus] = useState<"starting" | "running" | "error">("starting");
  const [errorMessage, setErrorMessage] = useState("");
  const [torch, setTorchState] = useState({ available: false, on: false });
  // fiche enrichie ouverte dans la caméra (code-barres concerné) et comparateur
  const [cardEan, setCardEan] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  // aide quand rien n'est reconnu : conseils après quelques secondes, ou code interne d'une enseigne
  const [help, setHelp] = useState<"none" | "tips" | "storeCode">("none");

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
      await tuneForBarcodes(stream);
      const detector = await createDetector();
      if (cancelled) return;
      setStatus("running");
      const startedAt = Date.now();
      let storeCodeHits = 0;
      setTorchState({ available: torchAvailable(stream), on: false });

      const tick = async () => {
        if (cancelled) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const codes = await detector.detect(video);
            const now = Date.now();
            const source = { width: video.videoWidth, height: video.videoHeight };
            for (const code of codes) {
              const scanned = parseScannedCode(code.rawValue);
              if (!scanned) {
                // code lu mais qui n'est pas un code-barres universel : code interne de l'enseigne
                if (code.rawValue.trim().length >= 6 && ++storeCodeHits === 3) setHelp("storeCode");
                continue;
              }
              if (scanned.kind === "passport") {
                // QR code d'un passeport numérique : on ouvre directement sa page
                cancelled = true;
                navigator.vibrate?.(40);
                track("passport_view");
                navigate(`/passeport/${scanned.id}`);
                return;
              }
              const ean = scanned.gtin;
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
            if (trackedRef.current.size > 0) setHelp("none");
            else if (storeCodeHits < 3 && now - startedAt > 8000) setHelp((h) => (h === "none" ? "tips" : h));
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

  useEffect(() => {
    const still = reducedMotion();
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const k = still ? 1 : 1 - Math.exp(-dt / 55);
      const kReticle = still ? 1 : 1 - Math.exp(-dt / 85);
      let moved = false;
      for (const t of trackedRef.current.values()) {
        if (!isVisible(t)) {
          smoothRef.current.delete(t.ean);
          continue;
        }
        const target = expandThinBox(boundsOf(t.points));
        const prev = smoothRef.current.get(t.ean);
        const next = prev ? mixBox(prev, target, k) : target;
        if (!prev || boxGap(prev, next) > 0.25) {
          smoothRef.current.set(t.ean, next);
          moved = true;
        }
      }
      const target = reticleTargetRef.current;
      if (target) {
        const prev = reticleRef.current;
        const next = prev ? mixBox(prev, target, kReticle) : target;
        if (!prev || boxGap(prev, next) > 0.25) {
          reticleRef.current = next;
          moved = true;
        }
      }
      const aimed = primaryRef.current ? trackedRef.current.get(primaryRef.current) : undefined;
      const roll = !still && aimed && isVisible(aimed) ? rollOf(aimed.points) : 0;
      if (Math.abs(roll - rollRef.current) > 0.15) {
        rollRef.current = mix(rollRef.current, roll, kReticle);
        moved = true;
      }
      if (moved) rerender();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
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
        openCard(t);
        return;
      case "missing":
        addToHistory({ ean: t.ean, name: null, brand: null, grade: null });
        navigate(`/inconnu/${t.ean}`);
        return;
    }
  }

  /** Fiche enrichie : répartition de l'impact, pays, alternatives, sans quitter la caméra. */
  function openCard(t: Tracked) {
    setCardEan(t.ean);
    track("ar_card_open", { ean: t.ean, grade: t.product?.global_grade });
    if (t.alternatives === undefined && t.product && t.product.global_grade !== "A") {
      t.alternatives = null;
      fetchAlternatives(t.ean)
        .then((list) => {
          t.alternatives = list;
        })
        .catch(() => {
          t.alternatives = [];
        })
        .finally(rerender);
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
    .map((t) => ({ key: t.ean, tracked: t, box: smoothRef.current.get(t.ean) ?? expandThinBox(boundsOf(t.points)) }));
  for (const v of visible) v.tracked.lastBox = v.box;
  // comparateur : tous les articles reconnus pendant la visite, du mieux au moins bien noté
  const comparison = compareProducts(
    [...trackedRef.current.values()].filter((t) => t.lookup === "found" && t.product).map((t) => t.product!),
  );
  const bestEan = comparison?.best.ean ?? null;
  const cardTracked = cardEan ? trackedRef.current.get(cardEan) ?? null : null;
  // plusieurs étiquettes à l'image : le code le plus proche du centre a le grand badge, les autres une pastille
  const center = { x: view.width / 2, y: (TOP_RESERVED + view.height - BOTTOM_RESERVED) / 2 };
  const primary = pickCentral(visible, center, primaryRef.current);
  if (primary) primaryRef.current = primary.key;
  const focused = primaryRef.current ? trackedRef.current.get(primaryRef.current) ?? null : null;
  const place = (box: Box, size: Size, margin?: number) =>
    badgeOrigin({ box, view, badge: size, topLimit: TOP_RESERVED, bottomReserved: BOTTOM_RESERVED, margin });

  // viseur : au repos au centre, verrouillé autour du code visé
  const idle: Box = {
    left: center.x - IDLE.width / 2,
    top: center.y - IDLE.height / 2,
    right: center.x + IDLE.width / 2,
    bottom: center.y + IDLE.height / 2,
  };
  reticleTargetRef.current = view.width > 0 ? (primary ? pad(primary.box, 10) : idle) : null;
  const reticle = reticleRef.current ?? reticleTargetRef.current;
  const grade: Grade | null = primary?.tracked.lookup === "found" ? primary.tracked.product!.global_grade : null;
  const hue = grade ? GRADE_COLOR[grade] : MINT;
  const badgeAt = primary && primary.key !== cardEan ? place(primary.box, BADGE, LEADER) : null;
  // faisceau de lumière : le panneau est « projeté » depuis le code-barres
  let beam: { y0: number; y1: number; points: string; anchor: Pt } | null = null;
  if (primary && badgeAt && reticle) {
    const cx = (reticle.left + reticle.right) / 2;
    const half = Math.min(46, (reticle.right - reticle.left) / 4);
    const [l, r] = [badgeAt.x + 22, badgeAt.x + BADGE.width - 22];
    const cone = (from: number, to: number) => ({ y0: from, y1: to, points: `${cx - half},${from} ${cx + half},${from} ${r},${to} ${l},${to}`, anchor: { x: cx, y: from } });
    if (badgeAt.y + BADGE.height <= reticle.top - 6) beam = cone(reticle.top, badgeAt.y + BADGE.height);
    else if (badgeAt.y >= reticle.bottom + 6) beam = cone(reticle.bottom, badgeAt.y);
  }
  // relief : le panneau pivote selon la place du code dans l'image et penche avec l'étiquette
  const tiltOf = (box: Box, strength = 1) => {
    if (reducedMotion() || view.width === 0) return "";
    const ry = clamp(((box.left + box.right) / 2 - view.width / 2) / (view.width / 2), -1, 1) * 16 * strength;
    const rx = -clamp(((box.top + box.bottom) / 2 - center.y) / (view.height / 2), -1, 1) * 12 * strength;
    return ` perspective(640px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateZ(${(rollRef.current * strength).toFixed(1)}deg)`;
  };

  return (
    <div className="ar" ref={rootRef}>
      <video ref={videoRef} className="ar-video" playsInline muted autoPlay aria-label={tr("common.cameraImage")} />

      <div className="ar-aura" style={{ color: grade ? GRADE_COLOR[grade] : "transparent", opacity: grade ? 0.6 : 0 }} aria-hidden="true" />

      <svg className={primary ? "ar-overlay ar-locked" : "ar-overlay"} width={view.width} height={view.height} style={{ color: hue }} aria-hidden="true">
        {reticle && status === "running" && (
          <>
            {primary && (
              <rect
                className="ar-lock-fill"
                x={reticle.left}
                y={reticle.top}
                width={reticle.right - reticle.left}
                height={reticle.bottom - reticle.top}
                rx="6"
              />
            )}
            {primary?.tracked.lookup === "loading" && (
              <rect
                className="ar-beam"
                x={reticle.left + 4}
                y={reticle.top}
                width={Math.max(0, reticle.right - reticle.left - 8)}
                height="2"
                style={{ "--travel": `${reticle.bottom - reticle.top - 2}px` } as React.CSSProperties}
              />
            )}
            {primary && (
              <circle
                key={`pulse-${primary.key}`}
                className="ar-pulse"
                cx={(reticle.left + reticle.right) / 2}
                cy={(reticle.top + reticle.bottom) / 2}
                r={Math.max(reticle.right - reticle.left, reticle.bottom - reticle.top) / 2}
              />
            )}
            <path className="ar-reticle" d={corners(reticle)} />
            {beam && (
              <>
                <defs>
                  <linearGradient id="ar-beam-fill" gradientUnits="userSpaceOnUse" x1="0" y1={beam.y0} x2="0" y2={beam.y1}>
                    <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0.06" />
                  </linearGradient>
                </defs>
                <polygon className="ar-cone" points={beam.points} fill="url(#ar-beam-fill)" />
                <circle className="ar-anchor" cx={beam.anchor.x} cy={beam.anchor.y} r="4" />
              </>
            )}
          </>
        )}
      </svg>

      {visible
        .filter((v) => v !== primary && v.key !== cardEan)
        .map((v) => (
          <ArPill key={`pill-${v.key}`} tracked={v.tracked} best={v.key === bestEan} origin={place(v.box, PILL, 6)} onOpen={() => open(v.tracked)} />
        ))}
      {primary && badgeAt && (
        <ArBadge
          key={`badge-${primary.key}-${primary.tracked.lookup}`}
          tracked={primary.tracked}
          best={primary.key === bestEan}
          origin={badgeAt}
          tilt={tiltOf(primary.box)}
          onOpen={() => open(primary.tracked)}
        />
      )}
      {cardTracked?.product && cardTracked.lastBox && (
        <ArCard
          tracked={cardTracked}
          best={cardTracked.ean === bestEan && comparison !== null}
          origin={place(cardTracked.lastBox, CARD)}
          tilt={tiltOf(cardTracked.lastBox, 0.5)}
          onClose={() => setCardEan(null)}
        />
      )}

      <div className="ar-top">
        <button type="button" className="ar-round" aria-label={tr("common.back")} onClick={() => goBack("/")}>
          <IconBack />
        </button>
        <span className="ar-title">{tr("ar.aim")}</span>
        {torch.available ? (
          <button
            type="button"
            className={torch.on ? "ar-round ar-round-on" : "ar-round"}
            aria-label={torch.on ? tr("common.torchOff") : tr("common.torchOn")}
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

      {status === "starting" && <p className="ar-status">{tr("common.openingCamera")}</p>}

      {status === "error" ? (
        <div className="ar-error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/?saisie=1", { replace: true })}>
            {tr("common.enterCodeByHand")}
          </button>
          <button type="button" className="btn btn-text ar-error-back" onClick={() => goBack("/")}>
            {tr("common.back")}
          </button>
        </div>
      ) : (
        <div className="ar-bottom">
          {comparison && (
            <button
              type="button"
              className="compare-bar"
              onClick={() => {
                setCompareOpen(true);
                track("compare_view", { ean: comparison.best.ean, grade: comparison.best.global_grade });
              }}
            >
              <Crown size={22} />
              <span className="row-text">
                <span className="compare-title">{tr("ar.best", { name: comparison.best.name, grade: comparison.best.global_grade })}</span>
                <span className="compare-sub">{tr(comparison.note.key, comparison.note.vars)}</span>
              </span>
              <span className="compare-count">{tr("ar.compare", { n: comparison.ranked.length })}</span>
            </button>
          )}
          {focused ? (
            <FocusCard tracked={focused} onOpen={() => open(focused)} />
          ) : help === "none" ? (
            <p className="ar-hint">{tr("ar.hint")}</p>
          ) : (
            <div className="ar-help" role="status">
              <p className="ar-help-title">{tr(help === "storeCode" ? "ar.helpStoreTitle" : "ar.helpTipsTitle")}</p>
              <p className="ar-help-text">{tr(help === "storeCode" ? "ar.helpStoreText" : "ar.helpTipsText")}</p>
              <div className="ar-help-actions">
                <button type="button" className="btn btn-primary" onClick={() => navigate("/etiquette-direct", { replace: true })}>
                  {tr("ar.helpReadLabel")}
                </button>
                <button type="button" className="btn btn-ghost-light" onClick={() => navigate("/?saisie=1", { replace: true })}>
                  {tr("common.enterCodeByHand")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {compareOpen && comparison && (
        <div className="scrim" onClick={() => setCompareOpen(false)}>
          <section className="sheet-dialog compare-sheet" role="dialog" aria-modal="true" aria-labelledby="compare-title" onClick={(e) => e.stopPropagation()}>
            <span className="handle" aria-hidden="true" />
            <h2 id="compare-title" className="dialog-title">
              {tr("ar.compareTitle")}
            </h2>
            <p className="muted-sm">{tr("ar.compareText")}</p>
            <ol className="compare-list">
              {comparison.ranked.map((p, i) => (
                <li key={p.ean}>
                  <button type="button" className="row-card" onClick={() => navigate(`/p/${p.ean}`)}>
                    <span className="compare-rank">{i === 0 ? <Crown size={18} /> : i + 1}</span>
                    <GradeBadge grade={p.global_grade} />
                    <span className="row-text">
                      <span className="row-title">{p.name}</span>
                      <span className="row-sub">
                        {[p.brand.name, formatNumber(p.eco_cost, 0) && tr("common.pts", { n: formatNumber(p.eco_cost, 0)! })].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <IconChevron size={20} className="row-chevron" />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="btn btn-text"
              onClick={() => {
                trackedRef.current.clear();
                smoothRef.current.clear();
                primaryRef.current = null;
                setCardEan(null);
                setCompareOpen(false);
              }}
            >
              {tr("ar.clear")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCompareOpen(false)}>
              {tr("ar.continue")}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

/** Couronne du meilleur article de la comparaison. */
function Crown({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#F2C94C" stroke="#7A5B00" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Fiche enrichie accrochée au code-barres : verdict, répartition de l'impact, pays, composition et meilleure
 * alternative, sans quitter la caméra.
 */
function ArCard({ tracked, best, origin, tilt, onClose }: { tracked: Tracked; best: boolean; origin: Pt; tilt: string; onClose: () => void }) {
  const p = tracked.product!;
  const bars = [...p.carbon_breakdown].sort((a, b) => b.share - a.share).slice(0, 3);
  const alts = tracked.alternatives;
  const cost = formatNumber(p.eco_cost, 0);
  return (
    <section
      className="ar-card"
      style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)${tilt}`, "--hue": GRADE_COLOR[p.global_grade] } as React.CSSProperties}
      aria-label={tr("ar.cardAria", { name: p.name, grade: p.global_grade })}
    >
      <div className="ar-card-head">
        <span className="ar-card-grade">
          <GradeRing tracked={tracked} size={52} />
          {best && (
            <span className="ar-crown" title={tr("ar.bestScanned")}>
              <Crown size={18} />
            </span>
          )}
        </span>
        <span className="ar-badge-text">
          <span className="ar-badge-title">{VERDICT[p.global_grade].title}</span>
          <span className="ar-badge-sub">{[p.brand.name, cost && tr("common.pts", { n: cost })].filter(Boolean).join(" · ")}</span>
        </span>
        <button type="button" className="ar-card-close" aria-label={tr("ar.closeCard")} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="ar-card-bars">
        {bars.map((b, i) => (
          <div key={b.label} className="ar-card-bar" style={{ "--i": i } as React.CSSProperties}>
            <span className="ar-card-bar-label">{b.label}</span>
            <span className="ar-card-track">
              <span style={{ width: `${Math.max(4, b.share)}%`, background: LEVEL_COLOR[b.level] }} />
            </span>
            <span className="ar-card-pct">{b.share} %</span>
          </div>
        ))}
      </div>
      <p className="ar-card-facts">
        {[p.origin_country && !/^non /i.test(p.origin_country) ? tr("ar.madeIn", { country: p.origin_country }) : null, p.composition && !/^non /i.test(p.composition) ? p.composition : null]
          .filter(Boolean)
          .join(" · ") || tr("ar.noFacts")}
      </p>
      {p.global_grade !== "A" && (
        <button type="button" className="ar-card-alt" onClick={() => navigate(`/p/${p.ean}/alternatives`)} disabled={!alts || alts.length === 0}>
          {alts === undefined || alts === null
            ? tr("ar.searchingAlt")
            : alts.length === 0
              ? tr("ar.noAlt")
              : alts.length > 1
                ? tr("ar.betterMany", { name: alts[0].name, grade: alts[0].global_grade, n: alts.length })
                : tr("ar.betterOne", { name: alts[0].name, grade: alts[0].global_grade })}
        </button>
      )}
      <button type="button" className="ar-card-more" onClick={() => navigate(`/p/${p.ean}`)}>
        {tr("ar.fullCard")} <IconChevron size={16} />
      </button>
    </section>
  );
}

function describe(t: Tracked): { title: string; subtitle: string } {
  const p = t.product;
  switch (t.lookup) {
    case "loading":
      return { title: tr("ar.analyzing"), subtitle: tr("common.ean", { code: formatEan(t.ean) }) };
    case "found":
      // Coût environnemental (points) affiché avec la note dès qu'il est connu (règles françaises du 1er octobre 2026)
      return {
        title: p!.name,
        subtitle:
          p!.eco_cost != null
            ? tr("ar.costGrade", { n: formatNumber(p!.eco_cost, 0)!, grade: p!.global_grade })
            : tr("ar.carbonSocial", { carbon: p!.carbon_grade, social: p!.social_grade ?? tr("ar.socialNone") }),
      };
    case "missing":
      return { title: tr("ar.notListed"), subtitle: tr("ar.tapReport") };
    case "error":
      return { title: tr("ar.offline"), subtitle: tr("ar.tapRetry") };
  }
}

/** Compteur qui monte jusqu'à la valeur (coût environnemental), à l'apparition du badge. */
function useCountUp(target: number | null, ms = 700): number | null {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const duration = reducedMotion() ? 0 : ms;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = duration === 0 ? 1 : Math.min(1, (now - t0) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return target === null ? null : value;
}

/** Note entourée d'un anneau qui se trace à l'apparition ; anneau tournant pendant la recherche. */
function GradeRing({ tracked, size = 52 }: { tracked: Tracked; size?: number }) {
  const r = size / 2 - 2;
  const length = 2 * Math.PI * r;
  const state = tracked.lookup === "loading" ? " ar-ring-loading" : tracked.lookup === "error" ? " ar-ring-error" : "";
  return (
    <span className={`ar-ring${state}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} style={{ "--len": length } as React.CSSProperties} strokeDasharray={length} />
      </svg>
      {tracked.lookup === "loading" ? null : tracked.lookup === "error" ? (
        <span className="ar-offline" aria-hidden="true">!</span>
      ) : (
        <>
          <GradeBadge grade={tracked.product?.global_grade ?? null} size={size - 14} round />
          {/* anneau qui tourne autour de la note, comme sur le panneau 3D */}
          {tracked.lookup === "found" && <span className="ar-orbit" aria-hidden="true" />}
        </>
      )}
    </span>
  );
}

const hueOf = (t: Tracked) => (t.lookup === "found" && t.product ? GRADE_COLOR[t.product.global_grade] : t.lookup === "error" || t.lookup === "missing" ? "#c9d4cd" : MINT);

function ArBadge({ tracked, origin, tilt, onOpen, best = false }: { tracked: Tracked; origin: Pt; tilt: string; onOpen: () => void; best?: boolean }) {
  const { title, subtitle } = describe(tracked);
  const p = tracked.lookup === "found" ? tracked.product : null;
  const cost = useCountUp(p?.eco_cost ?? null);
  // à l'écran : le verdict et le coût qui monte ; le nom du vêtement reste dans le panneau du bas
  const shownTitle = p ? VERDICT[p.global_grade].title : title;
  const shownSub = p && cost !== null ? `${tr("common.pts", { n: formatNumber(cost, 0)! })} · ${tr("common.noteGrade", { grade: p.global_grade })}` : subtitle;
  return (
    <button
      type="button"
      className={best ? "ar-badge ar-best" : "ar-badge"}
      style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)${tilt}`, "--hue": hueOf(tracked) } as React.CSSProperties}
      onClick={onOpen}
      aria-label={`${title}. ${subtitle}${best ? `. ${tr("ar.bestScanned")}` : ""}`}
    >
      {best && (
        <span className="ar-crown">
          <Crown size={20} />
        </span>
      )}
      <GradeRing tracked={tracked} />
      <span className="ar-badge-text">
        <span className="ar-badge-title">{shownTitle}</span>
        <span className="ar-badge-sub">{shownSub}</span>
      </span>
      {tracked.lookup === "found" && <IconChevron size={20} className="row-chevron" />}
    </button>
  );
}

/** Pastille compacte (note seule) pour les autres codes-barres visibles. */
function ArPill({ tracked, origin, onOpen, best = false }: { tracked: Tracked; origin: Pt; onOpen: () => void; best?: boolean }) {
  const { title, subtitle } = describe(tracked);
  return (
    <button
      type="button"
      className={best ? "ar-pill ar-best" : "ar-pill"}
      style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)`, "--hue": hueOf(tracked) } as React.CSSProperties}
      onClick={onOpen}
      aria-label={`${title}. ${subtitle}${best ? `. ${tr("ar.bestScanned")}` : ""}`}
    >
      {best && (
        <span className="ar-crown">
          <Crown size={18} />
        </span>
      )}
      <GradeRing tracked={tracked} size={48} />
    </button>
  );
}

function FocusCard({ tracked, onOpen }: { tracked: Tracked; onOpen: () => void }) {
  const p = tracked.product;
  const lines: Record<Lookup, { title: string; subtitle: string }> = {
    loading: { title: tr("ar.analyzingCode"), subtitle: tr("common.ean", { code: formatEan(tracked.ean) }) },
    found: { title: p?.name ?? "", subtitle: tr("ar.tapOpen", { brand: p?.brand.name ?? "" }) },
    missing: { title: tr("ar.notListedLong"), subtitle: tr("ar.tapReport") },
    error: { title: tr("ar.connection"), subtitle: tr("ar.tapRetry") },
  };
  const { title, subtitle } = lines[tracked.lookup];
  return (
    <button type="button" className="row-card ar-focus" style={{ "--hue": hueOf(tracked) } as React.CSSProperties} onClick={onOpen}>
      <GradeBadge grade={p?.global_grade ?? null} />
      <span className="row-text">
        <span className="row-title">{title}</span>
        <span className="row-sub">{subtitle}</span>
      </span>
      <IconChevron size={20} className="row-chevron" />
    </button>
  );
}
