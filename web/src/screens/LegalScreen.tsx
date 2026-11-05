import { type FormEvent, useEffect, useState } from "react";
import { Header } from "../components/Header";
import { navigate } from "../lib/router";
import { isRtl, t, tv, type Key } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { sessionId } from "../lib/track";

export type LegalPage = "confidentialite" | "mentions-legales" | "conditions";

const TITLES: Record<LegalPage, Key> = {
  confidentialite: "legal.privacy",
  "mentions-legales": "legal.notice",
  conditions: "legal.terms",
};

/** Liens vers les trois pages, en bas de l'accueil et de l'espace fabricants. */
export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label={t("legal.navAria")}>
      <a href="#/confidentialite">{t("legal.privacy")}</a>
      <span aria-hidden="true">·</span>
      <a href="#/mentions-legales">{t("legal.notice")}</a>
      <span aria-hidden="true">·</span>
      <a href="#/conditions">{t("legal.terms")}</a>
    </nav>
  );
}

export function LegalScreen({ page }: { page: LegalPage }) {
  const rtl = isRtl();
  // Lien « formulaire de contact » : on descend directement au formulaire
  useEffect(() => {
    if (/[?&]contact=1\b/.test(window.location.hash)) document.getElementById("contact")?.scrollIntoView({ block: "start" });
  }, [page]);

  return (
    <div className="screen">
      <Header title={t(TITLES[page])} backTo="/" backLabel={t("common.backHome")} />
      <main className="content legal">
        {/* Texte juridique en français (version qui fait foi) ; en arabe, un paragraphe l'explique en tête */}
        {rtl && <p className="lead">{t("legal.arNotice")}</p>}
        <div className="legal-body" lang={rtl ? "fr" : undefined} dir={rtl ? "ltr" : undefined}>
          {page === "confidentialite" && <Privacy />}
          {page === "mentions-legales" && <Notice />}
          {page === "conditions" && <Terms />}
        </div>
        {page === "confidentialite" && <ContactForm />}
        <p className="muted-sm">{t("legal.updated", { date: t("legal.updatedDate") })}</p>
        <nav className="legal-links" aria-label={t("legal.otherAria")}>
          {(Object.keys(TITLES) as LegalPage[])
            .filter((p) => p !== page)
            .map((p) => (
              <a key={p} href={`#/${p}`}>
                {t(TITLES[p])}
              </a>
            ))}
        </nav>
      </main>
    </div>
  );
}

function Privacy() {
  return (
    <>
      <p className="lead">
        VeriTrace collecte le minimum : pas de compte, pas de nom, pas d'adresse e-mail obligatoire, pas de publicité ni de cookie de suivi.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        Bangaly Kanté, éditeur du projet VeriTrace (Casablanca, Maroc). Pour toute question ou pour exercer vos droits, utilisez le{" "}
        <a href="#/confidentialite?contact=1">formulaire de contact</a> en bas de cette page. Déclaration auprès de la CNDP (loi n° 09-08) : en cours.
      </p>

      <h2>Données traitées</h2>
      <table className="legal-table">
        <thead>
          <tr>
            <th scope="col">Donnée</th>
            <th scope="col">Pourquoi</th>
            <th scope="col">Durée</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Mesure d'usage : identifiant de session tiré au hasard à chaque visite, écrans vus, codes-barres scannés, notes affichées</td>
            <td>Améliorer l'application et mesurer son usage (étude de master)</td>
            <td>13 mois</td>
          </tr>
          <tr>
            <td>Photo et texte de l'étiquette d'un vêtement, composition lue, résultat du calcul</td>
            <td>Calculer la note ; vérifier les lectures</td>
            <td>Photo : 12 mois au plus. Résultat : tant que le service existe (donnée sur le vêtement, pas sur vous)</td>
          </tr>
          <tr>
            <td>Vêtements signalés ou ajoutés (code-barres, marque, composition, photo facultative)</td>
            <td>Compléter le catalogue après vérification</td>
            <td>Tant que le service existe ; photo : 12 mois au plus</td>
          </tr>
          <tr>
            <td>Passeports créés par un fabricant (entreprise, ville, produit, chaîne de fabrication)</td>
            <td>Publier la page publique du passeport</td>
            <td>Jusqu'à demande de suppression</td>
          </tr>
          <tr>
            <td>Empreinte de la connexion (adresse IP transformée de façon irréversible, renouvelée chaque jour)</td>
            <td>Limiter les abus (quotas journaliers)</td>
            <td>30 jours</td>
          </tr>
          <tr>
            <td>Messages envoyés par le formulaire de contact (et votre e-mail si vous le donnez)</td>
            <td>Vous répondre</td>
            <td>12 mois</td>
          </tr>
          <tr>
            <td>
              Rapports d'erreur techniques : message d'erreur, écran concerné, navigateur ou modèle de téléphone, version de l'application. Sans adresse IP,
              sans identité, sans capture ni enregistrement d'écran
            </td>
            <td>Détecter et corriger les pannes</td>
            <td>30 jours (90 jours au plus selon l'offre Sentry)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Sur votre appareil seulement : l'historique de vos derniers scans et vos préférences (type de vêtement), dans le stockage local du navigateur ou de
        l'application. Ils ne sont jamais envoyés ; « Réinitialiser » les efface.
      </p>
      <p>
        La caméra sert à lire les codes-barres et les étiquettes. Les images restent sur l'appareil, sauf la photo d'une étiquette que vous choisissez
        d'envoyer pour le calcul.
      </p>

      <h2>Destinataires et hébergement</h2>
      <ul>
        <li>Supabase (base de données et stockage), serveurs à Paris (France).</li>
        <li>Vercel (hébergement du site), réseau mondial.</li>
        <li>GitHub (téléchargement de l'application Android).</li>
        <li>Sentry (Functional Software, Inc.) : suivi des erreurs techniques, données hébergées en Allemagne (Union européenne).</li>
        <li>
          Le cas échéant, Anthropic (États-Unis) : lecture par IA de la photo d'une étiquette, quand le texte n'a pas pu être lu sur votre appareil.
        </li>
        <li>
          Ecobalyse, outil public du ministère français de la Transition écologique : reçoit la composition et les pays de fabrication d'un vêtement,
          jamais de donnée sur vous.
        </li>
      </ul>
      <p>Ces données sont donc hébergées hors du Maroc, dans l'Union européenne pour la base de données. Elles ne sont ni vendues ni louées.</p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l'accès à vos données, leur rectification ou leur suppression, et vous opposer à leur traitement (loi n° 09-08, articles 7 à
        9 ; règlement européen RGPD si vous êtes dans l'Union européenne). Comme aucun compte n'existe, indiquez ce qui permet de retrouver vos données
        (code-barres, date, code du passeport). Vous pouvez aussi saisir la CNDP (cndp.ma) ou, dans l'Union européenne, votre autorité de protection des
        données.
      </p>
    </>
  );
}

function Notice() {
  return (
    <>
      <h2>Éditeur</h2>
      <p>
        VeriTrace, projet édité par Bangaly Kanté, étudiant en master Marketing et Transformation Digitale (HESTIM, Casablanca, Maroc). Directeur de la
        publication : Bangaly Kanté. Contact : <a href="#/confidentialite?contact=1">formulaire de contact</a>.
      </p>

      <h2>Hébergement</h2>
      <ul>
        <li>Site : Vercel, Inc., 440 North Barranca Avenue, Suite 4133, Covina, Californie 91723, États-Unis.</li>
        <li>Base de données : Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513 ; serveurs à Paris (France).</li>
      </ul>

      <h2>Données et méthode</h2>
      <p>
        Coûts environnementaux : registre public de l'affichage environnemental des vêtements (data.gouv.fr, Licence Ouverte 2.0) et calculs avec
        Ecobalyse (ministère de la Transition écologique, France). Les notes A à E sont une convention VeriTrace, publiée dans la méthode ; ce ne sont pas
        des notes officielles.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Polices DM Sans et Space Grotesk sous licence SIL Open Font License 1.1. Marques et noms de produits cités : propriété de leurs titulaires. Les
        produits et marques de démonstration (Urbanline, Flashwear…) sont fictifs.
      </p>
    </>
  );
}

function Terms() {
  return (
    <>
      <p className="lead">VeriTrace informe sur l'impact des vêtements. En utilisant le service, vous acceptez les conditions ci-dessous.</p>

      <h2>Ce que montrent les notes</h2>
      <ul>
        <li>
          Le coût environnemental (en points) vient du registre officiel, déclaré par la marque, ou d'un calcul Ecobalyse à partir de l'étiquette ou des
          données d'un fabricant (« estimation VeriTrace »).
        </li>
        <li>
          La note A à E est une « note VeriTrace » : elle situe ce coût par rapport aux vêtements du même type déclarés au registre (A : parmi les 10 %
          les mieux placés ; E : parmi les 20 % les moins bien placés). Ce n'est ni une note officielle, ni un label.
        </li>
        <li>Les informations sont données sans garantie : une donnée déclarée par une marque ou lue sur une étiquette peut être incomplète ou fausse.</li>
      </ul>

      <h2>Contributions des utilisateurs</h2>
      <p>
        Une étiquette lue ou un vêtement ajouté reste visible par son auteur seul jusqu'à vérification. En envoyant une photo, vous confirmez qu'elle ne
        montre que l'étiquette du vêtement et vous autorisez VeriTrace à l'utiliser pour vérifier la lecture. Les envois abusifs ou trompeurs sont
        supprimés.
      </p>

      <h2>Espace fabricants et passeports</h2>
      <ul>
        <li>Les données d'un passeport sont déclarées sous la seule responsabilité de l'entreprise qui le crée ; la page l'indique (« non vérifié »).</li>
        <li>
          Il est interdit de reproduire la note VeriTrace (lettre, couleur, logo) sur un produit, une étiquette, un emballage ou une publicité comme s'il
          s'agissait d'un label ou d'une certification. Seul le coût environnemental, avec sa source, peut être repris.
        </li>
        <li>Il est interdit de créer un passeport au nom d'une entreprise que l'on ne représente pas. VeriTrace peut retirer tout passeport.</li>
      </ul>

      <h2>Responsabilité et droit applicable</h2>
      <p>
        VeriTrace est un projet étudiant fourni tel quel, sans engagement de disponibilité. Ces conditions peuvent évoluer ; la date de mise à jour figure
        en bas de page. Droit applicable : droit marocain.
      </p>
    </>
  );
}

const SUBJECTS = ["Mes données personnelles", "Erreur sur un vêtement", "Espace fabricants", "Autre"];

function ContactForm() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    const mail = email.trim();
    if (text.length < 10) {
      setError(t("contact.tooShort"));
      return;
    }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError(t("contact.badEmail"));
      return;
    }
    setError(null);
    setState("sending");
    const { error: dbError } = await supabase.from("contact_messages").insert({
      session_id: sessionId(),
      subject,
      message: text.slice(0, 2000),
      reply_email: mail ? mail.slice(0, 120) : null,
    });
    setState(dbError ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <section id="contact" className="card" role="status">
        <p className="row-title">{t("contact.sent")}</p>
        <p className="muted">{email.trim() ? t("contact.thanksEmail") : t("contact.thanksNoEmail")}</p>
        <button type="button" className="btn btn-text" onClick={() => navigate("/")}>
          {t("common.backHome")}
        </button>
      </section>
    );
  }

  return (
    <form id="contact" className="card stack-8" onSubmit={submit} noValidate>
      <h2>{t("contact.title")}</h2>
      <label className="field-label" htmlFor="contact-subject">
        {t("contact.subject")}
      </label>
      <select id="contact-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
        {SUBJECTS.map((s) => (
          <option key={s} value={s}>
            {tv(s)}
          </option>
        ))}
      </select>
      <label className="field-label" htmlFor="contact-message">
        {t("contact.message")}
      </label>
      <textarea
        dir="auto"
        id="contact-message"
        className="input"
        rows={5}
        maxLength={2000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "contact-error" : undefined}
      />
      <label className="field-label" htmlFor="contact-email">
        {t("contact.email")}
      </label>
      <input id="contact-email" dir="ltr" className="input" type="email" autoComplete="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
      {error && (
        <p id="contact-error" className="field-error">
          {error}
        </p>
      )}
      {state === "error" && <p className="field-error">{t("contact.failed")}</p>}
      <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
        {state === "sending" ? t("common.sending") : t("contact.send")}
      </button>
    </form>
  );
}
