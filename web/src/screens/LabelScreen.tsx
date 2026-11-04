import { useEffect, useRef, useState, type FormEvent } from "react";
import { Header } from "../components/Header";
import { IconCamera, IconInfo } from "../components/Icons";
import { formatEan } from "../lib/barcode";
import { CATEGORIES, compressPhoto } from "../lib/contribute";
import { readTextFromPhoto } from "../lib/ocr";
import { readLabel, ServiceError } from "../lib/outils";
import { navigate } from "../lib/router";
import { track } from "../lib/track";

type Status = "idle" | "reading" | "sending" | "error";

/**
 * Lecture de l'étiquette cousue : une photo (composition, « Made in »), le type de vêtement,
 * et VeriTrace calcule la note avec Ecobalyse. Fonctionne pour n'importe quel vêtement, même absent de la base.
 */
export function LabelScreen({ ean }: { ean: string | null }) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    track("label_start", ean ? { ean } : {});
  }, [ean]);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setPhoto(await compressPhoto(file));
    } catch {
      setError({ code: "image", message: "Cette photo n'a pas pu être lue. Réessayez." });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!photo || !category) return;
    setStatus("reading");
    setError(null);
    let text: string;
    try {
      // lecture du texte dans le navigateur (gratuit) ; le serveur ne reçoit que le résultat
      text = await readTextFromPhoto(photo, setStep);
    } catch {
      track("label_failed", ean ? { ean } : {});
      setError({ code: "ocr", message: "La lecture de la photo n'a pas pu démarrer : vérifiez la connexion Internet puis réessayez." });
      setStatus("error");
      return;
    }
    setStatus("sending");
    setStep("Calcul de la note avec Ecobalyse…");
    try {
      const r = await readLabel({ photo, text, category, ean, brand });
      track("label_read", { ean: r.product.ean, grade: r.product.global_grade });
      navigate(`/p/${r.product.ean}`, { replace: true });
    } catch (err) {
      const e2 = err instanceof ServiceError ? err : new ServiceError("serveur", "Erreur inattendue : réessayez.");
      track("label_failed", ean ? { ean } : {});
      setError({ code: e2.code, message: e2.message });
      setStatus("error");
      window.setTimeout(() => document.querySelector(".label-error")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  }

  const sending = status === "sending" || status === "reading";
  const backTo = ean ? `/inconnu/${ean}` : "/";

  return (
    <div className="screen">
      <Header title="Lire l'étiquette" backTo={backTo} backLabel="Retour" />
      <main className="content">
        <p className="lead">
          Photographiez l'<strong>étiquette cousue</strong> à l'intérieur du vêtement : celle qui indique la composition (ex. « 100 % coton ») et le
          pays de fabrication. VeriTrace lit le texte directement sur votre téléphone, puis calcule la note avec la méthode officielle Ecobalyse.
        </p>
        {ean && <span className="pill-muted contribute-ean">EAN {formatEan(ean)}</span>}

        <form id="label" className="card form" onSubmit={submit} noValidate>
          <div className="stack-6">
            <span className="field-label">Photo de l'étiquette</span>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            {preview ? (
              <div className="label-photo">
                <img src={preview} alt="Étiquette photographiée" />
                <button type="button" className="btn btn-text btn-compact" onClick={() => fileInput.current?.click()} disabled={sending}>
                  Reprendre la photo
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>
                <IconCamera size={20} />
                Prendre la photo
              </button>
            )}
            {touched && !photo && <p className="field-error">Ajoutez la photo de l'étiquette.</p>}
          </div>

          <div className="stack-6">
            <label htmlFor="l-category" className="field-label">
              Type de vêtement
            </label>
            <select id="l-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-invalid={touched && !category}>
              <option value="">Choisir…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {touched && !category && <p className="field-error">Choisissez le type de vêtement.</p>}
          </div>

          <div className="stack-6">
            <label htmlFor="l-brand" className="field-label">
              Marque (facultatif)
            </label>
            <input id="l-brand" className="input" maxLength={80} autoComplete="off" placeholder="Ex. Defacto, LC Waikiki, Marwa…" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>

          {error && (
            <div className="field-error label-error" role="alert">
              <p>{error.message}</p>
              {ean && ["illisible", "composition_introuvable", "composition_incomplete", "ia_indisponible", "ocr"].includes(error.code) && (
                <button type="button" className="btn btn-text btn-compact" onClick={() => navigate(`/ajouter/${ean}`)}>
                  Saisir la composition à la main
                </button>
              )}
            </div>
          )}
        </form>

        <aside className="note">
          <IconInfo size={20} />
          <p>
            Conseils : étiquette bien à plat, sans reflet, texte net. Le résultat est une estimation : poids et lieux de tissage ou de teinture ne sont
            pas écrits sur l'étiquette, Ecobalyse applique alors ses valeurs par défaut.
          </p>
        </aside>
      </main>
      <footer className="actions">
        <button type="submit" form="label" className="btn btn-primary" disabled={sending}>
          {sending ? "Lecture et calcul…" : "Calculer la note"}
        </button>
        {sending && (
          <p className="muted-xs" role="status">
            {step || "Lecture de l'étiquette…"} Comptez 10 à 20 secondes la première fois.
          </p>
        )}
      </footer>
    </div>
  );
}
