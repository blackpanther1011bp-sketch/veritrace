import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { IconArrow, IconInfo } from "../components/Icons";
import { LEVEL_COLOR, LEVEL_LABEL, LEVEL_TEXT, STATUS_LABEL, STATUS_STYLE } from "../lib/grades";
import { navigate } from "../lib/router";
import { track } from "../lib/track";
import { useProduct } from "./ProductScreen";
import { ErrorState, LoadingState } from "./States";

export function DetailsScreen({ ean, initialTab }: { ean: string; initialTab: "carbone" | "social" }) {
  const { product, failed, retry } = useProduct(ean);
  const [tab, setTab] = useState<"carbone" | "social">(initialTab);

  useEffect(() => {
    if (product) track("details_view", { ean: product.ean, grade: product.global_grade });
  }, [product]);

  useEffect(() => {
    if (product === null) navigate(`/inconnu/${ean}`, { replace: true });
  }, [product, ean]);

  const header = <Header title="Comprendre la note" backTo={`/p/${ean}`} backLabel="Retour à la fiche produit" />;

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

  return (
    <div className="screen">
      {header}
      <main className="content">
        <div className="segmented" role="tablist" aria-label="Type de note">
          <button type="button" role="tab" aria-selected={tab === "carbone"} className={tab === "carbone" ? "seg seg-on" : "seg"} onClick={() => setTab("carbone")}>
            Carbone · {product.carbon_grade}
          </button>
          <button type="button" role="tab" aria-selected={tab === "social"} className={tab === "social" ? "seg seg-on" : "seg"} onClick={() => setTab("social")}>
            Social · {product.social_grade}
          </button>
        </div>

        {tab === "carbone" ? (
          <>
            <p className="lead">D'où vient l'impact climat de ce vêtement :</p>
            <section className="card breakdown">
              {product.carbon_breakdown.map((item) => (
                <div key={item.label} className="stack-8">
                  <div className="split">
                    <span className="strong">{item.label}</span>
                    <span className="strong" style={{ color: LEVEL_TEXT[item.level] }}>
                      {LEVEL_LABEL[item.level]}
                    </span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <div className="bar-fill" style={{ width: `${item.share}%`, background: LEVEL_COLOR[item.level] }} />
                  </div>
                  <span className="muted-sm">{item.detail}</span>
                </div>
              ))}
            </section>
            <aside className="note">
              <IconInfo size={20} />
              <p>
                Notes d'exemple calculées pour la démo à partir de la matière, du pays de fabrication, de la teinture et du transport. Méthode sourcée à intégrer avant
                lancement (par exemple Ecobalyse).
              </p>
            </aside>
          </>
        ) : (
          <>
            <p className="lead">Engagements sociaux de la marque {product.brand.name} :</p>
            <section className="card info-list">
              {product.brand.social_checks.map((check) => (
                <div key={check.label} className="info-row">
                  <span className="info-label">{check.label}</span>
                  <span className="status-pill" style={STATUS_STYLE[check.status]}>
                    {STATUS_LABEL[check.status]}
                  </span>
                </div>
              ))}
            </section>
            <aside className="note">
              <IconInfo size={20} />
              <p>Données d'exemple. Sources à intégrer avant lancement : rapports d'audit, déclarations des marques, bases de données publiques.</p>
            </aside>
          </>
        )}
      </main>

      {product.global_grade !== "A" && (
        <footer className="actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/p/${product.ean}/alternatives`)}>
            Voir les alternatives
            <IconArrow size={20} />
          </button>
        </footer>
      )}
    </div>
  );
}
