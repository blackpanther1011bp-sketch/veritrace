import { useState, type FormEvent } from "react";
import { LegalLinks } from "./LegalScreen";
import { Header } from "../components/Header";
import { IconCheck, IconInfo } from "../components/Icons";
import { CATEGORIES, checkComposition, COUNTRIES } from "../lib/contribute";
import { t, tv } from "../lib/i18n";
import { createPassport, ServiceError, type PassportForm } from "../lib/outils";
import { navigate } from "../lib/router";
import { track } from "../lib/track";

const EMPTY: PassportForm = {
  company: "",
  city: "",
  product_name: "",
  reference: "",
  gtin: "",
  category: "",
  composition: "",
  mass_g: "",
  country_spinning: "",
  country_fabric: "",
  country_dyeing: "",
  country_making: "Maroc",
  air_transport_pct: "0",
};

/**
 * Espace fabricants : une usine (ex. au Maroc, qui exporte vers l'Europe) décrit un produit et obtient son
 * coût environnemental officiel (Ecobalyse) et un passeport numérique public avec QR code.
 */
export function FabricantsScreen() {
  const [form, setForm] = useState<PassportForm>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof PassportForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const compositionError = form.composition ? checkComposition(form.composition) : t("maker.compositionMissing");
  const mass = Number(form.mass_g.replace(",", "."));
  const missing = {
    company: form.company.trim().length < 2,
    product_name: form.product_name.trim().length < 2,
    category: !form.category,
    mass: !(mass >= 10 && mass <= 5000),
    country_making: !form.country_making.trim(),
  };
  const valid = !Object.values(missing).some(Boolean) && !compositionError;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid) return;
    setSending(true);
    try {
      const p = await createPassport(form);
      track("passport_created", p.gtin ? { ean: p.gtin, grade: p.env_grade } : { grade: p.env_grade });
      navigate(`/passeport/${p.id}`);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : t("common.unexpected"));
      setSending(false);
    }
  }

  const err = (cond: boolean, text: string) => touched && cond && <p className="field-error">{text}</p>;
  const countryInput = (id: keyof PassportForm, label: string, hint?: string) => (
    <div className="stack-6">
      <label htmlFor={`f-${id}`} className="field-label">
        {label}
      </label>
      <input id={`f-${id}`} className="input" list="f-countries" maxLength={40} autoComplete="off" placeholder={hint ?? t("maker.country")} value={form[id]} onChange={set(id)} />
    </div>
  );

  return (
    <div className="screen">
      <Header title={t("maker.title")} backTo="/" backLabel={t("common.backHome")} />
      <main className="content">
        <section className="card maker-intro">
          <p className="maker-title">{t("maker.headline")}</p>
          <ul className="benefits">
            <li>
              <IconCheck size={20} /> {t("maker.benefitCost")}
            </li>
            <li>
              <IconCheck size={20} /> {t("maker.benefitPage")}
            </li>
            <li>
              <IconCheck size={20} /> {t("maker.benefitExport")}
            </li>
          </ul>
          <p className="muted-sm">{t("maker.eu")}</p>
        </section>

        <form id="maker" className="card form" onSubmit={submit} noValidate>
          <p className="form-section">{t("maker.company")}</p>
          <div className="stack-6">
            <label htmlFor="f-company" className="field-label">
              {t("maker.companyName")}
            </label>
            <input id="f-company" className="input" maxLength={120} autoComplete="organization" value={form.company} onChange={set("company")} aria-invalid={touched && missing.company} />
            {err(missing.company, t("maker.companyMissing"))}
          </div>
          <div className="stack-6">
            <label htmlFor="f-city" className="field-label">
              {t("maker.city")}
            </label>
            <input id="f-city" className="input" maxLength={80} placeholder={t("maker.cityPlaceholder")} value={form.city} onChange={set("city")} />
          </div>

          <p className="form-section">{t("maker.product")}</p>
          <div className="stack-6">
            <label htmlFor="f-product" className="field-label">
              {t("maker.productName")}
            </label>
            <input id="f-product" className="input" maxLength={120} placeholder={t("maker.productPlaceholder")} value={form.product_name} onChange={set("product_name")} aria-invalid={touched && missing.product_name} />
            {err(missing.product_name, t("maker.productMissing"))}
          </div>
          <div className="grid-2">
            <div className="stack-6">
              <label htmlFor="f-ref" className="field-label">
                {t("maker.reference")}
              </label>
              <input id="f-ref" className="input" maxLength={80} value={form.reference} onChange={set("reference")} />
            </div>
            <div className="stack-6">
              <label htmlFor="f-gtin" className="field-label">
                {t("maker.gtin")}
              </label>
              <input id="f-gtin" className="input" inputMode="numeric" maxLength={14} dir="ltr" placeholder={t("maker.gtinPlaceholder")} value={form.gtin} onChange={(e) => setForm((f) => ({ ...f, gtin: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="stack-6">
              <label htmlFor="f-category" className="field-label">
                {t("maker.type")}
              </label>
              <select id="f-category" className="input" value={form.category} onChange={set("category")} aria-invalid={touched && missing.category}>
                <option value="">{t("common.choose")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tv(c)}
                  </option>
                ))}
              </select>
              {err(missing.category, t("maker.typeMissing"))}
            </div>
            <div className="stack-6">
              <label htmlFor="f-mass" className="field-label">
                {t("maker.mass")}
              </label>
              <input id="f-mass" className="input" inputMode="decimal" placeholder={t("maker.massPlaceholder")} value={form.mass_g} onChange={set("mass_g")} aria-invalid={touched && missing.mass} />
              {err(missing.mass, t("maker.massInvalid"))}
            </div>
          </div>
          <div className="stack-6">
            <label htmlFor="f-composition" className="field-label">
              {t("maker.composition")}
            </label>
            <input id="f-composition" className="input" maxLength={300} dir="auto" placeholder={t("maker.compositionPlaceholder")} value={form.composition} onChange={set("composition")} aria-invalid={touched && !!compositionError} />
            {err(!!compositionError, compositionError ?? "")}
          </div>

          <p className="form-section">{t("maker.chain")}</p>
          <p className="muted-sm">{t("maker.chainHelp")}</p>
          <div className="grid-2">
            {countryInput("country_spinning", t("maker.spinning"), t("maker.exTurkey"))}
            {countryInput("country_fabric", t("maker.fabric"), t("maker.exMorocco"))}
            {countryInput("country_dyeing", t("maker.dyeing"), t("maker.exMorocco"))}
            <div className="stack-6">
              {countryInput("country_making", t("maker.making"))}
              {err(missing.country_making, t("maker.makingMissing"))}
            </div>
          </div>
          <datalist id="f-countries">
            {COUNTRIES.map((c) => (
              <option key={c} value={c} label={tv(c)} />
            ))}
          </datalist>
          <div className="stack-6">
            <label htmlFor="f-air" className="field-label">
              {t("maker.transport")}
            </label>
            <select id="f-air" className="input" value={form.air_transport_pct} onChange={set("air_transport_pct")}>
              <option value="0">{t("maker.noAir")}</option>
              <option value="100">{t("maker.air")}</option>
              <option value="">{t("maker.unknown")}</option>
            </select>
          </div>

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>

        <aside className="note">
          <IconInfo size={20} />
          <p>{t("maker.note")}</p>
        </aside>
        <p className="muted-sm">
          {t("maker.termsBefore")}
          <a href="#/conditions">{t("maker.termsLink")}</a>
          {t("maker.termsAfter")}
        </p>
        <LegalLinks />
      </main>
      <footer className="actions">
        <button type="submit" form="maker" className="btn btn-primary" disabled={sending}>
          {sending ? t("maker.computing") : t("maker.create")}
        </button>
      </footer>
    </div>
  );
}
