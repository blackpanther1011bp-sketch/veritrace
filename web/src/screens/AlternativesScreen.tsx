import { useEffect, useState } from "react";
import { GradeBadge } from "../components/Grade";
import { Header } from "../components/Header";
import { IconChevron } from "../components/Icons";
import { fetchAlternatives } from "../lib/api";
import { t } from "../lib/i18n";
import { navigate } from "../lib/router";
import { track } from "../lib/track";
import type { Product } from "../lib/types";
import { useProduct } from "./ProductScreen";
import { ErrorState } from "./States";

// Toutes les alternatives mieux notées sont gratuites : ce qui informe n'est jamais payant.
// L'abonnement VeriTrace+ (à venir) portera sur ce qui fait économiser : bons plans, revente, entretien.

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

  const header = <Header title={t("alt.title")} backTo={`/p/${ean}`} backLabel={t("common.backProduct")} />;

  if (failed && !list) {
    return (
      <div className="screen">
        {header}
        <ErrorState onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );
  }

  return (
    <div className="screen">
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
            {list.map((p) => (
              <AlternativeCard key={p.ean} p={p} />
            ))}
          </>
        )}
      </main>

      <footer className="actions">
        <button type="button" className="btn btn-text" onClick={() => navigate("/")}>
          {t("common.scanAnother")}
        </button>
      </footer>
    </div>
  );
}
