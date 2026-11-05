import { useEffect, useState } from "react";
import { GradeBadge } from "../components/Grade";
import { Header } from "../components/Header";
import { IconInfo } from "../components/Icons";
import { formatEan } from "../lib/barcode";
import { fetchPassport, passportJson, passportLink, passportShareLink } from "../lib/outils";
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
  const [shared, setShared] = useState<"copie" | "erreur" | null>(null);

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

  const header = <Header title="Passeport numérique" backTo="/" backLabel="Retour à l'accueil" />;
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
            <p className="state-title">Passeport introuvable</p>
            <p className="muted">Ce lien ne correspond à aucun passeport.</p>
          </section>
        </main>
      </div>
    );
  }

  const p = passport;
  const shareLink = passportShareLink(p);
  // Partage : feuille de partage du téléphone si elle existe, sinon copie du lien
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${p.product_name} · Passeport numérique`, url: shareLink });
        return;
      }
      await navigator.clipboard.writeText(shareLink);
      setShared("copie");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setShared("erreur");
    }
  }
  const maxStage = Math.max(...p.stages.map((s) => s.ecs), 1);
  const chain: [string, string | null][] = [
    ["Filature", p.country_spinning],
    ["Tissage ou tricotage", p.country_fabric],
    ["Teinture", p.country_dyeing],
    ["Confection", p.country_making],
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
              {[p.reference && `Réf. ${p.reference}`, p.gtin && `EAN ${formatEan(p.gtin)}`, p.category].filter(Boolean).join(" · ")}
            </span>
          </div>
          <span className="status-pill" style={p.verified ? CONFIDENCE_STYLE.haute : { color: "#7A5B00", background: "#FCF1CF" }}>
            {p.verified ? "Vérifié par VeriTrace" : "Déclaré par le fabricant, non vérifié"}
          </span>
        </section>

        <section className="verdict passport-score">
          <GradeBadge grade={p.env_grade} size={64} round />
          <div className="stack-4">
            <p className="verdict-title">{formatNumber(p.eco_cost, 0)} points</p>
            <p className="verdict-text">
              Coût environnemental calculé avec Ecobalyse à partir des données du fabricant · Climat : {formatNumber(p.climate_kg, 1)} kg CO₂e · Note
              VeriTrace à poids égal : {p.env_grade}
            </p>
            <p className="muted-sm">La note VeriTrace est indicative : ce n'est ni un label ni une certification, et elle ne peut pas figurer sur le produit.</p>
          </div>
        </section>

        <section className="card info-list" aria-label="Produit">
          <div className="info-row">
            <span className="muted">Composition</span>
            <span className="info-value">{p.composition}</span>
          </div>
          <div className="info-row">
            <span className="muted">Poids</span>
            <span className="info-value">{formatNumber(p.mass_kg * 1000, 0)} g</span>
          </div>
          <div className="info-row">
            <span className="muted">Fabricant</span>
            <span className="info-value">{[p.company, p.city, p.country].filter(Boolean).join(", ")}</span>
          </div>
          <div className="info-row">
            <span className="muted">Transport</span>
            <span className="info-value">
              {p.air_transport_ratio === null ? "Non communiqué" : p.air_transport_ratio === 0 ? "Sans avion" : `Avion (${Math.round(p.air_transport_ratio * 100)} %)`}
            </span>
          </div>
        </section>

        <p className="lead">Chaîne de fabrication</p>
        <ol className="card chain">
          {chain.map(([step, country]) => (
            <li key={step}>
              <span className="chain-step">{step}</span>
              <span className={country ? "info-value" : "muted-sm"}>{country ?? "Non renseigné"}</span>
            </li>
          ))}
        </ol>

        <p className="lead">Coût environnemental par étape</p>
        <section className="card breakdown">
          {p.stages.map((s) => (
            <div key={s.label} className="stack-8">
              <div className="split">
                <span className="strong">{s.label}</span>
                <span className="muted-sm">{formatNumber(s.ecs, 0)} pts</span>
              </div>
              <div className="bar" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${Math.max(2, Math.round((100 * s.ecs) / maxStage))}%`, background: "#1F6B4A" }} />
              </div>
            </div>
          ))}
        </section>

        <section className="card info-list" aria-label="Méthode">
          <div className="info-row">
            <span className="muted">Méthode</span>
            <span className="info-value">{p.methodology}</span>
          </div>
          <div className="info-row">
            <span className="muted">Fiabilité des données</span>
            <span className="status-pill" style={CONFIDENCE_STYLE[p.confidence]}>
              {CONFIDENCE_LABEL[p.confidence]}
            </span>
          </div>
          <div className="info-row">
            <span className="muted">Établi le</span>
            <span className="info-value">{formatDate(p.created_at)}</span>
          </div>
        </section>
        {p.assumptions.length > 0 && (
          <aside className="note">
            <IconInfo size={20} />
            <div>
              <p className="note-title">Hypothèses du calcul</p>
              <ul className="note-list">
                {p.assumptions.map((a) => (
                  <li key={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        <section className="card passport-qr">
          {qrSvg ? <div className="qr" role="img" aria-label="QR code du passeport" data-lien={link} dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <div className="qr skeleton" />}
          <div className="stack-6">
            <p className="strong">QR code à imprimer sur l'étiquette</p>
            <p className="muted-sm">
              {p.gtin ? "Au format GS1 Digital Link, celui des futurs passeports numériques européens." : "Ajoutez un code-barres au produit pour obtenir un QR code au format GS1 Digital Link."}
            </p>
          </div>
        </section>
        <section className="card stack-6 no-print" aria-label="Partager le passeport">
          <p className="strong">Lien à partager</p>
          <p className="muted-sm share-link">{shareLink}</p>
          <button type="button" className="btn btn-primary" onClick={share}>
            Partager le lien
          </button>
          {shared && (
            <p className={shared === "copie" ? "muted-sm" : "field-error"} role="status">
              {shared === "copie" ? "Lien copié : collez-le dans WhatsApp, un e-mail…" : "Copie impossible : sélectionnez le lien ci-dessus."}
            </p>
          )}
        </section>
        <div className="sources-links no-print">
          {qrSvg && (
            <button type="button" className="btn btn-outline" onClick={() => download(`passeport-${p.id}-qr.svg`, qrSvg, "image/svg+xml")}>
              Télécharger le QR code
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={() => download(`passeport-${p.id}.json`, JSON.stringify(passportJson(p, link), null, 2), "application/json")}>
            Télécharger les données (JSON)
          </button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>
            Imprimer ou enregistrer en PDF
          </button>
          {p.eco_web_url && (
            <a className="btn btn-text" href={p.eco_web_url} target="_blank" rel="noopener noreferrer">
              Voir le calcul sur Ecobalyse
            </a>
          )}
        </div>

        <p className="muted-xs passport-legal">
          Aperçu de passeport numérique produit : le format européen officiel pour les vêtements (règlement ESPR) n'est pas encore publié. Données
          déclarées par le fabricant ; calcul réalisé par VeriTrace avec Ecobalyse.
        </p>
      </main>
      <footer className="actions no-print">
        <button type="button" className="btn btn-primary" onClick={() => navigate("/fabricants")}>
          Espace fabricants : créer un passeport
        </button>
      </footer>
    </div>
  );
}
