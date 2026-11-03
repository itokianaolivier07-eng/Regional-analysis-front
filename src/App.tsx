import { useEffect, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "/api";

type Periode = { debut: string; fin: string };

type Finale = {
  domaine_critique: string;
  statut_urgence: string;
  verdict: string;
  priorites: string[];
  chiffres_cles: string[];
  horodatage: string;
  periode?: Periode | null;
};

type Analyse = {
  resume: string;
  gravite: string;
  horodatage: string;
  periode?: Periode | null;
  problematique?: string;
  cause?: string;
  preuve?: string;
  consequence?: string;
  solution?: string;
  chiffres_cles?: string[];
};

type Rubrique = {
  domaine: string;
  gravite: string;
  derniere_analyse: string;
  analyses: Analyse[];
};

type Stats = {
  documents: Record<string, number | null>;
  lots: Record<string, number>;
  par_categorie: Record<string, number>;
  sources_par_rubrique: Record<string, number>;
  dernier_run: { statut?: string; stage?: string; duree_secondes?: number; date_fin?: string };
};

type Page = "tableau" | "syntheses" | "rubriques";

const URGENCE: Record<string, { label: string; couleur: string }> = {
  critique: { label: "Critique", couleur: "#b91c1c" },
  grave: { label: "Grave", couleur: "#c2410c" },
  eleve: { label: "Élevé", couleur: "#d97706" },
  modere: { label: "Modéré", couleur: "#2563eb" },
  faible: { label: "Faible", couleur: "#16a34a" },
};

const ORDRE = ["faible", "modere", "eleve", "grave", "critique"];

const CATEGORIES: Record<string, string> = {
  news: "Articles de presse",
  social_media: "Baromètre citoyen",
  government_pub: "Sites publics",
  job_offers: "Offres d'emploi",
  business_registry: "Registre des entreprises",
  official_stats: "Statistiques officielles",
  housing: "Logement",
};

const STATUTS: Record<string, string> = {
  complete: "terminé",
  partial: "partiel",
  failed: "échec",
};

const PAGES: { id: Page; label: string }[] = [
  { id: "tableau", label: "Tableau de bord" },
  { id: "syntheses", label: "Historique des synthèses" },
  { id: "rubriques", label: "Historique des rubriques" },
];

function get<T>(chemin: string): Promise<T> {
  return fetch(`${API}${chemin}`).then((r) =>
    r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`Erreur ${r.status}`))
  );
}

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

const plage = (p?: Periode | null) =>
  p?.debut && p?.fin ? `du ${dateLongue(p.debut)} au ${dateLongue(p.fin)}` : null;

const nb = (n?: number | null) => (n == null ? "—" : n.toLocaleString("fr-FR"));

function evolution(courante: string, precedente?: string) {
  if (!precedente) return null;
  const ecart = ORDRE.indexOf(courante) - ORDRE.indexOf(precedente);
  if (ecart > 0) return "↑ En aggravation";
  if (ecart < 0) return "↓ En amélioration";
  return "= Gravité stable";
}

function trier(rubriques: Rubrique[], prioritaire: string): Rubrique[] {
  return [...rubriques].sort((a, b) => {
    const g = ORDRE.indexOf(b.gravite) - ORDRE.indexOf(a.gravite);
    if (g !== 0) return g;
    return Number(b.domaine === prioritaire) - Number(a.domaine === prioritaire);
  });
}

function Badge({ niveau }: { niveau: string }) {
  const u = URGENCE[niveau] ?? URGENCE.modere;
  return (
    <span className="badge" style={{ background: u.couleur }}>
      {u.label}
    </span>
  );
}

function Chiffres({ liste, max = 5 }: { liste?: string[]; max?: number }) {
  if (!liste || liste.length === 0) return null;
  return (
    <>
      <p><b>Chiffres clés :</b></p>
      <ul>
        {liste.slice(0, max).map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </>
  );
}

function Detail({ a }: { a: Analyse }) {
  return (
    <details>
      <summary>Voir le détail</summary>
      {a.problematique && <p><b>Constat :</b> {a.problematique}</p>}
      {a.cause && <p><b>Pourquoi :</b> {a.cause}</p>}
      {a.preuve && <p><b>Ce qui le prouve :</b> {a.preuve}</p>}
      {a.consequence && <p><b>Impact :</b> {a.consequence}</p>}
      {a.solution && <p><b>Action recommandée :</b> {a.solution}</p>}
      <Chiffres liste={a.chiffres_cles} />
    </details>
  );
}

/* ---------- Module 1 : tableau de bord + analyse actuelle ---------- */

function Tableau({
  finale,
  rubriques,
  stats,
  erreurStats,
  onRubrique,
}: {
  finale: Finale;
  rubriques: Rubrique[];
  stats: Stats | null;
  erreurStats: string;
  onRubrique: (domaine: string) => void;
}) {
  const d: Record<string, number | null> = stats?.documents ?? {};
  const lots: Record<string, number> = stats?.lots ?? {};
  const run = stats?.dernier_run;

  const cartesDocs: [string, number | null | undefined][] = [
    ["Documents lus", d.sources_lues],
    ["Après dédoublonnage", d.apres_dedoublonnage],
    ["Retirés", d.retires],
    ["dont relevés du baromètre regroupés par jour", d.social_agreges],
  ];
  const cartesLots: [string, number | undefined][] = [
    ["Lots niveau 1", lots.L1],
    ["Lots niveau 2", lots.L2],
    ["Bilans niveau 3", lots.L3],
    ["Synthèse niveau 4", lots.L4],
  ];

  const periode = plage(finale.periode);

  return (
    <>
      <h1 className="titre-page">Tableau de bord</h1>

      {erreurStats && (
        <p className="alerte">
          Statistiques indisponibles ({erreurStats}). Vérifie la route /stats de l'API.
        </p>
      )}

      <h2 className="titre-section">Documents</h2>
      <div className="grille-stats">
        {cartesDocs.map(([lib, val]) => (
          <div className="stat" key={lib}>
            <span className="stat-nb">{nb(val)}</span>
            <span className="stat-lib">{lib}</span>
          </div>
        ))}
      </div>

      <h2 className="titre-section">Lots du pipeline</h2>
      <div className="grille-stats">
        {cartesLots.map(([lib, val]) => (
          <div className="stat" key={lib}>
            <span className="stat-nb">{nb(val)}</span>
            <span className="stat-lib">{lib}</span>
          </div>
        ))}
      </div>

      {stats && (
        <div className="bloc bloc-info">
          <div>
            <h3>Documents analysés par type</h3>
            <ul className="liste-cat">
              {Object.entries(stats.par_categorie).map(([c, n]) => (
                <li key={c}>
                  <span>{CATEGORIES[c] ?? c}</span>
                  <b>{nb(n)}</b>
                </li>
              ))}
            </ul>
          </div>
          {run?.date_fin && (
            <div>
              <h3>Dernier lancement</h3>
              <p className="date">
                {dateHeure(run.date_fin)}
                <br />
                étape {run.stage} · {STATUTS[run.statut ?? ""] ?? run.statut}
                {run.duree_secondes != null && ` · ${Math.round(run.duree_secondes)} s`}
              </p>
            </div>
          )}
        </div>
      )}

      <h2 className="titre-section">Analyse actuelle</h2>
      {periode && <p className="periode-analyse">Résultat de l'analyse {periode}</p>}

      <section className="finale">
        <div className="entete">
          <h2>{finale.domaine_critique}</h2>
          <Badge niveau={finale.statut_urgence} />
        </div>
        <p className="date">Calculée le {dateHeure(finale.horodatage)}</p>
        <p className="verdict">{finale.verdict}</p>
        <h3>Priorités</h3>
        <ol>
          {finale.priorites.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <Chiffres liste={finale.chiffres_cles} />
      </section>

      <h2 className="titre-section">Les 5 rubriques</h2>
      <div className="grille">
        {trier(rubriques, finale.domaine_critique).map((r) => {
          const recente = [...r.analyses].sort((a, b) =>
            b.horodatage.localeCompare(a.horodatage)
          )[0];
          if (!recente) return null;
          const p = plage(recente.periode);
          const nbSources = stats?.sources_par_rubrique?.[r.domaine];
          return (
            <article
              key={r.domaine}
              className={"carte cliquable" + (r.domaine === finale.domaine_critique ? " retenue" : "")}
              role="button"
              tabIndex={0}
              onClick={() => onRubrique(r.domaine)}
              onKeyDown={(e) => e.key === "Enter" && onRubrique(r.domaine)}
            >
              <div className="entete">
                <h3>{r.domaine}</h3>
                <Badge niveau={r.gravite} />
              </div>
              {r.domaine === finale.domaine_critique && (
                <p className="etiquette">Rubrique prioritaire</p>
              )}
              {p && <p className="periode">Période : {p}</p>}
              {nbSources != null && <p className="date">{nb(nbSources)} sources</p>}
              <p className="resume">{recente.resume}</p>
              <p className="lien">Voir l'historique →</p>
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Module 2 : historique des synthèses finales ---------- */

function HistoriqueSyntheses() {
  const [lignes, setLignes] = useState<Finale[] | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    get<{ historique: Finale[] }>("/finale/historique")
      .then((d) => setLignes(d.historique))
      .catch((e) => setErreur(e.message));
  }, []);

  return (
    <>
      <h1 className="titre-page">Historique des synthèses</h1>
      <p className="date">
        Chaque nouvelle synthèse est ajoutée ici quand le résultat ou la période change.
      </p>
      {erreur && <p className="alerte">Impossible de charger l'historique ({erreur}).</p>}
      {!erreur && !lignes && <p className="etat">Chargement…</p>}

      <div className="frise">
        {lignes?.map((s, i) => {
          const precedente = lignes[i + 1];
          const change = precedente && precedente.domaine_critique !== s.domaine_critique;
          const p = plage(s.periode);
          return (
            <article key={s.horodatage + i} className={"point" + (i === 0 ? " actuel" : "")}>
              <div className="entete-point">
                <strong>{dateHeure(s.horodatage)}</strong>
                {i === 0 && <span className="tag-actuel">Version actuelle</span>}
                <Badge niveau={s.statut_urgence} />
              </div>
              {p && <p className="periode">Résultat de l'analyse {p}</p>}
              <p className="sous-titre">
                {s.domaine_critique}
                {change && <span className="evo"> · rubrique prioritaire modifiée</span>}
              </p>
              <p className="resume-plein">{s.verdict}</p>
              <details>
                <summary>Voir les priorités et chiffres clés</summary>
                <ol>
                  {s.priorites?.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
                <Chiffres liste={s.chiffres_cles} />
              </details>
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Module 3 : historique des rubriques ---------- */

function Frise({ domaine }: { domaine: string }) {
  const [lignes, setLignes] = useState<Analyse[] | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    get<{ historique: Analyse[] }>(`/rubriques/${encodeURIComponent(domaine)}/historique`)
      .then((d) => setLignes(d.historique))
      .catch((e) => setErreur(e.message));
  }, [domaine]);

  if (erreur) return <p className="alerte">Impossible de charger l'historique ({erreur}).</p>;
  if (!lignes) return <p className="etat">Chargement…</p>;

  return (
    <div className="frise">
      {lignes.map((a, i) => {
        const evo = evolution(a.gravite, lignes[i + 1]?.gravite);
        const p = plage(a.periode);
        return (
          <article key={a.horodatage + i} className={"point" + (i === 0 ? " actuel" : "")}>
            <div className="entete-point">
              <strong>{dateHeure(a.horodatage)}</strong>
              {i === 0 && <span className="tag-actuel">Version actuelle</span>}
              <Badge niveau={a.gravite} />
              {evo && <span className="evo">{evo}</span>}
            </div>
            {p && <p className="periode">Résultat de l'analyse {p}</p>}
            <p className="resume-plein">{a.resume}</p>
            <Detail a={a} />
          </article>
        );
      })}
    </div>
  );
}

function HistoriqueRubriques({
  rubriques,
  prioritaire,
  actif,
  onChoix,
}: {
  rubriques: Rubrique[];
  prioritaire: string;
  actif: string | null;
  onChoix: (domaine: string) => void;
}) {
  const triees = trier(rubriques, prioritaire);
  // La rubrique la plus critique est active par défaut
  const courant = actif && triees.some((r) => r.domaine === actif) ? actif : triees[0]?.domaine;

  return (
    <>
      <h1 className="titre-page">Historique des rubriques</h1>
      <div className="rub-layout">
        <nav className="rub-liste">
          {triees.map((r) => (
            <button
              key={r.domaine}
              className={"rub-item" + (r.domaine === courant ? " actif" : "")}
              onClick={() => onChoix(r.domaine)}
            >
              <span>{r.domaine}</span>
              <Badge niveau={r.gravite} />
            </button>
          ))}
        </nav>
        <div>{courant && <Frise key={courant} domaine={courant} />}</div>
      </div>
    </>
  );
}

/* ---------- Application ---------- */

export default function App() {
  const [page, setPage] = useState<Page>("tableau");
  const [finale, setFinale] = useState<Finale | null>(null);
  const [rubriques, setRubriques] = useState<Rubrique[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState("");
  const [erreurStats, setErreurStats] = useState("");
  const [rubriqueChoisie, setRubriqueChoisie] = useState<string | null>(null);

  useEffect(() => {
    get<Finale>("/finale").then(setFinale).catch((e) => setErreur(e.message));
    get<{ rubriques: Rubrique[] }>("/rubriques")
      .then((d) => setRubriques(d.rubriques))
      .catch((e) => setErreur(e.message));
    get<Stats>("/stats").then(setStats).catch((e) => setErreurStats(e.message));
  }, []);

  if (erreur) return <p className="etat">Impossible de charger l'analyse ({erreur}).</p>;
  if (!finale) return <p className="etat">Chargement…</p>;

  const aller = (p: Page) => {
    setPage(p);
    if (p === "rubriques") setRubriqueChoisie(null);
  };

  return (
    <div className="app">
      <aside className="menu">
        <h1>
          Analyse régionale
          <br />
          Corse
        </h1>
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={page === p.id ? "actif" : ""}
            onClick={() => aller(p.id)}
          >
            {p.label}
          </button>
        ))}
      </aside>

      <main className="contenu">
        {page === "tableau" && (
          <Tableau
            finale={finale}
            rubriques={rubriques}
            stats={stats}
            erreurStats={erreurStats}
            onRubrique={(d) => {
              setRubriqueChoisie(d);
              setPage("rubriques");
            }}
          />
        )}
        {page === "syntheses" && <HistoriqueSyntheses />}
        {page === "rubriques" && (
          <HistoriqueRubriques
            rubriques={rubriques}
            prioritaire={finale.domaine_critique}
            actif={rubriqueChoisie}
            onChoix={setRubriqueChoisie}
          />
        )}
      </main>
    </div>
  );
}