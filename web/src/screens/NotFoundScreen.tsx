import { useState, type FormEvent } from "react";
import { Header } from "../components/Header";
import { IconCamera, IconCheck, IconUnknownTag } from "../components/Icons";
import { reportMissingProduct } from "../lib/api";
import { formatEan } from "../lib/barcode";
import { navigate } from "../lib/router";
import { track } from "../lib/track";

export function NotFoundScreen({ ean }: { ean: string }) {
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

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
      <Header title="Résultat du scan" backTo="/" backLabel="Retour au scan" />
      <main className="content">
        <div className="empty-hero">
          <div className="empty-icon">
            <IconUnknownTag size={40} />
          </div>
          <h2 className="state-title">Article pas encore référencé</h2>
          <p className="muted">Ce code-barres n'est pas encore dans notre base. Ajoutez-le en recopiant son étiquette : nous le vérifions, puis nous le notons.</p>
          <span className="pill-muted">EAN {formatEan(ean)}</span>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => navigate(`/ajouter/${ean}`)}>
          <IconCamera size={20} />
          Ajouter ce vêtement (1 min)
        </button>

        {status === "sent" ? (
          <section className="banner-success banner-big" role="status">
            <span className="check-circle">
              <IconCheck size={20} />
            </span>
            <div className="stack-4">
              <strong>Merci, c'est envoyé !</strong>
              <span>Cet article rejoint la liste des produits à analyser.</span>
            </div>
          </section>
        ) : (
          <form className="card form" onSubmit={submit}>
            <p className="field-label not-found-alt">Pas le temps ? Signalez-le simplement.</p>
            <div className="stack-6">
              <label htmlFor="brand" className="field-label">
                Marque (facultatif)
              </label>
              <input
                id="brand"
                className="input"
                maxLength={80}
                autoComplete="off"
                placeholder="Celle écrite sur l'étiquette"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
            {status === "error" && (
              <p className="field-error" role="alert">
                L'envoi a échoué. Vérifiez votre connexion puis réessayez.
              </p>
            )}
            <button type="submit" className="btn btn-outline" disabled={status === "sending"}>
              {status === "sending" ? "Envoi…" : "Signaler cet article"}
            </button>
          </form>
        )}
      </main>
      <footer className="actions">
        <button type="button" className="btn btn-outline" onClick={() => navigate("/")}>
          Scanner un autre article
        </button>
      </footer>
    </div>
  );
}
