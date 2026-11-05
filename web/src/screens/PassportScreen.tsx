import { useEffect, useState } from "react";
import { GradeBadge } from "../components/Grade";
import { Header } from "../components/Header";
import { IconInfo } from "../components/Icons";
import { formatEan } from "../lib/barcode";
import { t } from "../lib/i18n";
import { fetchPassport, passportJson, passportLink } from "../lib/outils";
import { CONFIDENCE_LABEL, CONFIDENCE_STYLE, formatDate, formatNumber } from "../lib/reliability";
import { navigate } from "../lib/router";
import { track } from "../lib/track";
import type { Passport } from "../lib/types";
import { ErrorState, LoadingState } from "./States";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Page publique du passeport numérique d'un vêtement (imprimable, avec QR code). */
export function PassportScreen({ id }: { id: string }) {
  const [passport, setPassport] = useState<Passport | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    fetchPassport(id)
      .then((p) => alive && setPassport(p))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  const link = passport ? passportLink(passport) : null;

  useEffect(() => {
    if (!passport || !link) return;
    track("passport_view", passport.gtin ? { ean: passport.gtin } : {});
    let alive = true;
    import("qrcode")
      .then((QR) => QR.toString(link, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0F1A14", light: "#FFFFFF" } }))
      .then((svg) => alive && setQrSvg(svg))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [passport, link]);

  const header = <Header title={t("passport.title")} backTo="/" backLabel={t("common.backHome")} />;
  if (failed && passport === undefined) {
    return (
      <div className="screen">
        {header}
        <ErrorState onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );
  }
  if (passport === undefined) {
    return (
      <div className="screen">
        {header}
        <LoadingState />
      </div>
    );
  }
  if (passport === null || !link) {
    return (
      <div className="screen">
        {header}
        <main className="content">
          <section className="card center-state">
            <p className="state-title">{t("passport.notFoundTitle")}</p>
            <p className="muted">{t("passport.notFoundText")}</p>
          </section>
        </main>
      </div>
    );
  }

  const p = passport;
  const maxStage = Math.max(...p.stages.map((s) => s.ecs), 1);
  const chain: [string, string | null][] = [
    [t("maker.spinning"), p.country_spinning],
    [t("maker.fabric"), p.country_fabric],
    [t("maker.dyeing"), p.country_dyeing],
    [t("maker.making"), p.country_making],
  ];

  return (
    <div className="screen passport-screen">
      {header}
      <main className="content">
        <section className="card passport-head">
          <div className="stack-4">
            <span className="overline-brand">{p.company}</span>
            <span className="product-name">{p.product_name}</span>
            <span className="muted-sm">
              {[p.reference && t("common.ref", { ref: p.reference }), p.gtin && t("common.ean", { code: formatEan(p.gtin) }), p.category].filter(Boolean).join(" · ")}
            </span>
          </div>
          <span className="status-pill" style={p.verified ? CONFIDENCE_STYLE.haute : { color: "#7A5B00", background: "#FCF1CF" }}>
            {p.verified ? t("passport.verified") : t("passport.unverified")}
          </span>
        </section>

        <section className="verdict passport-score">
          <GradeBadge grade={p.env_grade} size={64} round />
          <div className="stack-4">
            <p className="verdict-title">{t("common.points", { n: formatNumber(p.eco_cost, 0) ?? "" })}</p>
            <p className="verdict-text">{t("passport.scoreText", { climate: formatNumber(p.climate_kg, 1) ?? "", grade: p.env_grade })}</p>
            <p className="muted-sm">{t("passport.notLabel")}</p>
          </div>
        </section>

        <section className="card info-list" aria-label={t("passport.productAria")}>
          <div className="info-row">
            <span className="muted">{t("common.composition")}</span>
            <span className="info-value">{p.composition}</span>
          </div>
          <div className="info-row">
            <span className="muted">{t("passport.mass")}</span>
            <span className="info-value">{t("passport.massValue", { n: formatNumber(p.mass_kg * 1000, 0) ?? "" })}</span>
          </div>
          <div className="info-row">
            <span className="muted">{t("passport.maker")}</span>
            <span className="info-value">{[p.company, p.city, p.country].filter(Boolean).join(", ")}</span>
          </div>
          <div className="info-row">
            <span className="muted">{t("common.transport")}</span>
            <span className="info-value">
              {p.air_transport_ratio === null
                ? t("common.notCommunicated")
                : p.air_transport_ratio === 0
                  ? t("passport.noAir")
                  : t("passport.air", { n: Math.round(p.air_transport_ratio * 100) })}
            </span>
          </div>
        </section>

        <p className="lead">{t("passport.chain")}</p>
        <ol className="card chain">
          {chain.map(([step, country]) => (
            <li key={step}>
              <span className="chain-step">{step}</span>
              <span className={country ? "info-value" : "muted-sm"}>{country ?? t("passport.notFilled")}</span>
            </li>
          ))}
        </ol>

        <p className="lead">{t("passport.stages")}</p>
        <section className="card breakdown">
          {p.stages.map((s) => (
            <div key={s.label} className="stack-8">
              <div className="split">
                <span className="strong">{s.label}</span>
                <span className="muted-sm">{t("common.pts", { n: formatNumber(s.ecs, 0) ?? "" })}</span>
              </div>
              <div className="bar" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${Math.max(2, Math.round((100 * s.ecs) / maxStage))}%`, background: "#1F6B4A" }} />
              </div>
            </div>
          ))}
        </section>

        <section className="card info-list" aria-label={t("passport.methodAria")}>
          <div className="info-row">
            <span className="muted">{t("common.method")}</span>
            <span className="info-value">{p.methodology}</span>
          </div>
          <div className="info-row">
            <span className="muted">{t("common.reliability")}</span>
            <span className="status-pill" style={CONFIDENCE_STYLE[p.confidence]}>
              {CONFIDENCE_LABEL[p.confidence]}
            </span>
          </div>
          <div className="info-row">
            <span className="muted">{t("passport.issued")}</span>
            <span className="info-value">{formatDate(p.created_at)}</span>
          </div>
        </section>
        {p.assumptions.length > 0 && (
          <aside className="note">
            <IconInfo size={20} />
            <div>
              <p className="note-title">{t("common.calcAssumptions")}</p>
              <ul className="note-list">
                {p.assumptions.map((a) => (
                  <li key={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        <section className="card passport-qr">
          {qrSvg ? <div className="qr" role="img" aria-label={t("passport.qrAria")} dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <div className="qr skeleton" />}
          <div className="stack-6">
            <p className="strong">{t("passport.qrTitle")}</p>
            <p className="muted-sm">{p.gtin ? t("passport.qrGs1") : t("passport.qrNoGtin")}</p>
          </div>
        </section>
        <div className="sources-links no-print">
          {qrSvg && (
            <button type="button" className="btn btn-outline" onClick={() => download(`passeport-${p.id}-qr.svg`, qrSvg, "image/svg+xml")}>
              {t("passport.downloadQr")}
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={() => download(`passeport-${p.id}.json`, JSON.stringify(passportJson(p, link), null, 2), "application/json")}>
            {t("passport.downloadJson")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>
            {t("passport.print")}
          </button>
          {p.eco_web_url && (
            <a className="btn btn-text" href={p.eco_web_url} target="_blank" rel="noopener noreferrer">
              {t("common.seeOnEcobalyse")}
            </a>
          )}
        </div>

        <p className="muted-xs passport-legal">{t("passport.legal")}</p>
      </main>
      <footer className="actions no-print">
        <button type="button" className="btn btn-primary" onClick={() => navigate("/fabricants")}>
          {t("passport.create")}
        </button>
      </footer>
    </div>
  );
}
