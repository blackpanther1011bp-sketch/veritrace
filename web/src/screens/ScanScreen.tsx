import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { GradeBadge } from "../components/Grade";
import { IconChevron, IconKeyboard, IconScan, Logo } from "../components/Icons";
import { TagIllustration } from "../components/TagIllustration";

import { digitsOnly, formatEan, isValidGtin, normalizeGtin } from "../lib/barcode";
import { navigate } from "../lib/router";
import { getHistory, resetDemo, timeAgo, type HistoryEntry } from "../lib/storage";
import { track } from "../lib/track";
import type { Grade } from "../lib/types";

// Le module de scan (décodeur inclus) est chargé à part : l'écran d'accueil s'affiche plus vite.
const loadScanner = () => import("../components/Scanner");
const CameraScanner = lazy(() => loadScanner().then((m) => ({ default: m.CameraScanner })));

// Produits fictifs présents en base, pour tester sans étiquette sous la main.
const EXAMPLES: { ean: string; name: string; brand: string; grade: Grade }[] = [
  { ean: "2001000000012", name: "T-shirt col rond", brand: "Urbanline", grade: "D" },
  { ean: "2004000000044", name: "Robe moulante", brand: "Flashwear", grade: "E" },
  { ean: "2005000000010", name: "T-shirt col V", brand: "Pulse & Co", grade: "B" },
];

export function ScanScreen() {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(getHistory);

  useEffect(() => {
    // préchargement en arrière-plan pour un premier scan rapide
    const id = window.setTimeout(() => {
      loadScanner()
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
    setCameraError(null);
    setScanning(true);
  }

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const code = normalizeGtin(manualCode);
    if (!isValidGtin(code)) {
      setManualError("Ce code ne ressemble pas à un code-barres valide (8, 12 ou 13 chiffres).");
      return;
    }
    openProduct(code);
  }

  function reset() {
    resetDemo();
    setHistory([]);
  }

  const hint = cameraError ?? (scanning ? "Visez le code-barres de l'étiquette" : "Scannez le code-barres sur l'étiquette d'un vêtement");

  return (
    <div className="screen screen-dark">
      <header className="brandbar">
        <div className="brand">
          <Logo />
          <span className="brand-name">VeriTrace</span>
        </div>
        <span className="pill-outline">Démo</span>
      </header>

      <div className="viewfinder">
        {scanning ? (
          <Suspense fallback={<p className="camera-status">Ouverture de la caméra…</p>}>
            <CameraScanner
              onDetected={openProduct}
              onError={(message) => {
                setScanning(false);
                setCameraError(message);
                setManualOpen(true);
              }}
            />
          </Suspense>
        ) : (
          <TagIllustration />
        )}
      </div>

      <p className={cameraError ? "hint hint-error" : "hint"} role={cameraError ? "alert" : undefined}>
        {hint}
      </p>

      <section className="sheet">
        {scanning ? (
          <button type="button" className="btn btn-outline" onClick={() => setScanning(false)}>
            Arrêter le scan
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={startScan}>
            <IconScan />
            Scanner l'article
          </button>
        )}

        {manualOpen ? (
          <form className="manual" onSubmit={submitManual} noValidate>
            <label htmlFor="code" className="field-label">
              Code-barres
            </label>
            <div className="manual-row">
              <input
                id="code"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ex. : 2001000000012"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(digitsOnly(e.target.value).slice(0, 14));
                  setManualError(null);
                }}
                aria-invalid={manualError ? true : undefined}
                aria-describedby={manualError ? "code-error" : undefined}
              />
              <button type="submit" className="btn btn-primary btn-compact">
                Valider
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
            Saisir le code à la main
          </button>
        )}

        <div className="list">
          <h2 className="overline">{history.length > 0 ? "Derniers scans" : "Exemples à tester"}</h2>
          {history.length > 0
            ? history.slice(0, 4).map((h) => (
                <button key={h.ean} type="button" className="row-card" onClick={() => navigate(h.grade ? `/p/${h.ean}` : `/inconnu/${h.ean}`)}>
                  <GradeBadge grade={h.grade} />
                  <span className="row-text">
                    <span className="row-title">{h.name ?? `EAN ${formatEan(h.ean)}`}</span>
                    <span className="row-sub">
                      {h.brand ?? "Non référencé"} · {timeAgo(h.at)}
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
                    <span className="row-sub">{ex.brand} · produit fictif</span>
                  </span>
                  <IconChevron size={20} className="row-chevron" />
                </button>
              ))}
        </div>

        {history.length > 0 && (
          <button type="button" className="btn btn-text btn-small" onClick={reset}>
            Réinitialiser la démo
          </button>
        )}
      </section>
    </div>
  );
}
