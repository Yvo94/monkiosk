
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Wallet,
  Receipt,
  CircleDollarSign,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Droplets,
  Activity,
  Info,
  ShieldAlert,
} from "lucide-react";

const DEVISE_DEFAUT = "FCFA";

function aujourdHuiAbidjan() {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function montant(valeur, devise = DEVISE_DEFAUT) {
  const nombre = Number(valeur ?? 0);

  return `${nombre.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} ${devise}`;
}

function nombre(valeur) {
  const resultat = Number(valeur ?? 0);
  return Number.isFinite(resultat) ? resultat : 0;
}

function dateLisible(date) {
  if (!date) return "Date indisponible";

  const valeur = new Date(`${date}T12:00:00Z`);

  if (Number.isNaN(valeur.getTime())) return date;

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Abidjan",
  }).format(valeur);
}

function dateHeureLisible(date) {
  if (!date) return "";

  const valeur = new Date(date);

  if (Number.isNaN(valeur.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Abidjan",
  }).format(valeur);
}

// Recherche une valeur dans les objets imbriqués de l'API.
// Cela permet de tolérer différentes organisations des indicateurs.
function trouverValeur(objet, noms, profondeur = 0) {
  if (!objet || typeof objet !== "object" || profondeur > 5) {
    return undefined;
  }

  const cles = Object.keys(objet);
  const normaliser = (texte) =>
    texte.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const nom of noms) {
    const cle = cles.find(
      (element) => normaliser(element) === normaliser(nom)
    );

    if (cle !== undefined && objet[cle] != null) {
      const valeur = objet[cle];

      if (
        typeof valeur === "number" ||
        typeof valeur === "string"
      ) {
        const converti = Number(valeur);

        if (Number.isFinite(converti)) return converti;
      }

      if (typeof valeur === "object") {
        const resultat = trouverValeur(
          valeur,
          ["total", "montant", "valeur", "previsionnel", "estime"],
          profondeur + 1
        );

        if (resultat !== undefined) return resultat;
      }
    }
  }

  for (const cle of cles) {
    if (objet[cle] && typeof objet[cle] === "object") {
      const resultat = trouverValeur(
        objet[cle],
        noms,
        profondeur + 1
      );

      if (resultat !== undefined) return resultat;
    }
  }

  return undefined;
}

function Indicateur({
  titre,
  valeur,
  detail,
  icon: Icon,
  couleur = "#14233B",
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-5 text-slate-500 sm:text-sm">
          {titre}
        </p>

        <div className="shrink-0 rounded-xl bg-[#14233B]/5 p-2.5 text-[#14233B]">
          <Icon size={20} />
        </div>
      </div>

      <p
        className="mt-4 break-words text-xl font-bold leading-tight tracking-tight sm:text-2xl"
        style={{ color: couleur }}
      >
        {valeur}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </article>
  );
}

function BlocSection({ titre, description, children, icon: Icon }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        {Icon && (
          <div className="shrink-0 rounded-xl bg-[#D8BD83]/20 p-2.5 text-[#14233B]">
            <Icon size={20} />
          </div>
        )}

        <div className="min-w-0">
          <h2 className="font-bold text-[#14233B]">{titre}</h2>
          {description && (
            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}

function BarreHorizontale({ titre, valeur, maximum, devise }) {
  const largeur =
    maximum > 0 ? Math.min(100, (valeur / maximum) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-600 sm:text-sm">
          {titre}
        </span>
        <span className="text-right text-xs font-bold text-[#14233B] sm:text-sm">
          {montant(valeur, devise)}
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#D8BD83] transition-all duration-500"
          style={{ width: `${largeur}%` }}
        />
      </div>
    </div>
  );
}

export default function PrevisionsRentabilitePage() {
  console.log("PAGE PREVISIONS RENTABILITE EXECUTEE");
  const [station, setStation] = useState(null);
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState("");
  const [dateCalcul, setDateCalcul] = useState(null);

  const chargerDonnees = useCallback(async (silencieux = false) => {
    console.log("CHARGER DONNEES APPELEE");
    if (silencieux) {
      setActualisation(true);
    } else {
      setChargement(true);
    }

    setErreur("");

    try {
      // 1. Identifier la station active avec le dashboard existant.
      const date = aujourdHuiAbidjan();

      const paramsDashboard = new URLSearchParams({
        date_debut: date,
        date_fin: date,
      });

      const reponseDashboard = await fetch(
        `/api/lavage/dashboard?${paramsDashboard.toString()}`,
        { cache: "no-store" }
      );

      if (reponseDashboard.status === 401) {
        window.location.replace("/login");
        return;
      }

      const dashboard = await reponseDashboard.json();

      if (!reponseDashboard.ok) {
        throw new Error(
          dashboard.error ||
            "Impossible de récupérer les informations de la station."
        );
      }

      const stationActive = dashboard?.station;

      if (!stationActive?.id) {
        throw new Error(
          "Aucune station de lavage active n'a été identifiée."
        );
      }

      setStation(stationActive);

      // 2. Charger les prévisions statistiques de rentabilité.
      const params = new URLSearchParams({
        lavage_id: stationActive.id,
      });

      const reponse = await fetch(
        `/api/lavage/previsions-rentabilite?${params.toString()}`,
        { cache: "no-store" }
      );

      if (reponse.status === 401) {
        window.location.replace("/login");
        return;
      }

      const resultat = await reponse.json();

      if (!reponse.ok) {
        throw new Error(
          resultat.error ||
            "Impossible de calculer les prévisions de rentabilité."
        );
      }

      console.log(
        "[DEBUG PRÉVISIONS RENTABILITÉ]",
        JSON.stringify(resultat, null, 2)
        );

      setDonnees(resultat);
      setDateCalcul(resultat.dateCalcul || new Date().toISOString());
    } catch (e) {
      console.error("[Copilote rentabilité]", e);
      setErreur(
        e.message || "Une erreur est survenue pendant le chargement."
      );
    } finally {
      console.log("CHARGEMENT TERMINE");
      setChargement(false);
      setActualisation(false);
    }
  }, []);

  useEffect(() => {
    console.log("USEEFFECT PREVISIONS DECLENCHE");
    chargerDonnees();
  }, [chargerDonnees]);

  if (chargement && !donnees) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="text-center">
          <RefreshCw
            size={28}
            className="mx-auto animate-spin text-[#14233B]"
          />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Analyse de la rentabilité de votre station...
          </p>
        </div>
      </main>
    );
  }

  if (erreur && !donnees) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 font-semibold text-red-800">
            <AlertCircle size={20} />
            Chargement impossible
          </div>

          <p className="mt-3 break-words text-sm text-red-700">
            {erreur}
          </p>

          <button
            type="button"
            onClick={() => chargerDonnees()}
            className="mt-4 min-h-11 rounded-xl bg-[#14233B] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  if (!donnees) return null;
    const devise = donnees?.station?.devise || DEVISE_DEFAUT;

    const previsions = donnees?.previsions || {};

    const caPrevisionnel = nombre(
    previsions?.chiffreAffaires?.total7Jours
    );

    const commissionsPrevisionnelles = nombre(
    previsions?.commissions?.totalPrevu7Jours
    );

    const depensesPrevisionnelles = nombre(
    previsions?.depenses?.montantPrevu7Jours
    );

    const resultatPrevisionnel = nombre(
    previsions?.resultatEstime7Jours
    );

  const historique = donnees.historique || {};
  const maturite = donnees.maturite || {};

  const totalCA = caPrevisionnel;

  const totalCommissions = commissionsPrevisionnelles;

  const totalDepenses = depensesPrevisionnelles;

  const resultatEstime = resultatPrevisionnel;

  const totalHistoriqueCA =
    trouverValeur(historique, [
      "totalCA",
      "chiffreAffaires",
      "caTotal",
    ]) ?? 0;

  const totalHistoriqueCommissions =
    trouverValeur(historique, [
      "totalCommissions",
      "commissionsTotales",
      "commissions",
    ]) ?? 0;

  const totalHistoriqueDepenses =
    trouverValeur(historique, [
      "totalDepenses",
      "depensesPayees",
      "depenses",
    ]) ?? 0;

  const resultatHistorique =
    trouverValeur(historique, [
      "resultatEstime",
      "resultatNet",
      "beneficeNet",
      "resteEstime",
    ]) ??
    totalHistoriqueCA -
      totalHistoriqueCommissions -
      totalHistoriqueDepenses;

  const joursDisponibles = nombre(maturite.joursDisponibles);
  const joursRequis = nombre(maturite.joursRequis) || 30;
  const progression = Math.min(
    100,
    nombre(maturite.progression) ||
      Math.round((joursDisponibles / joursRequis) * 100)
  );

  const recommandations = Array.isArray(donnees.recommandations)
    ? donnees.recommandations
    : [];

  const limites = Array.isArray(donnees.limites)
    ? donnees.limites
    : [];

  // Extraction des séries journalières, selon la structure renvoyée par l'API.
  function trouverSerie(objet, noms, profondeur = 0) {
    if (!objet || typeof objet !== "object" || profondeur > 4) {
      return [];
    }

    for (const nom of noms) {
      const valeur = objet[nom];

      if (
        Array.isArray(valeur) &&
        valeur.some((ligne) => ligne && typeof ligne === "object")
      ) {
        return valeur;
      }
    }

    for (const valeur of Object.values(objet)) {
      if (valeur && typeof valeur === "object") {
        const resultat = trouverSerie(
          valeur,
          noms,
          profondeur + 1
        );

        if (resultat.length) return resultat;
      }
    }

    return [];
  }

  const serieCA = Array.isArray(
    donnees?.previsions?.chiffreAffaires?.jours
    )
    ? donnees.previsions.chiffreAffaires.jours
    : [];

  const lireMontantJour = (jour, noms) =>
    trouverValeur(jour, noms) ?? 0;

  const maximumGraphique = Math.max(
    1,
    ...serieCA.map((jour) =>
      nombre(
        lireMontantJour(jour, [
          "montantPrevu",
          "montant",
          "valeur",
          "chiffreAffaires",
          "ca",
        ])
      )
    )
  );

  const nombreDepensesObservees = nombre(
    donnees?.previsions?.depenses?.nombreDepenses
  );

  const fiabilite = String(
    donnees?.previsions?.chiffreAffaires?.fiabilite ?? "faible"
    ).toLowerCase();

  const fiabiliteTexte =
    fiabilite === "bonne" || fiabilite === "elevee"
      ? "Bonne"
      : fiabilite === "moyenne"
        ? "Moyenne"
        : "Faible";

  const couleurFiabilite =
    fiabiliteTexte === "Bonne"
      ? "bg-emerald-100 text-emerald-800"
      : fiabiliteTexte === "Moyenne"
        ? "bg-blue-100 text-blue-800"
        : "bg-amber-100 text-amber-800";

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 overflow-x-clip px-3 py-4 sm:space-y-7 sm:px-5 sm:py-6 md:px-8 md:py-8">
      {/* En-tête */}
      <section className="relative overflow-hidden rounded-3xl bg-[#14233B] p-5 text-white shadow-lg sm:p-7 md:p-9">
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full border-[25px] border-white/[0.04] sm:h-60 sm:w-60" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-[#D8BD83]/10 blur-2xl" />

        <div className="relative">
          <Link
            href="/dashboard/lavage"
            className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 sm:text-sm"
          >
            <ArrowLeft size={16} />
            Retour au tableau de bord
          </Link>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[0.15em] text-[#D8BD83] sm:text-xs">
                <Droplets size={17} />
                MAAX BUSINESS · LAVAGE
              </div>

              <h1 className="text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
                Copilote de rentabilité
              </h1>

              <p className="mt-3 max-w-2xl text-xs leading-6 text-slate-300 sm:text-sm">
                Anticipez vos recettes, vos commissions et vos dépenses
                pour mieux piloter les résultats de votre station.
              </p>

              <p className="mt-4 text-sm font-semibold text-white">
                {station?.nom || donnees.station?.nom || "Ma station"}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Analyse calculée le {dateHeureLisible(dateCalcul)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => chargerDonnees(true)}
              disabled={actualisation}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-4 py-3 text-sm font-bold text-[#14233B] transition hover:bg-[#e6ce98] disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={actualisation ? "animate-spin" : ""}
              />
              Actualiser l’analyse
            </button>
          </div>
        </div>
      </section>

      {erreur && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>
            Actualisation impossible. Les derniers résultats chargés sont
            conservés à l’écran.
          </p>
        </div>
      )}

      {/* Maturité des données */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#14233B]/5 p-2.5 text-[#14233B]">
              <Activity size={21} />
            </div>

            <div>
              <h2 className="font-bold text-[#14233B]">
                Maturité des données
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                {joursDisponibles} jour(s) d’historique analysé(s) sur un
                objectif de {joursRequis} jours.
              </p>
            </div>
          </div>

          <span
            className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${
              maturite.seuilAtteint
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {maturite.seuilAtteint
              ? "Seuil de maturité atteint"
              : "Historique en constitution"}
          </span>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#D8BD83] transition-all duration-500"
            style={{ width: `${progression}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{progression}% de l’objectif</span>
          <span>
            {nombre(maturite.joursAvecActivite)} jour(s) avec activité
          </span>
        </div>

        {!maturite.seuilAtteint && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-800">
            <Info size={16} className="mt-0.5 shrink-0" />
            Les premières estimations sont provisoires. Continuez à
            enregistrer régulièrement les prestations et les dépenses.
          </p>
        )}
      </section>

      {/* Indicateurs prévisionnels */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#14233B] sm:text-xl">
            Résultats prévisionnels
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            Estimations statistiques pour les sept prochains jours.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <Indicateur
            titre="CA prévisionnel"
            valeur={montant(totalCA, devise)}
            detail="Recettes attendues sur 7 jours"
            icon={TrendingUp}
          />

          <Indicateur
            titre="Commissions estimées"
            valeur={montant(totalCommissions, devise)}
            detail="Rémunération prévisionnelle des laveurs"
            icon={Receipt}
            couleur="#B45309"
          />

          <Indicateur
            titre="Dépenses estimées"
            valeur={montant(totalDepenses, devise)}
            detail="Projection des dépenses payées"
            icon={Wallet}
            couleur="#B45309"
          />

          <Indicateur
            titre="Résultat estimé"
            valeur={montant(resultatEstime, devise)}
            detail="CA − commissions − dépenses estimées"
            icon={CircleDollarSign}
            couleur={resultatEstime < 0 ? "#B91C1C" : "#166534"}
          />
        </div>
      </section>

      {/* Répartition des prévisions */}
      <BlocSection
        titre="Répartition de la rentabilité"
        description="Comparaison des recettes attendues et des principales sorties estimées."
        icon={TrendingUp}
      >
        <div className="space-y-5">
          <BarreHorizontale
            titre="Chiffre d’affaires"
            valeur={Math.max(0, totalCA)}
            maximum={Math.max(
              1,
              totalCA,
              totalCommissions,
              totalDepenses,
              Math.abs(resultatEstime)
            )}
            devise={devise}
          />

          <BarreHorizontale
            titre="Commissions laveurs"
            valeur={Math.max(0, totalCommissions)}
            maximum={Math.max(
              1,
              totalCA,
              totalCommissions,
              totalDepenses,
              Math.abs(resultatEstime)
            )}
            devise={devise}
          />

          <BarreHorizontale
            titre="Dépenses estimées"
            valeur={Math.max(0, totalDepenses)}
            maximum={Math.max(
              1,
              totalCA,
              totalCommissions,
              totalDepenses,
              Math.abs(resultatEstime)
            )}
            devise={devise}
          />

          <div className="rounded-xl bg-[#14233B] p-4 text-white">
            <p className="text-xs text-slate-300">
              Résultat après charges prises en compte
            </p>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <p
                className={`break-words text-2xl font-bold ${
                  resultatEstime < 0 ? "text-red-300" : "text-[#D8BD83]"
                }`}
              >
                {montant(resultatEstime, devise)}
              </p>

              {totalCA > 0 && (
                <p className="text-xs text-slate-300">
                  Marge estimée :{" "}
                  {((resultatEstime / totalCA) * 100).toLocaleString(
                    "fr-FR",
                    { maximumFractionDigits: 1 }
                  )}
                  %
                </p>
              )}
            </div>
          </div>
        </div>
      </BlocSection>

      {/* Prévisions quotidiennes */}
      <BlocSection
        titre="Prévisions quotidiennes du chiffre d’affaires"
        description="Chaque barre représente le chiffre d’affaires estimé pour une journée."
        icon={CalendarDays}
      >
        {serieCA.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-6 text-center">
            <Info size={24} className="mx-auto text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Série journalière non disponible
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Les indicateurs globaux sont affichés, mais la structure
              journalière de l’API doit être vérifiée pour tracer ce graphique.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
            {serieCA.map((jour, index) => {
              const valeur = nombre(
                lireMontantJour(jour, [
                  "montantPrevu",
                  "montant",
                  "valeur",
                  "chiffreAffaires",
                  "ca",
                ])
              );

              const date =
                jour.date || jour.jour || jour.datePrevue || "";

              const hauteur =
                valeur > 0
                  ? Math.max(5, (valeur / maximumGraphique) * 100)
                  : 3;

              return (
                <div
                  key={date || index}
                  className="flex min-w-0 flex-col items-center"
                  title={`${date} : ${montant(valeur, devise)}`}
                >
                  <span className="mb-2 min-h-8 break-words text-center text-[9px] font-semibold leading-4 text-slate-600 sm:text-[11px]">
                    {valeur.toLocaleString("fr-FR")}
                  </span>

                  <div className="flex h-28 w-full items-end justify-center rounded-t-lg bg-slate-50 sm:h-36">
                    <div
                      className="w-full max-w-10 rounded-t-md bg-[#D8BD83] transition-all duration-500"
                      style={{ height: `${hauteur}%` }}
                    />
                  </div>

                  <span className="mt-2 text-center text-[9px] capitalize leading-4 text-slate-500 sm:text-[11px]">
                    {dateLisible(date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </BlocSection>

      {/* Historique */}
      <BlocSection
        titre="Historique analysé"
        description="Données historiques utilisées pour estimer la rentabilité."
        icon={Activity}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">CA historique</p>
            <p className="mt-2 break-words text-lg font-bold text-[#14233B]">
              {montant(totalHistoriqueCA, devise)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">
              Commissions historiques
            </p>
            <p className="mt-2 break-words text-lg font-bold text-[#14233B]">
              {montant(totalHistoriqueCommissions, devise)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">Dépenses payées</p>
            <p className="mt-2 break-words text-lg font-bold text-[#14233B]">
              {montant(totalHistoriqueDepenses, devise)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">
              Résultat historique estimé
            </p>
            <p
              className={`mt-2 break-words text-lg font-bold ${
                resultatHistorique < 0 ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {montant(resultatHistorique, devise)}
            </p>
          </div>
        </div>

        {maturite.datePremiereOperation && (
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Première opération prise en compte :{" "}
            {dateLisible(maturite.datePremiereOperation)}.
          </p>
        )}
      </BlocSection>

      {/* Fiabilité et dépenses */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BlocSection
          titre="Fiabilité des estimations"
          description="Le niveau de confiance dépend de la quantité et de la qualité de l’historique."
          icon={ShieldAlert}
        >
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${couleurFiabilite}`}
            >
              Fiabilité {fiabiliteTexte.toLowerCase()}
            </span>
          </div>

          <p className="mt-4 text-xs leading-6 text-slate-600">
            Les montants affichés sont des estimations statistiques et ne
            constituent pas une garantie de recettes ou de bénéfices.
            Les dépenses exceptionnelles et les changements d’activité
            peuvent modifier sensiblement les résultats.
          </p>
        </BlocSection>

        <BlocSection
          titre="Vigilance sur les dépenses"
          description="Une projection est plus pertinente lorsque les charges sont régulièrement enregistrées."
          icon={Wallet}
        >
          {nombreDepensesObservees > 0 &&
          nombreDepensesObservees <= 5 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-start gap-2 text-xs leading-5 text-amber-900">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                Le calcul repose sur un historique limité de{" "}
                {nombreDepensesObservees} dépense(s) observée(s). Le montant
                prévu peut être sous-estimé, notamment si certaines charges
                sont occasionnelles.
              </p>
            </div>
          ) : (
            <p className="text-xs leading-6 text-slate-600">
              Pensez à enregistrer toutes les dépenses payées, y compris
              les charges récurrentes et les dépenses exceptionnelles.
            </p>
          )}

          <Link
            href="/dashboard/lavage/depense"
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14233B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20385B]"
          >
            Consulter les dépenses
            <ArrowLeft size={16} className="rotate-180" />
          </Link>
        </BlocSection>
      </section>

      {/* Recommandations */}
      <BlocSection
        titre="Recommandations du copilote"
        description="Points de vigilance issus des données disponibles."
        icon={Lightbulb}
      >
        {recommandations.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Aucune recommandation particulière n’a été générée.
              Continuez à enregistrer les opérations et les charges pour
              enrichir l’analyse.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommandations.map((recommandation, index) => {
              const texte =
                typeof recommandation === "string"
                  ? recommandation
                  : recommandation.message ||
                    recommandation.description ||
                    recommandation.titre ||
                    "Consultez les données de rentabilité.";

              return (
                <div
                  key={recommandation.id || index}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 sm:p-4"
                >
                  <div className="shrink-0 rounded-lg bg-[#D8BD83]/20 p-2 text-[#14233B]">
                    <Lightbulb size={17} />
                  </div>

                  <p className="text-xs leading-6 text-slate-700 sm:text-sm">
                    {texte}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </BlocSection>

      {/* Limites de l'analyse */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-white p-2.5 text-slate-600 shadow-sm">
            <Info size={19} />
          </div>

          <div className="min-w-0">
            <h2 className="font-bold text-[#14233B]">
              À savoir sur cette analyse
            </h2>

            <p className="mt-2 text-xs leading-6 text-slate-600">
              Le résultat estimé n’est pas un bénéfice comptable définitif.
              Il prend uniquement en compte les recettes, les commissions et
              les dépenses intégrées au calcul. Les stocks, les achats à
              venir, les réparations et les autres charges non enregistrées
              ne sont pas nécessairement inclus.
            </p>

            {limites.length > 0 && (
              <ul className="mt-3 space-y-2">
                {limites.map((limite, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-xs leading-5 text-slate-600"
                  >
                    <CheckCircle2
                      size={15}
                      className="mt-0.5 shrink-0 text-slate-400"
                    />
                    <span>
                      {typeof limite === "string"
                        ? limite
                        : limite.message ||
                          limite.description ||
                          limite.titre ||
                          ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <p className="pb-2 text-[11px] leading-5 text-slate-400 sm:text-xs">
        MAAX Business · Copilote de rentabilité · Prévisions indicatives
        calculées à partir des données enregistrées.
      </p>
    </main>
  );
}
