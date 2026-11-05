import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { IconArrow, IconInfo } from "../components/Icons";
import { SourcesCard } from "../components/Sources";
import { LEVEL_COLOR, LEVEL_LABEL, LEVEL_TEXT, STATUS_LABEL, STATUS_STYLE } from "../lib/grades";
import { monthNames, t } from "../lib/i18n";
import { navigate } from "../lib/router";
import { formatPeriod, isSourced, SOCIAL_MAX_POINTS, socialScore } from "../lib/social";
import { track } from "../lib/track";
import type { Product } from "../lib/types";
import { useProduct } from "./ProductScreen";
import { ErrorState, LoadingState } from "./States";

function socialNote(product: Product): string {
  const checks = product.brand.social_checks;
  if (product.social_grade === null) {
    if (isSourced(checks)) return t("details.socialIncomplete");
    return t("details.socialNone");
  }
  if (!isSourced(checks)) return t("details.socialDemo");
  const score = socialScore(checks);
  return t("details.socialScore", {
    score: score ? t("details.socialPoints", { points: score.points, max: SOCIAL_MAX_POINTS }) : t("details.socialScale"),
  });
}

export function DetailsScreen({ ean, initialTab }: { ean: string; initialTab: "carbone" | "social" }) {
  const { product, failed, retry } = useProduct(ean);
  const [tab, setTab] = useState<"carbone" | "social">(initialTab);

  useEffect(() => {
    if (product) track("details_view", { ean: product.ean, grade: product.global_grade });
  }, [product]);

  useEffect(() => {
    if (product === null) navigate(`/inconnu/${ean}`, { replace: true });
  }, [product, ean]);

  const header = <Header title={t("title.details")} backTo={`/p/${ean}`} backLabel={t("common.backProduct")} />;

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
        <div className="segmented" role="tablist" aria-label={t("details.tabs")}>
          <button type="button" role="tab" aria-selected={tab === "carbone"} className={tab === "carbone" ? "seg seg-on" : "seg"} onClick={() => setTab("carbone")}>
            {t("details.tabCarbon", { grade: product.carbon_grade })}
          </button>
          <button type="button" role="tab" aria-selected={tab === "social"} className={tab === "social" ? "seg seg-on" : "seg"} onClick={() => setTab("social")}>
            {t("details.tabSocial", { grade: product.social_grade ?? "–" })}
          </button>
        </div>

        {tab === "carbone" ? (
          <>
            <p className="lead">
              {product.data_source === "registre"
                ? t("details.leadRegistry")
                : product.data_source === "demo"
                  ? t("details.leadDemo")
                  : t("details.leadComputed")}
            </p>
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
            <SourcesCard product={product} />
          </>
        ) : (
          <>
            <p className="lead">{t("details.socialLead", { brand: product.brand.name })}</p>
            {isSourced(product.brand.social_checks) ? (
              <ul className="card social-checks" aria-label={t("details.socialChecksAria")}>
                {product.brand.social_checks.map((check) => {
                  const period = formatPeriod(check.source_period, monthNames());
                  const checked = formatPeriod(check.checked_at, monthNames());
                  return (
                    <li key={check.label} className="social-check">
                      <div className="split">
                        <span className="info-label">{check.label}</span>
                        <span className="status-pill" style={STATUS_STYLE[check.status]}>
                          {STATUS_LABEL[check.status]}
                        </span>
                      </div>
                      {check.detail && <p className="muted-sm social-detail">{check.detail}</p>}
                      <p className="muted-sm">
                        {t("details.source")}{" "}
                        <a href={check.source_url} target="_blank" rel="noopener noreferrer">
                          {check.source_title ?? t("details.seeSource")}
                        </a>
                        {period ? ` (${period})` : ""}
                        {checked ? ` · ${t("details.checkedOn", { date: checked })}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              product.brand.social_checks.length > 0 && (
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
              )
            )}
            <aside className="note">
              <IconInfo size={20} />
              <p>
                {socialNote(product)}{" "}
                {product.data_source !== "demo" && (
                  <a href="#/confidentialite?contact=1">{t("details.proofMissing")}</a>
                )}
              </p>
            </aside>
          </>
        )}
      </main>

      {product.global_grade !== "A" && (
        <footer className="actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/p/${product.ean}/alternatives`)}>
            {t("details.seeAlternatives")}
            <IconArrow size={20} />
          </button>
        </footer>
      )}
    </div>
  );
}
