import { LegalLinks } from "./LegalScreen";
import { useEffect, useState, type FormEvent } from "react";
import { GradeBadge } from "../components/Grade";
import { IconCamera, IconChevron, IconKeyboard, IconScan, Logo } from "../components/Icons";
import { TagIllustration } from "../components/TagIllustration";
import { digitsOnly, formatEan, isValidGtin, normalizeGtin } from "../lib/barcode";
import { getLang, setLang, t, type Lang } from "../lib/i18n";
import { navigate } from "../lib/router";
import { getHistory, resetDemo, timeAgo, type HistoryEntry } from "../lib/storage";
import { track } from "../lib/track";
import type { Grade } from "../lib/types";

// Produits fictifs présents en base, pour tester sans étiquette sous la main.
const EXAMPLES: { ean: string; name: string; brand: string; grade: Grade }[] = [
  { ean: "2001000000012", name: "T-shirt col rond", brand: "Urbanline", grade: "D" },
  { ean: "2004000000044", name: "Robe moulante", brand: "Flashwear", grade: "E" },
  { ean: "2005000000010", name: "T-shirt col V", brand: "Pulse & Co", grade: "B" },
];

/** Choix de la langue (mémorisé) : français ou arabe (lecture de droite à gauche). */
function LangSwitch() {
  const current = getLang();
  const [busy, setBusy] = useState(false);
  const choose = (lang: Lang) => {
    if (lang === current || busy) return;
    setBusy(true);
    setLang(lang).catch(() => setBusy(false));
  };
  return (
    <div className="lang-switch" role="group" aria-label={t("lang.label")}>
      <button type="button" lang="fr" title="Français" aria-pressed={current === "fr"} onClick={() => choose("fr")}>
        {t("lang.fr")}
      </button>
      <button type="button" lang="ar" aria-pressed={current === "ar"} onClick={() => choose("ar")}>
        {t("lang.ar")}
      </button>
    </div>
  );
}

export function ScanScreen() {
  // « ?saisie=1 » : retour depuis la caméra indisponible, on ouvre directement la saisie
  const [manualOpen, setManualOpen] = useState(() => window.location.hash.includes("saisie=1"));
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(getHistory);

  useEffect(() => {
    // préchargement en arrière-plan de l'écran caméra et du décodeur, pour un premier scan rapide
    const id = window.setTimeout(() => {
      import("./ArScanScreen").catch(() => undefined);
      import("../lib/camera")
        .then((m) => m.warmUpDecoder())
        .catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(id);
  }, []);

  function openProduct(ean: string) {
    track("scan", { ean });
    navigate(`/p/${ean}`);
  }

  function startScan() {
    navigate("/ar");
  }

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const code = normalizeGtin(manualCode);
    if (!isValidGtin(code)) {
      setManualError(t("scan.codeInvalid"));
      return;
    }
    openProduct(code);
  }

  function reset() {
    resetDemo();
    setHistory([]);
  }

  return (
    <div className="screen screen-dark">
      <header className="brandbar">
        <div className="brand">
          <Logo />
          <h1 className="brand-name">VeriTrace</h1>
        </div>
        <div className="brandbar-end">
          <LangSwitch />
          <span className="pill-outline">{t("scan.demo")}</span>
        </div>
      </header>

      <main>
      <div className="viewfinder">
        <div className="ar-preview" aria-hidden="true">
          <TagIllustration />
          <span className="ar-preview-badge">
            <GradeBadge grade="D" size={34} round />
            <span className="ar-badge-text">
              <span className="ar-badge-title">{t("scan.previewTitle")}</span>
              <span className="ar-badge-sub">{t("scan.previewSub")}</span>
            </span>
          </span>
        </div>
      </div>

      <p className="hint">{t("scan.hint")}</p>

      <section className="sheet">
        <button type="button" className="btn btn-primary" onClick={startScan}>
          <IconScan />
          {t("scan.start")}
        </button>

        <button type="button" className="btn btn-outline" onClick={() => navigate("/etiquette-direct")}>
          <IconCamera size={20} />
          {t("scan.noBarcode")}
        </button>

        {manualOpen ? (
          <form className="manual" onSubmit={submitManual} noValidate>
            <label htmlFor="code" className="field-label">
              {t("scan.codeLabel")}
            </label>
            <div className="manual-row">
              <input
                id="code"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                placeholder={t("scan.codePlaceholder")}
                value={manualCode}
                onChange={(e) => {
                  setManualCode(digitsOnly(e.target.value).slice(0, 14));
                  setManualError(null);
                }}
                aria-invalid={manualError ? true : undefined}
                aria-describedby={manualError ? "code-error" : undefined}
              />
              <button type="submit" className="btn btn-primary btn-compact">
                {t("scan.validate")}
              </button>
            </div>
            {manualError && (
              <p id="code-error" className="field-error">
                {manualError}
              </p>
            )}
          </form>
        ) : (
          <button type="button" className="btn btn-text" onClick={() => setManualOpen(true)}>
            <IconKeyboard size={20} />
            {t("scan.enterByHand")}
          </button>
        )}

        <div className="list">
          <h2 className="overline">{history.length > 0 ? t("scan.recent") : t("scan.examples")}</h2>
          {history.length > 0
            ? history.slice(0, 4).map((h) => (
                <button key={h.ean} type="button" className="row-card" onClick={() => navigate(h.grade ? `/p/${h.ean}` : `/inconnu/${h.ean}`)}>
                  <GradeBadge grade={h.grade} />
                  <span className="row-text">
                    <span className="row-title">{h.name ?? (h.ean.startsWith("L") ? t("scan.labelRead") : t("common.ean", { code: formatEan(h.ean) }))}</span>
                    <span className="row-sub">
                      {h.brand ?? t("scan.notListed")} · {timeAgo(h.at)}
                    </span>
                  </span>
                  <IconChevron size={20} className="row-chevron" />
                </button>
              ))
            : EXAMPLES.map((ex) => (
                <button key={ex.ean} type="button" className="row-card" onClick={() => openProduct(ex.ean)}>
                  <GradeBadge grade={ex.grade} />
                  <span className="row-text">
                    <span className="row-title">{ex.name}</span>
                    <span className="row-sub">{ex.brand} · {t("scan.fictional")}</span>
                  </span>
                  <IconChevron size={20} className="row-chevron" />
                </button>
              ))}
        </div>

        {history.length > 0 && (
          <button type="button" className="btn btn-text btn-small" onClick={reset}>
            {t("scan.resetDemo")}
          </button>
        )}

        <button type="button" className="row-card maker-link" onClick={() => navigate("/fabricants")}>
          <span className="row-text">
            <span className="row-title">{t("scan.makerTitle")}</span>
            <span className="row-sub">{t("scan.makerSub")}</span>
          </span>
          <IconChevron size={20} className="row-chevron" />
        </button>
        <LegalLinks />
      </section>
      </main>
    </div>
  );
}
