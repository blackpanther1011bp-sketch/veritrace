import { useEffect, useRef, useState, type FormEvent } from "react";
import { Header } from "../components/Header";
import { IconCamera, IconCheck } from "../components/Icons";
import { formatEan } from "../lib/barcode";
import { identify } from "../lib/identify";
import { t, tv } from "../lib/i18n";
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

  // vêtement reconnu par son code-barres : marque, nom et type préremplis (modifiables)
  useEffect(() => {
    let alive = true;
    void identify(ean).then((found) => {
      if (!alive || !found) return;
      setBrand((current) => current || found.brand);
      setName((current) => current || found.name);
      if (found.category) setCategory((current) => current || found.category!);
    });
    return () => {
      alive = false;
    };
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
      setPhotoError(t("contrib.photoError"));
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

  const header = <Header title={t("contrib.header")} backTo={`/inconnu/${ean}`} backLabel={t("common.back")} />;

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
              <strong>{t("common.thanksSent")}</strong>
              <span>{t("contrib.sentText")}</span>
            </div>
          </section>
        </main>
        <footer className="actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate("/")}>
            {t("common.scanAnother")}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="screen">
      {header}
      <main className="content">
        <p className="lead">{t("contrib.lead")}</p>
        <span className="pill-muted contribute-ean">
          <bdi>{t("common.ean", { code: formatEan(ean) })}</bdi>
        </span>

        <form id="contribute" className="card form" onSubmit={submit} noValidate>
          <div className="stack-6">
            <label htmlFor="c-brand" className="field-label">{t("contrib.brand")}</label>
            <input id="c-brand" className="input" maxLength={80} autoComplete="off" placeholder={t("contrib.brandPlaceholder")} value={brand} onChange={(e) => setBrand(e.target.value)} aria-invalid={touched && missing.brand} />
            {touched && missing.brand && <p className="field-error">{t("contrib.brandMissing")}</p>}
          </div>

          <div className="stack-6">
            <label htmlFor="c-name" className="field-label">{t("contrib.name")}</label>
            <input id="c-name" className="input" maxLength={120} autoComplete="off" placeholder={t("contrib.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && missing.name} />
            {touched && missing.name && <p className="field-error">{t("contrib.nameMissing")}</p>}
          </div>

          <div className="stack-6">
            <label htmlFor="c-category" className="field-label">{t("contrib.category")}</label>
            <select id="c-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-invalid={touched && missing.category}>
              <option value="">{t("common.choose")}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{tv(c)}</option>
              ))}
            </select>
            {touched && missing.category && <p className="field-error">{t("contrib.categoryMissing")}</p>}
          </div>

          <div className="stack-6">
            <label htmlFor="c-composition" className="field-label">{t("common.composition")}</label>
            <input id="c-composition" className="input" maxLength={300} autoComplete="off" dir="auto" placeholder={t("contrib.compositionPlaceholder")} value={composition} onChange={(e) => setComposition(e.target.value)} aria-invalid={touched && !!compositionError} aria-describedby="c-composition-help" />
            {touched && compositionError ? (
              <p className="field-error">{compositionError}</p>
            ) : (
              <p id="c-composition-help" className="muted-sm">{t("contrib.compositionHelp")}</p>
            )}
          </div>

          <div className="stack-6">
            <label htmlFor="c-country" className="field-label">{t("contrib.country")}</label>
            <input id="c-country" className="input" list="c-countries" maxLength={40} autoComplete="off" placeholder={t("contrib.countryPlaceholder")} value={country} onChange={(e) => setCountry(e.target.value)} />
            <datalist id="c-countries">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} label={tv(c)} />
              ))}
            </datalist>
          </div>

          <div className="stack-6">
            <span className="field-label">{t("contrib.photo")}</span>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            {preview ? (
              <div className="photo-row">
                <img src={preview} alt={t("contrib.photoAlt")} className="photo-preview" />
                <button type="button" className="btn btn-text btn-compact" onClick={() => fileInput.current?.click()}>
                  {t("contrib.retake")}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => fileInput.current?.click()}>
                <IconCamera size={20} />
                {t("contrib.takePhoto")}
              </button>
            )}
            {photoError ? <p className="field-error">{photoError}</p> : <p className="muted-sm">{t("contrib.photoUse")}</p>}
          </div>

          {status === "error" && (
            <p className="field-error" role="alert">
              {t("common.sendFailed")}
            </p>
          )}
        </form>
      </main>
      <footer className="actions">
        <button type="submit" form="contribute" className="btn btn-primary" disabled={status === "sending"}>
          {status === "sending" ? t("common.sending") : t("contrib.submit")}
        </button>
      </footer>
    </div>
  );
}
