import { lazy, Suspense, useEffect, useState } from "react";
import { GradeBadge, GradeScale } from "../components/Grade";
import { Header, SampleTag } from "../components/Header";
import { CategoryIcon, IconArrow, IconChevron, IconCube } from "../components/Icons";
import { ConfidencePill } from "../components/Sources";
import { fetchAlternatives, fetchProduct, getCachedProduct } from "../lib/api";
import { formatEan } from "../lib/barcode";
import { carbonSummary, GRADE_TINT, isBadGrade, STATUS_LABEL, VERDICT } from "../lib/grades";
import { t, tn } from "../lib/i18n";
import { formatNumber } from "../lib/reliability";
import { navigate } from "../lib/router";
import { addToHistory } from "../lib/storage";
import { track, trackOnExit } from "../lib/track";
import type { Product } from "../lib/types";
import { ErrorState, LoadingState } from "./States";

// Réalité augmentée ancrée (moteur 3D) : chargée seulement quand on l'ouvre.
const ArPanel = lazy(() => import("../components/ArPanel"));

// Une vue de fiche n'est comptée qu'une fois par session (pas à chaque retour arrière).
const viewedThisSession = new Set<string>();

export function useProduct(ean: string) {
  const cached = getCachedProduct(ean);
  const [product, setProduct] = useState<Product | null | undefined>(cached);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    fetchProduct(ean)
      .then((p) => alive && setProduct(p))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [ean, attempt]);

  return { product, failed, retry: () => setAttempt((n) => n + 1) };
}

function socialSummary(product: Product): string {
  if (product.social_grade === null) return t("product.socialNone");
  const weak = product.brand.social_checks.find((c) => c.status === "non" || c.status === "non_communique");
  if (weak) return `${weak.label} : ${STATUS_LABEL[weak.status].toLowerCase()}`;
  const partial = product.brand.social_checks.find((c) => c.status === "partiel");
  if (partial) return t("product.socialPartial", { label: partial.label });
  return t("product.socialVerified");
}

export function ProductScreen({ ean }: { ean: string }) {
  const { product, failed, retry } = useProduct(ean);
  const [altCount, setAltCount] = useState<number | null>(null);
  const [arOpen, setArOpen] = useState(false);

  // Produit absent de la base : écran « introuvable »
  useEffect(() => {
    if (product === null) {
      track("not_found", { ean });
      addToHistory({ ean, name: null, brand: null, grade: null });
      navigate(`/inconnu/${ean}`, { replace: true });
    }
  }, [product, ean]);

  useEffect(() => {
    if (!product) return;
    if (!viewedThisSession.has(product.ean)) {
      viewedThisSession.add(product.ean);
      track("product_view", { ean: product.ean, grade: product.global_grade });
    }
    addToHistory({ ean: product.ean, name: product.name, brand: product.brand.name, grade: product.global_grade });
    let alive = true;
    fetchAlternatives(product.ean)
      .then((list) => alive && setAltCount(list.length))
      .catch(() => alive && setAltCount(null));
    return () => {
      alive = false;
    };
  }, [product]);

  // Ouverture directe de la réalité augmentée (lien « ?ra=1 », utilisé par l'app mobile)
  useEffect(() => {
    if (product && /[?&]ra=1\b/.test(window.location.hash)) setArOpen(true);
  }, [product]);

  // Mesure d'abandon : l'utilisateur quitte l'app sur un vêtement mal noté.
  useEffect(() => {
    if (!product || !isBadGrade(product.global_grade)) return;
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      trackOnExit("exit_after_bad_grade", { ean: product.ean, grade: product.global_grade });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") send();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
    };
  }, [product]);

  const header = <Header title={t("product.header")} backTo="/" backLabel={t("common.backScan")} right={product?.is_sample ? <SampleTag /> : undefined} />;

  if (failed && !product) {
    return (
      <div className="screen">
        {header}
        <ErrorState onRetry={retry} />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="screen">
        {header}
        <LoadingState />
      </div>
    );
  }

  const verdict = VERDICT[product.global_grade];
  const cost = formatNumber(product.eco_cost, 0);
  const hasAlternatives = altCount !== null && altCount > 0;

  return (
    <div className="screen">
      {header}
      <main className="content">
        <section className="card product-card">
          <div className="product-thumb">
            <CategoryIcon category={product.category} />
          </div>
          <div className="stack-2">
            <span className="overline-brand">{product.brand.name}</span>
            <span className="product-name">{product.name}</span>
            <span className="muted-sm">
              {product.reference ? `${t("common.ref", { ref: product.reference })} · ` : ""}
              {product.ean.startsWith("L") ? t("product.noBarcode") : t("common.ean", { code: formatEan(product.ean) })}
            </span>
          </div>
        </section>

        <section className="verdict" style={{ background: GRADE_TINT[product.global_grade] }}>
          <GradeBadge grade={product.global_grade} size={64} round />
          <div className="stack-4">
            <p className="verdict-kicker">{t("product.kicker")}</p>
            <p className="verdict-title">{verdict.title}</p>
            <p className="verdict-text">{verdict.text}</p>
          </div>
        </section>

        {cost && (
          <section className="card cost-card" aria-label={t("product.costAria")}>
            <span className="cost-value">
              {cost} <span className="cost-unit">{t("product.costUnit")}</span>
            </span>
            <span className="muted-sm">{product.data_source === "registre" ? t("product.costOfficial") : t("product.costEstimated")}</span>
          </section>
        )}

        <button type="button" className="row-card ar3d-open" onClick={() => setArOpen(true)}>
          <span className="ar3d-open-icon">
            <IconCube size={24} />
          </span>
          <span className="row-text">
            <span className="row-title">{t("product.arTitle")}</span>
            <span className="row-sub">{t("product.arSub")}</span>
          </span>
          <IconChevron size={20} className="row-chevron" />
        </button>

        <div className="grid-2">
          <button type="button" className="card tile" onClick={() => navigate(`/p/${product.ean}/details?onglet=carbone`)}>
            <span className="tile-head">
              <span className="tile-title">{t("common.carbon")}</span>
              <GradeBadge grade={product.carbon_grade} size={32} />
            </span>
            <GradeScale grade={product.carbon_grade} />
            <span className="muted-sm">{carbonSummary(product.carbon_breakdown)}</span>
          </button>
          <button type="button" className="card tile" onClick={() => navigate(`/p/${product.ean}/details?onglet=social`)}>
            <span className="tile-head">
              <span className="tile-title">{t("common.social")}</span>
              <GradeBadge grade={product.social_grade} size={32} />
            </span>
            <GradeScale grade={product.social_grade} />
            <span className="muted-sm">{socialSummary(product)}</span>
          </button>
        </div>

        <section className="card info-list">
          <div className="info-row">
            <span className="muted">{t("product.country")}</span>
            <span className="info-value">{product.origin_country}</span>
          </div>
          <div className="info-row">
            <span className="muted">{t("common.composition")}</span>
            <span className="info-value">{product.composition}</span>
          </div>
          <div className="info-row">
            <span className="muted">{t("common.transport")}</span>
            <span className="info-value">{product.transport}</span>
          </div>
          <button type="button" className="info-row info-row-btn" onClick={() => navigate(`/p/${product.ean}/details?onglet=carbone`)}>
            <span className="muted">{t("common.reliability")}</span>
            <ConfidencePill product={product} />
          </button>
        </section>
      </main>

      <footer className="actions">
        {hasAlternatives && (
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/p/${product.ean}/alternatives`)}>
            {tn("product.alternatives", altCount!)}
            <IconArrow size={20} />
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={() => navigate(`/p/${product.ean}/details`)}>
          {t("product.understand")}
        </button>
      </footer>

      {arOpen && (
        <Suspense
          fallback={
            <div className="scrim">
              <section className="sheet-dialog ar3d-sheet">
                <p className="ar3d-msg">{t("product.arLoading")}</p>
              </section>
            </div>
          }
        >
          <ArPanel
            product={product}
            onClose={() => {
              setArOpen(false);
              if (/[?&]ra=1\b/.test(window.location.hash)) navigate(`/p/${product.ean}`, { replace: true });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
