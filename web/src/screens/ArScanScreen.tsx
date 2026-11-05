import { useEffect, useReducer, useRef, useState } from "react";
import { GradeBadge } from "../components/Grade";
import { IconBack, IconChevron } from "../components/Icons";
import { fetchAlternatives, fetchProduct } from "../lib/api";
import { badgeOrigin, boundsOf, expandThinBox, mapToView, pickCentral, type Box, type Pt, type Size } from "../lib/arGeometry";
import { formatEan } from "../lib/barcode";
import { cameraErrorMessage, createDetector, openBackCamera, setTorch, torchAvailable } from "../lib/camera";
import { compareProducts } from "../lib/compare";
import { LEVEL_COLOR, VERDICT } from "../lib/grades";
// « t » désigne ici l'article suivi par la caméra : la traduction s'appelle tr
import { t as tr } from "../lib/i18n";
import { formatNumber } from "../lib/reliability";
import { parseScannedCode } from "../lib/outils";
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
  // fiche enrichie ouverte dans la caméra (code-barres concerné) et comparateur
  const [cardEan, setCardEan] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

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
              const scanned = parseScannedCode(code.rawValue);
              if (!scanned) continue;
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
    .map((t) => ({ key: t.ean, tracked: t, box: expandThinBox(boundsOf(t.points)) }));
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

  return (
    <div className="ar" ref={rootRef}>
      <video ref={videoRef} className="ar-video" playsInline muted autoPlay aria-label={tr("common.cameraImage")} />

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
        .filter((v) => v !== primary && v.key !== cardEan)
        .map((v) => (
          <ArPill key={`pill-${v.key}`} tracked={v.tracked} best={v.key === bestEan} origin={place(v.box, PILL, 6)} onOpen={() => open(v.tracked)} />
        ))}
      {primary && primary.key !== cardEan && (
        <ArBadge
          key={`badge-${primary.key}`}
          tracked={primary.tracked}
          best={primary.key === bestEan}
          origin={place(primary.box, BADGE)}
          onOpen={() => open(primary.tracked)}
        />
      )}
      {cardTracked?.product && cardTracked.lastBox && (
        <ArCard
          tracked={cardTracked}
          best={cardTracked.ean === bestEan && comparison !== null}
          origin={place(cardTracked.lastBox, CARD)}
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
          ) : (
            <p className="ar-hint">{tr("ar.hint")}</p>
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
function ArCard({ tracked, best, origin, onClose }: { tracked: Tracked; best: boolean; origin: Pt; onClose: () => void }) {
  const p = tracked.product!;
  const bars = [...p.carbon_breakdown].sort((a, b) => b.share - a.share).slice(0, 3);
  const alts = tracked.alternatives;
  const cost = formatNumber(p.eco_cost, 0);
  return (
    <section
      className="ar-card"
      style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)` }}
      aria-label={tr("ar.cardAria", { name: p.name, grade: p.global_grade })}
    >
      <div className="ar-card-head">
        <span className="ar-card-grade">
          <GradeBadge grade={p.global_grade} size={44} round />
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
        {bars.map((b) => (
          <div key={b.label} className="ar-card-bar">
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

function ArBadge({ tracked, origin, onOpen, best = false }: { tracked: Tracked; origin: Pt; onOpen: () => void; best?: boolean }) {
  const { title, subtitle } = describe(tracked);
  return (
    <button
      type="button"
      className={best ? "ar-badge ar-best" : "ar-badge"}
      style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)` }}
      onClick={onOpen}
      aria-label={`${title}. ${subtitle}${best ? `. ${tr("ar.bestScanned")}` : ""}`}
    >
      {best && (
        <span className="ar-crown">
          <Crown size={20} />
        </span>
      )}
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
function ArPill({ tracked, origin, onOpen, best = false }: { tracked: Tracked; origin: Pt; onOpen: () => void; best?: boolean }) {
  const { title, subtitle } = describe(tracked);
  return (
    <button
      type="button"
      className={best ? "ar-pill ar-best" : "ar-pill"}
      style={{ transform: `translate(${Math.round(origin.x)}px, ${Math.round(origin.y)}px)` }}
      onClick={onOpen}
      aria-label={`${title}. ${subtitle}${best ? `. ${tr("ar.bestScanned")}` : ""}`}
    >
      {best && (
        <span className="ar-crown">
          <Crown size={18} />
        </span>
      )}
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
    loading: { title: tr("ar.analyzingCode"), subtitle: tr("common.ean", { code: formatEan(tracked.ean) }) },
    found: { title: p?.name ?? "", subtitle: tr("ar.tapOpen", { brand: p?.brand.name ?? "" }) },
    missing: { title: tr("ar.notListedLong"), subtitle: tr("ar.tapReport") },
    error: { title: tr("ar.connection"), subtitle: tr("ar.tapRetry") },
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
