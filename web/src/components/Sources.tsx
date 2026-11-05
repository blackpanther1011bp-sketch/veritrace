import { CONFIDENCE_HELP, CONFIDENCE_LABEL, CONFIDENCE_STYLE, formatDate, formatNumber, isWebLink, SOURCE_LABEL } from "../lib/reliability";
import { t } from "../lib/i18n";
import type { Product } from "../lib/types";
import { GradeBadge } from "./Grade";
import { IconInfo } from "./Icons";

/** Pastille de fiabilité (« Coût officiel » pour le registre, « Démo » pour les produits fictifs). */
export function ConfidencePill({ product }: { product: Product }) {
  if (product.data_source === "registre") {
    return (
      <span className="status-pill" style={CONFIDENCE_STYLE.haute}>
        {t("sources.officialCost")}
      </span>
    );
  }
  if (product.data_source === "demo" || !product.confidence) {
    return (
      <span className="status-pill" style={{ color: "#4A5A50", background: "#E3E8E4" }}>
        {t("sources.demo")}
      </span>
    );
  }
  return (
    <span className="status-pill" style={CONFIDENCE_STYLE[product.confidence]}>
      {CONFIDENCE_LABEL[product.confidence]}
    </span>
  );
}

/** Bloc « Sources et fiabilité » de l'onglet Carbone : méthode, chiffres, source, hypothèses. */
export function SourcesCard({ product }: { product: Product }) {
  if (product.data_source === "demo") {
    return (
      <aside className="note">
        <IconInfo size={20} />
        <p>{t("sources.demoNote")}</p>
      </aside>
    );
  }

  const registry = product.data_source === "registre";
  const updated = formatDate(product.scored_at);
  const sourceDate = formatDate(product.source_date);
  const cost = formatNumber(product.eco_cost, 0);
  const climate = formatNumber(product.climate_kg, 1);

  return (
    <>
      <section className="card info-list" aria-label={t("sources.aria")}>
        <div className="info-row">
          <span className="muted">{t("common.method")}</span>
          <span className="info-value">{registry ? t("sources.methodRegistry") : t("sources.methodOfficial")}</span>
        </div>
        {cost && (
          <div className="info-row">
            <span className="muted">{t("sources.envCost")}</span>
            <span className="info-value sources-grade">
              {t("common.points", { n: cost })}
              {product.env_grade && <GradeBadge grade={product.env_grade} size={24} />}
            </span>
          </div>
        )}
        {climate && (
          <div className="info-row">
            <span className="muted">{t("sources.climate")}</span>
            <span className="info-value">{t("sources.climateValue", { n: climate })}</span>
          </div>
        )}
        <div className="info-row">
          <span className="muted">{t("sources.data")}</span>
          <span className="info-value">{SOURCE_LABEL[product.data_source]}</span>
        </div>
        <div className="info-row">
          <span className="muted">{t("sources.reliability")}</span>
          <ConfidencePill product={product} />
        </div>
        {updated && (
          <div className="info-row">
            <span className="muted">{registry ? t("sources.declaredOn") : t("sources.computedOn")}</span>
            <span className="info-value">{updated}</span>
          </div>
        )}
      </section>

      {registry ? (
        <p className="muted-sm">{t("sources.registryNote")}</p>
      ) : (
        product.confidence && <p className="muted-sm">{CONFIDENCE_HELP[product.confidence]}</p>
      )}

      {product.assumptions.length > 0 && (
        <aside className="note">
          <IconInfo size={20} />
          <div>
            <p className="note-title">{t("common.calcAssumptions")}</p>
            <ul className="note-list">
              {product.assumptions.map((a) => (
                <li key={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</li>
              ))}
            </ul>
          </div>
        </aside>
      )}

      <p className="muted-sm">{t("sources.gradeMethod")}</p>

      <div className="sources-links">
        {product.passport_id && (
          <a className="btn btn-outline" href={`#/passeport/${product.passport_id}`}>
            {t("sources.seePassport")}
          </a>
        )}
        {product.eco_web_url && (
          <a className="btn btn-outline" href={product.eco_web_url} target="_blank" rel="noopener noreferrer">
            {registry ? t("sources.seeOfficial") : t("common.seeOnEcobalyse")}
          </a>
        )}
        {registry ? null : isWebLink(product.source_ref) ? (
          <a className="btn btn-outline" href={product.source_ref.trim()} target="_blank" rel="noopener noreferrer">
            {sourceDate ? t("sources.seeSourceDated", { date: sourceDate }) : t("sources.seeSource")}
          </a>
        ) : (
          product.source_ref && (
            <p className="muted-sm">
              {sourceDate ? t("sources.sourceTextDated", { source: product.source_ref, date: sourceDate }) : t("sources.sourceText", { source: product.source_ref })}
            </p>
          )
        )}
      </div>
    </>
  );
}
