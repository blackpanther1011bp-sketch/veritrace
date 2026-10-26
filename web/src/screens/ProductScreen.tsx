import { useEffect, useState } from "react";
import { GradeBadge, GradeScale } from "../components/Grade";
import { Header, SampleTag } from "../components/Header";
import { CategoryIcon, IconArrow } from "../components/Icons";
import { ConfidencePill } from "../components/Sources";
import { fetchAlternatives, fetchProduct, getCachedProduct } from "../lib/api";
import { formatEan } from "../lib/barcode";
import { carbonSummary, GRADE_TINT, isBadGrade, STATUS_LABEL, VERDICT } from "../lib/grades";
import { navigate } from "../lib/router";
import { addToHistory } from "../lib/storage";
import { track, trackOnExit } from "../lib/track";
import type { Product } from "../lib/types";
import { ErrorState, LoadingState } from "./States";

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
  const weak = product.brand.social_checks.find((c) => c.status === "non" || c.status === "non_communique");
  if (weak) return `${weak.label} : ${STATUS_LABEL[weak.status].toLowerCase()}`;
  const partial = product.brand.social_checks.find((c) => c.status === "partiel");
  if (partial) return `${partial.label} : partielle`;
  return "Engagements sociaux vérifiés";
}

export function ProductScreen({ ean }: { ean: string }) {
  const { product, failed, retry } = useProduct(ean);
  const [altCount, setAltCount] = useState<number | null>(null);

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

  const header = <Header title="Résultat du scan" backTo="/" backLabel="Retour au scan" right={product?.is_sample ? <SampleTag /> : undefined} />;

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
            <span className="muted-sm">EAN {formatEan(product.ean)}</span>
          </div>
        </section>

        <section className="verdict" style={{ background: GRADE_TINT[product.global_grade] }}>
          <GradeBadge grade={product.global_grade} size={64} round />
          <div className="stack-4">
            <p className="verdict-title">{verdict.title}</p>
            <p className="verdict-text">{verdict.text}</p>
          </div>
        </section>

        <div className="grid-2">
          <button type="button" className="card tile" onClick={() => navigate(`/p/${product.ean}/details?onglet=carbone`)}>
            <span className="tile-head">
              <span className="tile-title">Carbone</span>
              <GradeBadge grade={product.carbon_grade} size={32} />
            </span>
            <GradeScale grade={product.carbon_grade} />
            <span className="muted-sm">{carbonSummary(product.carbon_breakdown)}</span>
          </button>
          <button type="button" className="card tile" onClick={() => navigate(`/p/${product.ean}/details?onglet=social`)}>
            <span className="tile-head">
              <span className="tile-title">Social</span>
              <GradeBadge grade={product.social_grade} size={32} />
            </span>
            <GradeScale grade={product.social_grade} />
            <span className="muted-sm">{socialSummary(product)}</span>
          </button>
        </div>

        <section className="card info-list">
          <div className="info-row">
            <span className="muted">Pays de fabrication</span>
            <span className="info-value">{product.origin_country}</span>
          </div>
          <div className="info-row">
            <span className="muted">Composition</span>
            <span className="info-value">{product.composition}</span>
          </div>
          <div className="info-row">
            <span className="muted">Transport</span>
            <span className="info-value">{product.transport}</span>
          </div>
          <button type="button" className="info-row info-row-btn" onClick={() => navigate(`/p/${product.ean}/details?onglet=carbone`)}>
            <span className="muted">Fiabilité des données</span>
            <ConfidencePill product={product} />
          </button>
        </section>
      </main>

      <footer className="actions">
        {hasAlternatives && (
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/p/${product.ean}/alternatives`)}>
            Voir {altCount} alternative{altCount! > 1 ? "s" : ""} mieux notée{altCount! > 1 ? "s" : ""}
            <IconArrow size={20} />
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={() => navigate(`/p/${product.ean}/details`)}>
          Comprendre la note
        </button>
      </footer>
    </div>
  );
}
