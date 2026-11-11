import { useEffect, useState, type FormEvent } from "react";
import { Header } from "../components/Header";
import { IconCamera, IconCheck, IconUnknownTag } from "../components/Icons";
import { reportMissingProduct } from "../lib/api";
import { formatEan } from "../lib/barcode";
import { t } from "../lib/i18n";
import { identify, type Identified } from "../lib/identify";
import { navigate } from "../lib/router";
import { track } from "../lib/track";

export function NotFoundScreen({ ean }: { ean: string }) {
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  // vêtement absent du registre mais reconnu (marque et nom) par la base ouverte de codes-barres
  const [known, setKnown] = useState<Identified | null>(null);

  useEffect(() => {
    let alive = true;
    void identify(ean).then((found) => {
      if (!alive || !found) return;
      setKnown(found);
      setBrand((current) => current || found.brand);
    });
    return () => {
      alive = false;
    };
  }, [ean]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await reportMissingProduct(ean, brand);
      track("report_sent", { ean });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="screen">
      <Header title={t("product.header")} backTo="/" backLabel={t("common.backScan")} />
      <main className="content">
        <div className="empty-hero">
          <div className="empty-icon">
            <IconUnknownTag size={40} />
          </div>
          <h2 className="state-title">{known ? t("notFound.knownTitle") : t("notFound.title")}</h2>
          {known && (
            <p className="known-product">
              {known.brand && <span className="known-brand">{known.brand}</span>}
              <span className="known-name">{known.name}</span>
            </p>
          )}
          <p className="muted">{known ? t("notFound.knownText") : t("notFound.text")}</p>
          {known && <p className="known-source">{t("notFound.knownSource")}</p>}
          <span className="pill-muted">
            <bdi>{t("common.ean", { code: formatEan(ean) })}</bdi>
          </span>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => navigate(`/etiquette-direct/${ean}`)}>
          <IconCamera size={20} />
          {t("notFound.live")}
        </button>
        <button type="button" className="btn btn-text" onClick={() => navigate(`/etiquette/${ean}`)}>
          {t("notFound.photo")}
        </button>
        <button type="button" className="btn btn-text" onClick={() => navigate(`/ajouter/${ean}`)}>
          {t("notFound.manual")}
        </button>

        {status === "sent" ? (
          <section className="banner-success banner-big" role="status">
            <span className="check-circle">
              <IconCheck size={20} />
            </span>
            <div className="stack-4">
              <strong>{t("common.thanksSent")}</strong>
              <span>{t("notFound.sentText")}</span>
            </div>
          </section>
        ) : (
          <form className="card form" onSubmit={submit}>
            <p className="field-label not-found-alt">{t("notFound.quick")}</p>
            <div className="stack-6">
              <label htmlFor="brand" className="field-label">
                {t("common.brandOptional")}
              </label>
              <input
                id="brand"
                className="input"
                maxLength={80}
                autoComplete="off"
                placeholder={t("notFound.brandPlaceholder")}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
            {status === "error" && (
              <p className="field-error" role="alert">
                {t("common.sendFailed")}
              </p>
            )}
            <button type="submit" className="btn btn-outline" disabled={status === "sending"}>
              {status === "sending" ? t("common.sending") : t("notFound.report")}
            </button>
          </form>
        )}
      </main>
      <footer className="actions">
        <button type="button" className="btn btn-outline" onClick={() => navigate("/")}>
          {t("common.scanAnother")}
        </button>
      </footer>
    </div>
  );
}
