import { useEffect, useRef, useState } from "react";
import { GradeBadge } from "../components/Grade";
import { Header } from "../components/Header";
import { IconCheck, IconChevron, IconLock } from "../components/Icons";
import { fetchAlternatives } from "../lib/api";
import { t, tn } from "../lib/i18n";
import { navigate } from "../lib/router";
import { isPremium, setPremium } from "../lib/storage";
import { track } from "../lib/track";
import type { Product } from "../lib/types";
import { useProduct } from "./ProductScreen";
import { ErrorState } from "./States";

// Affiché sur l'offre Premium : à remplacer par le vrai tarif.
const premiumPrice = () => t("alt.priceTbd");
const FREE_ALTERNATIVES = 1;

function tags(p: Product): string[] {
  const out: string[] = [];
  const comp = p.composition.toLowerCase();
  if (p.brand.kind === "seconde_main") out.push(t("alt.tagSecondHand"));
  if (comp.includes("bio")) out.push(t("alt.tagOrganic"));
  if (comp.includes("recyclé")) out.push(t("alt.tagRecycled"));
  if (comp.includes("lin")) out.push(t("alt.tagLinen"));
  if (p.origin_country === "Maroc" && p.brand.kind !== "seconde_main") out.push(t("alt.tagMorocco"));
  return out.slice(0, 3);
}

function AlternativeCard({ p }: { p: Product }) {
  return (
    <button type="button" className="card alt-card" onClick={() => navigate(`/p/${p.ean}`)}>
      <GradeBadge grade={p.global_grade} />
      <span className="row-text">
        <span className="row-title">{p.name}</span>
        <span className="row-sub">
          {p.brand.name} ·{" "}
          {p.brand.kind === "seconde_main" ? t("alt.thrift") : p.data_source === "registre" ? t("alt.registry") : t("alt.madeIn", { country: p.origin_country })}
        </span>
        <span className="tags">
          {tags(p).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </span>
      </span>
      <IconChevron size={20} className="row-chevron" />
    </button>
  );
}

export function AlternativesScreen({ ean }: { ean: string }) {
  const { product } = useProduct(ean);
  const [list, setList] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [premium, setPremiumState] = useState(isPremium);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const sheetButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    fetchAlternatives(ean)
      .then((l) => alive && setList(l))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [ean, attempt]);

  useEffect(() => {
    if (product) track("alternatives_view", { ean, grade: product.global_grade });
  }, [product, ean]);

  useEffect(() => {
    if (!sheetOpen) return;
    sheetButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  function openSheet() {
    track("premium_view", { ean });
    setSheetOpen(true);
  }

  function unlock() {
    setPremium(true);
    setPremiumState(true);
    setSheetOpen(false);
    setJustUnlocked(true);
    track("premium_start", { ean });
  }

  const header = <Header title={t("alt.title")} backTo={`/p/${ean}`} backLabel={t("common.backProduct")} />;

  if (failed && !list) {
    return (
      <div className="screen">
        {header}
        <ErrorState onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );
  }

  const free = list ? (premium ? list : list.slice(0, FREE_ALTERNATIVES)) : [];
  const lockedCount = list && !premium ? Math.max(0, list.length - FREE_ALTERNATIVES) : 0;

  return (
    <>
    <div className="screen" aria-hidden={sheetOpen ? true : undefined}>
      {header}
      <main className="content">
        {product && (
          <div className="context-chip">
            <GradeBadge grade={product.global_grade} size={28} />
            <span>
              {t("alt.insteadOf")} <strong>{product.name} · {product.brand.name}</strong>
            </span>
          </div>
        )}

        {!list ? (
          <>
            <div className="card skeleton" style={{ height: 110 }} />
            <div className="card skeleton" style={{ height: 110 }} />
          </>
        ) : list.length === 0 ? (
          <section className="card center-state">
            <p className="state-title">{t("alt.bestTitle")}</p>
            <p className="muted">{t("alt.bestText")}</p>
          </section>
        ) : (
          <>
            <p className="lead">{t("alt.lead")}</p>
            {free.map((p) => (
              <AlternativeCard key={p.ean} p={p} />
            ))}

            {justUnlocked && (
              <div className="banner-success" role="status">
                <IconCheck size={20} />
                {t("alt.premiumOn")}
              </div>
            )}

            {lockedCount > 0 && (
              <>
                {Array.from({ length: lockedCount }).map((_, i) => (
                  <div key={i} className="card alt-card alt-locked" aria-hidden="true">
                    <span className="skel-badge" />
                    <span className="row-text">
                      <span className="skel-line" style={{ width: "70%" }} />
                      <span className="skel-line skel-line-sm" style={{ width: "45%" }} />
                    </span>
                    <IconLock size={20} />
                  </div>
                ))}
                <section className="upsell">
                  <div className="upsell-head">
                    <IconLock size={22} />
                    <span>{tn("alt.locked", lockedCount)}</span>
                  </div>
                  <p>{t("alt.upsell")}</p>
                  <button type="button" className="btn btn-accent" onClick={openSheet}>
                    {t("alt.unlock")}
                  </button>
                </section>
              </>
            )}
          </>
        )}
      </main>

      <footer className="actions">
        <button type="button" className="btn btn-text" onClick={() => navigate("/")}>
          {t("common.scanAnother")}
        </button>
      </footer>
    </div>

      {sheetOpen && (
        <div className="scrim" onClick={() => setSheetOpen(false)}>
          <div className="sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="premium-title" onClick={(e) => e.stopPropagation()}>
            <span className="handle" aria-hidden="true" />
            <h2 id="premium-title" className="dialog-title">
              VeriTrace Premium
            </h2>
            <ul className="benefits">
              <li>
                <IconCheck size={20} /> {t("alt.benefitAll")}
              </li>
              <li>
                <IconCheck size={20} /> {t("alt.benefitHistory")}
              </li>
              <li>
                <IconCheck size={20} /> {t("alt.benefitAlerts")}
              </li>
            </ul>
            <p className="price">{premiumPrice()}</p>
            <button ref={sheetButton} type="button" className="btn btn-primary" onClick={unlock}>
              {t("alt.trial")}
            </button>
            <button type="button" className="btn btn-text" onClick={() => setSheetOpen(false)}>
              {t("alt.later")}
            </button>
            <p className="muted-xs">{t("alt.noPayment")}</p>
          </div>
        </div>
      )}
    </>
  );
}
