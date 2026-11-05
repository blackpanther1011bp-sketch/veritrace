import { useState, type FormEvent } from "react";
import { LegalLinks } from "./LegalScreen";
import { Header } from "../components/Header";
import { IconCheck, IconInfo } from "../components/Icons";
import { CATEGORIES, checkComposition, COUNTRIES } from "../lib/contribute";
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
  const compositionError = form.composition ? checkComposition(form.composition) : "Indiquez la composition.";
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
      setError(err instanceof ServiceError ? err.message : "Erreur inattendue : réessayez.");
      setSending(false);
    }
  }

  const err = (cond: boolean, text: string) => touched && cond && <p className="field-error">{text}</p>;
  const countryInput = (id: keyof PassportForm, label: string, hint?: string) => (
    <div className="stack-6">
      <label htmlFor={`f-${id}`} className="field-label">
        {label}
      </label>
      <input id={`f-${id}`} className="input" list="f-countries" maxLength={40} autoComplete="off" placeholder={hint ?? "Pays"} value={form[id]} onChange={set(id)} />
    </div>
  );

  return (
    <div className="screen">
      <Header title="Espace fabricants" backTo="/" backLabel="Retour à l'accueil" />
      <main className="content">
        <section className="card maker-intro">
          <p className="maker-title">Le passeport numérique de vos vêtements, prêt pour l'Europe</p>
          <ul className="benefits">
            <li>
              <IconCheck size={20} /> Coût environnemental calculé avec Ecobalyse, la méthode officielle française
            </li>
            <li>
              <IconCheck size={20} /> Page publique et QR code à imprimer sur l'étiquette
            </li>
            <li>
              <IconCheck size={20} /> Données exportables pour vos clients européens
            </li>
          </ul>
          <p className="muted-sm">
            L'Union européenne prépare un passeport numérique obligatoire pour les vêtements (attendu vers 2027-2028). Ce service vous permet de vous y
            préparer dès aujourd'hui. Gratuit pendant la phase de test.
          </p>
        </section>

        <form id="maker" className="card form" onSubmit={submit} noValidate>
          <p className="form-section">Entreprise</p>
          <div className="stack-6">
            <label htmlFor="f-company" className="field-label">
              Nom de l'entreprise
            </label>
            <input id="f-company" className="input" maxLength={120} autoComplete="organization" value={form.company} onChange={set("company")} aria-invalid={touched && missing.company} />
            {err(missing.company, "Indiquez le nom de l'entreprise.")}
          </div>
          <div className="stack-6">
            <label htmlFor="f-city" className="field-label">
              Ville (facultatif)
            </label>
            <input id="f-city" className="input" maxLength={80} placeholder="Ex. Casablanca, Tanger, Fès…" value={form.city} onChange={set("city")} />
          </div>

          <p className="form-section">Produit</p>
          <div className="stack-6">
            <label htmlFor="f-product" className="field-label">
              Nom du produit
            </label>
            <input id="f-product" className="input" maxLength={120} placeholder="Ex. T-shirt col rond" value={form.product_name} onChange={set("product_name")} aria-invalid={touched && missing.product_name} />
            {err(missing.product_name, "Indiquez le nom du produit.")}
          </div>
          <div className="grid-2">
            <div className="stack-6">
              <label htmlFor="f-ref" className="field-label">
                Référence (facultatif)
              </label>
              <input id="f-ref" className="input" maxLength={80} value={form.reference} onChange={set("reference")} />
            </div>
            <div className="stack-6">
              <label htmlFor="f-gtin" className="field-label">
                Code-barres (facultatif)
              </label>
              <input id="f-gtin" className="input" inputMode="numeric" maxLength={14} placeholder="EAN à 13 chiffres" value={form.gtin} onChange={(e) => setForm((f) => ({ ...f, gtin: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="stack-6">
              <label htmlFor="f-category" className="field-label">
                Type de vêtement
              </label>
              <select id="f-category" className="input" value={form.category} onChange={set("category")} aria-invalid={touched && missing.category}>
                <option value="">Choisir…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {err(missing.category, "Choisissez un type.")}
            </div>
            <div className="stack-6">
              <label htmlFor="f-mass" className="field-label">
                Poids (grammes)
              </label>
              <input id="f-mass" className="input" inputMode="decimal" placeholder="Ex. 160" value={form.mass_g} onChange={set("mass_g")} aria-invalid={touched && missing.mass} />
              {err(missing.mass, "Entre 10 et 5 000 g.")}
            </div>
          </div>
          <div className="stack-6">
            <label htmlFor="f-composition" className="field-label">
              Composition
            </label>
            <input id="f-composition" className="input" maxLength={300} placeholder="Ex. 95 % coton bio, 5 % élasthanne" value={form.composition} onChange={set("composition")} aria-invalid={touched && !!compositionError} />
            {err(!!compositionError, compositionError ?? "")}
          </div>

          <p className="form-section">Chaîne de fabrication</p>
          <p className="muted-sm">Plus vous renseignez de pays, plus le calcul est précis. Un pays inconnu prend la valeur par défaut d'Ecobalyse, pénalisante.</p>
          <div className="grid-2">
            {countryInput("country_spinning", "Filature", "Ex. Turquie")}
            {countryInput("country_fabric", "Tissage ou tricotage", "Ex. Maroc")}
            {countryInput("country_dyeing", "Teinture", "Ex. Maroc")}
            <div className="stack-6">
              {countryInput("country_making", "Confection")}
              {err(missing.country_making, "Indiquez le pays de confection.")}
            </div>
          </div>
          <datalist id="f-countries">
            {COUNTRIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="stack-6">
            <label htmlFor="f-air" className="field-label">
              Transport vers le client
            </label>
            <select id="f-air" className="input" value={form.air_transport_pct} onChange={set("air_transport_pct")}>
              <option value="0">Camion ou bateau, sans avion</option>
              <option value="100">Avion</option>
              <option value="">Je ne sais pas</option>
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
          <p>
            Les données sont déclarées par vous ; VeriTrace calcule le résultat avec l'outil officiel Ecobalyse. Un passeport apparaît dans l'app grand
            public quand on scanne son code-barres, une fois vérifié par l'équipe VeriTrace.
          </p>
        </aside>
        <p className="muted-sm">
          En créant un passeport, vous acceptez les <a href="#/conditions">conditions d'utilisation</a> : vous représentez l'entreprise indiquée, et la
          note VeriTrace ne doit pas être reprise sur vos produits ou votre communication comme un label. Seul le coût environnemental, avec sa source,
          peut l'être.
        </p>
        <LegalLinks />
      </main>
      <footer className="actions">
        <button type="submit" form="maker" className="btn btn-primary" disabled={sending}>
          {sending ? "Calcul en cours…" : "Créer le passeport"}
        </button>
      </footer>
    </div>
  );
}
