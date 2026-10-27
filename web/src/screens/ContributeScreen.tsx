import { useEffect, useRef, useState, type FormEvent } from "react";
import { Header } from "../components/Header";
import { IconCamera, IconCheck } from "../components/Icons";
import { formatEan } from "../lib/barcode";
import { CATEGORIES, checkComposition, compressPhoto, COUNTRIES, submitContribution, uploadLabelPhoto } from "../lib/contribute";
import { navigate } from "../lib/router";
import { track } from "../lib/track";

type Status = "idle" | "sending" | "sent" | "error";

export function ContributeScreen({ ean }: { ean: string }) {
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [composition, setComposition] = useState("");
  const [country, setCountry] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    track("contribution_start", { ean });
  }, [ean]);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const compositionError = checkComposition(composition);
  const missing = {
    brand: brand.trim().length === 0,
    name: name.trim().length === 0,
    category: category === "",
  };
  const valid = !missing.brand && !missing.name && !missing.category && !compositionError;

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    try {
      setPhoto(await compressPhoto(file));
    } catch {
      setPhotoError("Cette photo n'a pas pu être lue. Réessayez.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setStatus("sending");
    try {
      const photoPath = photo ? await uploadLabelPhoto(photo) : null;
      await submitContribution({ ean, brandName: brand, name, category, composition, countryMaking: country, photoPath });
      track("contribution_sent", { ean });
      setStatus("sent");
      window.scrollTo(0, 0);
    } catch {
      setStatus("error");
    }
  }

  const header = <Header title="Ajouter ce vêtement" backTo={`/inconnu/${ean}`} backLabel="Retour" />;

  if (status === "sent") {
    return (
      <div className="screen">
        {header}
        <main className="content">
          <section className="banner-success banner-big" role="status">
            <span className="check-circle">
              <IconCheck size={20} />
            </span>
            <div className="stack-4">
              <strong>Merci, c'est envoyé !</strong>
              <span>L'équipe VeriTrace vérifie votre ajout, puis le vêtement est noté avec Ecobalyse, la méthode officielle française.</span>
            </div>
          </section>
        </main>
        <footer className="actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate("/")}>
            Scanner un autre article
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="screen">
      {header}
      <main className="content">
        <p className="lead">
          Recopiez l'étiquette cousue à l'intérieur du vêtement. Nous vérifions chaque ajout avant de le noter.
        </p>
        <span className="pill-muted contribute-ean">EAN {formatEan(ean)}</span>

        <form id="contribute" className="card form" onSubmit={submit} noValidate>
          <div className="stack-6">
            <label htmlFor="c-brand" className="field-label">Marque</label>
            <input id="c-brand" className="input" maxLength={80} autoComplete="off" placeholder="Ex. Defacto, Zara, Marwa…" value={brand} onChange={(e) => setBrand(e.target.value)} aria-invalid={touched && missing.brand} />
            {touched && missing.brand && <p className="field-error">Indiquez la marque.</p>}
          </div>

          <div className="stack-6">
            <label htmlFor="c-name" className="field-label">Nom du vêtement</label>
            <input id="c-name" className="input" maxLength={120} autoComplete="off" placeholder="Ex. T-shirt col rond noir" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && missing.name} />
            {touched && missing.name && <p className="field-error">Donnez un nom au vêtement.</p>}
          </div>

          <div className="stack-6">
            <label htmlFor="c-category" className="field-label">Catégorie</label>
            <select id="c-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-invalid={touched && missing.category}>
              <option value="">Choisir…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {touched && missing.category && <p className="field-error">Choisissez une catégorie.</p>}
          </div>

          <div className="stack-6">
            <label htmlFor="c-composition" className="field-label">Composition</label>
            <input id="c-composition" className="input" maxLength={300} autoComplete="off" placeholder="Ex. 60 % coton, 40 % polyester" value={composition} onChange={(e) => setComposition(e.target.value)} aria-invalid={touched && !!compositionError} aria-describedby="c-composition-help" />
            {touched && compositionError ? (
              <p className="field-error">{compositionError}</p>
            ) : (
              <p id="c-composition-help" className="muted-sm">Telle qu'écrite sur l'étiquette, avec les pourcentages.</p>
            )}
          </div>

          <div className="stack-6">
            <label htmlFor="c-country" className="field-label">Fabriqué en (facultatif)</label>
            <input id="c-country" className="input" list="c-countries" maxLength={40} autoComplete="off" placeholder="Ex. Maroc, Turquie, Bangladesh…" value={country} onChange={(e) => setCountry(e.target.value)} />
            <datalist id="c-countries">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="stack-6">
            <span className="field-label">Photo de l'étiquette (facultatif)</span>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            {preview ? (
              <div className="photo-row">
                <img src={preview} alt="Photo de l'étiquette" className="photo-preview" />
                <button type="button" className="btn btn-text btn-compact" onClick={() => fileInput.current?.click()}>
                  Reprendre
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => fileInput.current?.click()}>
                <IconCamera size={20} />
                Prendre l'étiquette en photo
              </button>
            )}
            {photoError ? <p className="field-error">{photoError}</p> : <p className="muted-sm">Elle sert uniquement à vérifier votre saisie.</p>}
          </div>

          {status === "error" && (
            <p className="field-error" role="alert">
              L'envoi a échoué. Vérifiez votre connexion puis réessayez.
            </p>
          )}
        </form>
      </main>
      <footer className="actions">
        <button type="submit" form="contribute" className="btn btn-primary" disabled={status === "sending"}>
          {status === "sending" ? "Envoi…" : "Envoyer pour vérification"}
        </button>
      </footer>
    </div>
  );
}
