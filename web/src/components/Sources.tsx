import { CONFIDENCE_HELP, CONFIDENCE_LABEL, CONFIDENCE_STYLE, formatDate, formatNumber, isWebLink, SOURCE_LABEL } from "../lib/reliability";
import type { Product } from "../lib/types";
import { GradeBadge } from "./Grade";
import { IconInfo } from "./Icons";

/** Pastille de fiabilité (« Officielle » pour le registre, « Démo » pour les produits fictifs). */
export function ConfidencePill({ product }: { product: Product }) {
  if (product.data_source === "registre") {
    return (
      <span className="status-pill" style={CONFIDENCE_STYLE.haute}>
        Officielle
      </span>
    );
  }
  if (product.data_source === "demo" || !product.confidence) {
    return (
      <span className="status-pill" style={{ color: "#4A5A50", background: "#E3E8E4" }}>
        Démo
      </span>
    );
  }
  return (
    <span className="status-pill" style={CONFIDENCE_STYLE[product.confidence]}>
      {CONFIDENCE_LABEL[product.confidence]}
    </span>
  );
}

/** Bloc « Sources et fiabilité » de l'onglet Carbone : méthode, chiffres, source, hypothèses. */
export function SourcesCard({ product }: { product: Product }) {
  if (product.data_source === "demo") {
    return (
      <aside className="note">
        <IconInfo size={20} />
        <p>
          Produit fictif de démonstration : ses notes illustrent l'application et ne décrivent aucun vêtement réel. Les produits réels sont calculés avec Ecobalyse, la
          méthode officielle française d'affichage environnemental des vêtements.
        </p>
      </aside>
    );
  }

  const registry = product.data_source === "registre";
  const updated = formatDate(product.scored_at);
  const sourceDate = formatDate(product.source_date);
  const cost = formatNumber(product.eco_cost, 0);
  const climate = formatNumber(product.climate_kg, 1);

  return (
    <>
      <section className="card info-list" aria-label="Sources et fiabilité">
        <div className="info-row">
          <span className="muted">Méthode</span>
          <span className="info-value">{registry ? "Ecobalyse, déclarée par la marque" : "Ecobalyse (officielle, France)"}</span>
        </div>
        {cost && (
          <div className="info-row">
            <span className="muted">Coût environnemental</span>
            <span className="info-value sources-grade">
              {cost} points
              {product.env_grade && <GradeBadge grade={product.env_grade} size={24} />}
            </span>
          </div>
        )}
        {climate && (
          <div className="info-row">
            <span className="muted">Impact climat</span>
            <span className="info-value">{climate} kg CO₂e</span>
          </div>
        )}
        <div className="info-row">
          <span className="muted">Données</span>
          <span className="info-value">{SOURCE_LABEL[product.data_source]}</span>
        </div>
        <div className="info-row">
          <span className="muted">Fiabilité</span>
          <ConfidencePill product={product} />
        </div>
        {updated && (
          <div className="info-row">
            <span className="muted">{registry ? "Déclaré le" : "Calculé le"}</span>
            <span className="info-value">{updated}</span>
          </div>
        )}
      </section>

      {registry ? (
        <p className="muted-sm">
          Coût déclaré par la marque sur le portail officiel de l'affichage environnemental (ministère de la Transition écologique). Le registre ne
          publie pas la composition ni les pays de fabrication.
        </p>
      ) : (
        product.confidence && <p className="muted-sm">{CONFIDENCE_HELP[product.confidence]}</p>
      )}

      {product.assumptions.length > 0 && (
        <aside className="note">
          <IconInfo size={20} />
          <div>
            <p className="note-title">Hypothèses du calcul</p>
            <ul className="note-list">
              {product.assumptions.map((a) => (
                <li key={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</li>
              ))}
            </ul>
          </div>
        </aside>
      )}

      <p className="muted-sm">
        Note environnement : coût Ecobalyse à poids égal, comparé à deux références du même type de vêtement. A, proche d'un vêtement en coton bio fabriqué en
        France ; E, proche du « majorant par défaut » d'Ecobalyse (fabrication inconnue).
      </p>

      <div className="sources-links">
        {product.eco_web_url && (
          <a className="btn btn-outline" href={product.eco_web_url} target="_blank" rel="noopener noreferrer">
            {registry ? "Voir la fiche officielle" : "Voir le calcul sur Ecobalyse"}
          </a>
        )}
        {registry ? null : isWebLink(product.source_ref) ? (
          <a className="btn btn-outline" href={product.source_ref.trim()} target="_blank" rel="noopener noreferrer">
            Voir la source des données{sourceDate ? ` (${sourceDate})` : ""}
          </a>
        ) : (
          product.source_ref && (
            <p className="muted-sm">
              Source : {product.source_ref}
              {sourceDate ? `, ${sourceDate}` : ""}
            </p>
          )
        )}
      </div>
    </>
  );
}
