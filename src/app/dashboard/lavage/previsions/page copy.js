
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Droplets,
  Lightbulb,
  RefreshCw,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

const DEVISE = "FCFA";
const HORIZONS_CA = [7, 15, 30]; 
const HORIZON_DEPENSES = 30;

// --------------------------------------------------
// Fonctions utilitairesd
// --------------------------------------------------

function aujourdHuiAbidjan() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function montant(valeur) {
  return `${Math.round(Number(valeur) || 0).toLocaleString("fr-FR")} ${DEVISE}`;
}

function dateCourte(date) {
  if (!date) return "—";

  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function budgetSur30Jours(moyenne) {
  return Math.round(Number(moyenne || 0) * HORIZON_DEPENSES);
}

function pourcentage(valeur, total) {
  return total > 0 ? Math.round((valeur / total) * 100) : 0;
}

// --------------------------------------------------
// Composants réutilisables
// --------------------------------------------------

function CarteIndicateur({ titre, valeur, description, icone: Icone, couleur }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{titre}</p>
          <p className="mt-3 break-words text-xl font-bold text-slate-900 sm:text-2xl">
            {montant(valeur)}
          </p>
          <p className="mt-2 text-xs text-slate-500">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${couleur}`}>
          <Icone size={20} />
        </div>
      </div>
    </div>
  );
}

function BlocSection({ titre, description, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function MessageVide({ icone: Icone, titre, description }) {
  return (
    <div className="rounded-xl bg-slate-50 p-5 text-center">
      <Icone className="mx-auto text-slate-500" size={26} />
      <p className="mt-2 text-sm font-semibold text-slate-800">{titre}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

// --------------------------------------------------
// Page principale
// --------------------------------------------------

export default function PrevisionsRentabilitePage() {
  const [station, setStation] = useState(null);
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState("");
  const [horizonCA, setHorizonCA] = useState(7);

  // ------------------------------------------------
  // Chargement des données
  // ------------------------------------------------

  const chargerDonnees = useCallback(async (silencieux = false) => {
    silencieux ? setActualisation(true) : setChargement(true);
    setErreur("");

    try {
      const date = aujourdHuiAbidjan();

      // Récupération de la station active
      const paramsDashboard = new URLSearchParams({
        date_debut: date,
        date_fin: date,
      });

      const reponseDashboard = await fetch(
        `/api/lavage/dashboard?${paramsDashboard}`,
        { cache: "no-store" }
      );

      if (reponseDashboard.status === 401) {
        window.location.replace("/login");
        return;
      }

      const dashboard = await reponseDashboard.json();

      if (!reponseDashboard.ok) {
        throw new Error(dashboard.error || "Impossible de récupérer la station.");
      }

      const stationActive = dashboard?.station;

      if (!stationActive?.id) {
        throw new Error("Aucune station active n'a été identifiée.");
      }

      setStation(stationActive);

      // Récupération des prévisions
      const params = new URLSearchParams({
        lavage_id: stationActive.id,
      });

      const reponse = await fetch(
        `/api/lavage/previsions-rentabilite?${params}`,
        { cache: "no-store" }
      );

      if (reponse.status === 401) {
        window.location.replace("/login");
        return;
      }

      const resultat = await reponse.json();

      if (!reponse.ok) {
        throw new Error(resultat.error || "Impossible de calculer les prévisions.");
      }

      setDonnees(resultat);
    } catch (error) {
      console.error("[Prévisions rentabilité]", error);
      setErreur(error.message || "Une erreur est survenue.");
    } finally {
      setChargement(false);
      setActualisation(false);
    }
  }, []);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  // ------------------------------------------------
  // Préparation des données
  // ------------------------------------------------

  const previsions = donnees?.previsions || {};
  const historique = donnees?.historique || {};
  const maturite = donnees?.maturite || {};

  const previsionCA = previsions.chiffreAffaires || {};
  const previsionCommissions = previsions.commissions || {};
  const previsionDepenses = previsions.depenses || {};

  const joursCA = (previsionCA.jours || []).slice(0, horizonCA);
  const categoriesDepenses = previsionDepenses.categories || [];
  const recommandations = donnees?.recommandations || [];

  const rechargement = previsionDepenses.rechargementElectricite;

  // Calcul du chiffre d'affaires
  const totalCA = joursCA.reduce(
    (total, jour) => total + Number(jour.montantPrevu || 0),
    0
  );

  const moyenneCA = joursCA.length
    ? Math.round(totalCA / joursCA.length)
    : 0;

  // Calcul des commissions
  const moyenneCommissions = Number(
    previsionCommissions.moyenneQuotidienne || 0
  );

  const totalCommissions = Math.round(moyenneCommissions * horizonCA);

  // Calcul des dépenses
  const moyenneDepenses = Number(previsionDepenses.moyenneQuotidienne || 0);
  const totalDepenses = budgetSur30Jours(moyenneDepenses);
  const depensesSurHorizonCA = Math.round(moyenneDepenses * horizonCA);

  // Résultat estimé sur la période du chiffre d'affaires
  const resultatEstime = totalCA - totalCommissions - depensesSurHorizonCA;

  // Hauteur maximale des barres
  const montantMaximum = Math.max(
    ...joursCA.map((jour) => Number(jour.montantPrevu || 0)),
    1
  );

  // ------------------------------------------------
  // Recommandations liées aux dépenses
  // ------------------------------------------------

  function creerRecommandationDepense(categorie) {
    const nom = String(categorie.categorie || "").toLowerCase();
    const budget = budgetSur30Jours(categorie.moyenneQuotidienne);

    if (nom.includes("électricité") || nom.includes("electricite")) {
      return {
        id: "electricite",
        titre: "Anticiper le rechargement électrique",
        message: `Prévoir environ ${montant(budget)} pour l'électricité sur 30 jours.`,
        detail:
          "Cette estimation repose sur les dépenses électriques historiques.",
        icone: Zap,
      };
    }

    if (nom.includes("produit")) {
      return {
        id: "produits",
        titre: "Anticiper le stock de produits",
        message: `Prévoir environ ${montant(budget)} pour les produits de lavage.`,
        detail: "Surveillez les stocks de shampoing, détergent et consommables.",
        icone: Droplets,
      };
    }

    return {
      id: nom || "autre-depense",
      titre: `Anticiper : ${categorie.categorie}`,
      message: `Prévoir environ ${montant(budget)} sur les 30 prochains jours.`,
      detail: "Estimation basée sur les dépenses quotidiennes historiques.",
      icone: Wallet,
    };
  }

  const recommandationsDepenses = categoriesDepenses.map(
    creerRecommandationDepense
  );

  // ------------------------------------------------
  // Écrans de chargement et d'erreur
  // ------------------------------------------------

  if (chargement && !donnees) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto animate-spin text-[#D8BD83]" size={30} />
          <p className="mt-3 text-sm text-slate-500">
            Calcul des prévisions de votre station...
          </p>
        </div>
      </div>
    );
  }

  if (erreur && !donnees) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle size={23} />
          <h2 className="font-semibold">Impossible de charger les prévisions</h2>
        </div>

        <p className="mt-3 text-sm text-red-600">{erreur}</p>

        <button
          onClick={() => chargerDonnees()}
          className="mt-4 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!donnees) return null;

  // ------------------------------------------------
  // Affichage
  // ------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 overflow-hidden pb-10">

      {/* En-tête */}
      <header className="rounded-3xl bg-[#14233B] p-5 text-white shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-[#D8BD83]">
              <Activity size={17} />
              MAAX BUSINESS · PILOTAGE INTELLIGENT
            </div>

            <h1 className="text-2xl font-bold sm:text-3xl">
              Prévisions & rentabilité
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Anticipez les recettes, les dépenses et les besoins de votre station.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <CalendarDays size={16} />
                Prévisions sur {horizonCA} jours
              </span>
              <span>Dépenses sur 30 jours</span>
              {station?.nom && <span>{station.nom}</span>}
            </div>
          </div>

          <button
            onClick={() => chargerDonnees(true)}
            disabled={actualisation}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={actualisation ? "animate-spin" : ""}
            />
            {actualisation ? "Actualisation..." : "Actualiser"}
          </button>
        </div>
      </header>

      {/* Fiabilité des données */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#D8BD83]/40 bg-[#D8BD83]/10 p-5 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <Activity className="shrink-0 text-[#14233B]" size={22} />

          <div>
            <p className="font-semibold text-[#14233B]">
              Niveau de maturité des données
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {maturite.joursDisponibles || 0} jours disponibles sur{" "}
              {maturite.joursRequis || 30} jours nécessaires.
            </p>
          </div>
        </div>

        <div className="w-full md:w-48">
          <div className="mb-2 flex justify-between text-xs text-slate-600">
            <span>Progression</span>
            <strong>{maturite.progression || 0}%</strong>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#D8BD83]"
              style={{
                width: `${Math.min(Number(maturite.progression || 0), 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Indicateurs financiers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          titre="CA prévisionnel"
          valeur={totalCA}
          description={`Recettes estimées sur ${horizonCA} jours`}
          icone={TrendingUp}
          couleur="bg-blue-50 text-blue-700"
        />

        <CarteIndicateur
          titre="Commissions laveurs"
          valeur={totalCommissions}
          description={`Estimations sur ${horizonCA} jours`}
          icone={Wallet}
          couleur="bg-purple-50 text-purple-700"
        />

        <CarteIndicateur
          titre="Dépenses prévisionnelles"
          valeur={totalDepenses}
          description="Dépenses estimées sur 30 jours"
          icone={ArrowDownRight}
          couleur="bg-amber-50 text-amber-700"
        />

        <CarteIndicateur
          titre="Résultat estimé"
          valeur={resultatEstime}
          description={`Après commissions et dépenses sur ${horizonCA} jours`}
          icone={Activity}
          couleur="bg-emerald-50 text-emerald-700"
        />
      </div>

      {/* Prévisions du chiffre d'affaires */}
      <BlocSection
        titre="Évolution prévisionnelle du chiffre d'affaires"
        description={`Estimation quotidienne pour les ${horizonCA} prochains jours.`}
        action={
          <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            Fiabilité : {previsionCA.fiabilite || "Non précisée"}
          </span>
        }
      >
        <div className="space-y-5">

          {/* Choix de la période */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">
              Choisir la période
            </p>

            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 sm:flex">
              {HORIZONS_CA.map((horizon) => (
                <button
                  key={horizon}
                  onClick={() => setHorizonCA(horizon)}
                  aria-pressed={horizonCA === horizon}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    horizonCA === horizon
                      ? "bg-[#14233B] text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {horizon} jours
                </button>
              ))}
            </div>
          </div>

          {/* Total et moyenne */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                CA prévisionnel sur {horizonCA} jours
              </p>
              <p className="mt-2 text-xl font-bold text-[#14233B]">
                {montant(totalCA)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Moyenne quotidienne</p>
              <p className="mt-2 text-xl font-bold text-[#14233B]">
                {montant(moyenneCA)}
              </p>
            </div>
          </div>

          {/* Graphique */}
          {joursCA.length === 0 ? (
            <MessageVide
              icone={TrendingUp}
              titre="Aucune prévision disponible"
              description="Aucune prévision quotidienne n'a été retournée."
            />
          ) : (
            <div className="overflow-x-auto pb-3">
              <div
                className={`grid gap-3 ${
                  joursCA.length > 10 ? "min-w-[600px]" : ""
                }`}
                style={{
                  gridTemplateColumns: `repeat(${joursCA.length}, minmax(0, 1fr))`,
                }}
              >
                {joursCA.map((jour) => {
                  const valeur = Number(jour.montantPrevu || 0);
                  const hauteur = valeur
                    ? Math.max((valeur / montantMaximum) * 100, 3)
                    : 0;

                  return (
                    <div key={jour.date} className="flex flex-col items-center">
                      <p className="mb-2 text-center text-xs font-semibold text-slate-600">
                        {valeur.toLocaleString("fr-FR")}
                      </p>

                      <div className="flex h-40 w-full items-end justify-center rounded-t-lg bg-slate-50 sm:h-48">
                        <div
                          className="w-full max-w-12 rounded-t-lg"
                          style={{
                            height: `${hauteur}%`,
                            background:
                              "linear-gradient(to top, #14233B, #D8BD83)",
                          }}
                        />
                      </div>

                      <p className="mt-2 text-center text-xs capitalize text-slate-500">
                        {dateCourte(jour.date)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </BlocSection>

      {/* Recommandations */}
      <BlocSection
        titre="Recommandations pour votre station"
        description="Actions à anticiper selon votre activité et vos dépenses."
      >
        <div className="space-y-3">

          {recommandationsDepenses.map((item) => {
            const Icone = item.icone;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-amber-200 bg-amber-50/70 p-4"
              >
                <div className="flex items-start gap-3">
                  <Icone className="shrink-0 text-amber-600" size={21} />

                  <div>
                    <p className="font-semibold text-slate-900">{item.titre}</p>
                    <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                    <p className="mt-2 text-xs text-slate-500">{item.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {recommandations.map((item, index) => (
            <div
              key={`${item.type || "recommandation"}-${index}`}
              className="rounded-xl border border-blue-200 bg-blue-50/70 p-4"
            >
              <div className="flex items-start gap-3">
                <Lightbulb className="shrink-0 text-blue-700" size={21} />

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{item.titre}</p>

                    {item.priorite && (
                      <span className="rounded-full bg-white px-2 py-1 text-xs text-blue-700">
                        {item.priorite.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-slate-700">{item.message}</p>

                  {item.action && (
                    <p className="mt-2 text-xs text-slate-500">
                      <strong>Action conseillée :</strong> {item.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {recommandationsDepenses.length === 0 &&
            recommandations.length === 0 && (
              <MessageVide
                icone={CheckCircle2}
                titre="Aucune alerte particulière"
                description="Aucun point nécessitant une attention immédiate n'a été identifié."
              />
            )}
        </div>
      </BlocSection>

      {/* Prévision électrique */}
      <BlocSection
        titre="Prochain rechargement électrique"
        description="Estimation basée sur les opérations réalisées entre les rechargements."
        action={
          rechargement?.disponible && (
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              Fiabilité : {rechargement.confiance}
            </span>
          )
        }
      >
        {!rechargement?.disponible ? (
          <MessageVide
            icone={Zap}
            titre="Prévision électrique indisponible"
            description="Enregistrez au moins deux rechargements électriques pour calculer un premier intervalle."
          />
        ) : (
          <div className="space-y-5">

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-3">
                <Zap className="text-amber-600" size={26} />

                <div>
                  <p className="text-sm text-slate-600">
                    Prochaine recharge estimée
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[#14233B]">
                    {dateCourte(rechargement.datePrevue)}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                Environ{" "}
                <strong>{rechargement.joursRestantsEstimes} jour(s)</strong>{" "}
                restant(s).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  titre: "Dernier rechargement",
                  valeur: dateCourte(rechargement.dernierRechargement),
                  detail: montant(rechargement.dernierMontantRecharge),
                },
                {
                  titre: "Opérations par cycle",
                  valeur: Math.round(rechargement.objectifOperations || 0),
                  detail: "Objectif estimé",
                },
                {
                  titre: "Opérations restantes",
                  valeur: Math.round(
                    rechargement.operationsRestantesEstimees || 0
                  ),
                  detail: "Après le dernier rechargement",
                },
                {
                  titre: "Rythme récent",
                  valeur: Number(
                    rechargement.rythmeRecentOperationsParJour || 0
                  ).toLocaleString("fr-FR", { maximumFractionDigits: 1 }),
                  detail: "Opérations par jour",
                },
              ].map((item) => (
                <div key={item.titre} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{item.titre}</p>
                  <p className="mt-2 break-words text-lg font-bold text-slate-900">
                    {item.valeur}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 shrink-0 text-amber-600" size={20} />

                <div>
                  <p className="font-semibold text-slate-800">
                    À propos de cette estimation
                  </p>

                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    {rechargement.methode ||
                      "Estimation statistique basée sur le nombre d'opérations entre les rechargements."}
                  </p>

                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    Le calcul suppose que le compteur est vide à chaque
                    rechargement. Il ne tient pas compte d'un éventuel crédit
                    restant.
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {rechargement.nombreRechargementsObserves || 0} rechargement(s)
                    observé(s) · {rechargement.nombreIntervallesAnalyses || 0}{" "}
                    intervalle(s) analysé(s).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </BlocSection>

      {/* Budget des dépenses */}
      <BlocSection
        titre="Budget des dépenses à prévoir"
        description="Répartition estimée des dépenses sur les 30 prochains jours."
      >
        {categoriesDepenses.length === 0 ? (
          <MessageVide
            icone={Wallet}
            titre="Aucune catégorie de dépense"
            description="Aucune donnée de dépense disponible pour établir un budget."
          />
        ) : (
          <div className="space-y-5">
            {categoriesDepenses.map((categorie, index) => {
              const budget = budgetSur30Jours(categorie.moyenneQuotidienne);
              const part = pourcentage(budget, totalDepenses);

              const nom = String(categorie.categorie || "").toLowerCase();
              const electricite =
                nom.includes("électricité") || nom.includes("electricite");

              return (
                <div key={`${categorie.categorie}-${index}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {electricite ? (
                        <Zap className="text-amber-500" size={18} />
                      ) : (
                        <Wallet className="text-slate-500" size={18} />
                      )}

                      <span className="text-sm font-medium text-slate-700">
                        {categorie.categorie}
                      </span>
                    </div>

                    <strong className="text-sm text-slate-900">
                      {montant(budget)}
                    </strong>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        electricite ? "bg-amber-400" : "bg-[#14233B]"
                      }`}
                      style={{ width: `${part}%` }}
                    />
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    {part}% du budget prévisionnel
                  </p>
                </div>
              );
            })}

            <div className="flex flex-col justify-between gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
              <span className="text-sm font-semibold text-slate-700">
                Budget total sur 30 jours
              </span>
              <strong className="text-xl text-[#14233B]">
                {montant(totalDepenses)}
              </strong>
            </div>
          </div>
        )}
      </BlocSection>

      {/* Historique et méthode */}
      <div className="grid gap-4 lg:grid-cols-2">

        <BlocSection
          titre="Historique de la station"
          description="Données utilisées pour établir les prévisions."
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Chiffre d'affaires", historique.chiffreAffaires],
              ["Commissions", historique.commissions],
              ["Dépenses payées", historique.depensesPayees],
              [
                "Résultat historique",
                historique.resultatApresCommissionsEtDepenses,
              ],
            ].map(([titre, valeur]) => (
              <div key={titre} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{titre}</p>
                <p className="mt-2 break-words text-base font-bold text-slate-900">
                  {montant(valeur)}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Période : {dateCourte(historique.debut)} au{" "}
            {dateCourte(historique.fin)} · {historique.jours || 0} jours.
          </p>
        </BlocSection>

        <BlocSection
          titre="Comprendre les estimations"
          description="Méthode et précautions d'interprétation."
        >
          <div className="space-y-5">
            {[
              {
                titre: "Prévision du chiffre d'affaires",
                icone: CheckCircle2,
                couleur: "text-emerald-600",
                texte:
                  previsionCA.methode ||
                  "Méthode statistique basée sur l'historique disponible.",
              },
              {
                titre: "Estimation des dépenses",
                icone: Clock3,
                couleur: "text-blue-600",
                texte:
                  previsionDepenses.avertissement ||
                  "Estimation basée sur les dépenses historiques.",
              },
              {
                titre: "Résultat estimé",
                icone: AlertTriangle,
                couleur: "text-amber-600",
                texte:
                  "Ce résultat n'est pas un bénéfice comptable. Il prend uniquement en compte le chiffre d'affaires, les commissions et les dépenses enregistrées dans l'application. Les dépenses sont ramenées à la période CA sélectionnée.",
              },
            ].map((item) => {
              const Icone = item.icone;

              return (
                <div key={item.titre} className="flex items-start gap-3">
                  <Icone className={`mt-1 shrink-0 ${item.couleur}`} size={19} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.titre}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.texte}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </BlocSection>
      </div>

      {/* Limites */}
      {donnees.limites?.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-slate-500" size={19} />
            <h2 className="font-semibold text-slate-800">
              Limites des prévisions
            </h2>
          </div>

          <ul className="mt-3 space-y-2">
            {donnees.limites.map((limite, index) => (
              <li key={index} className="flex gap-2 text-sm text-slate-500">
                <span>•</span>
                <span>{limite}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pied de page */}
      <p className="text-center text-xs text-slate-400">
        Prévisions statistiques · {station?.nom || "MAAX Business"} ·
        Actualisées à la demande
      </p>
    </div>
  );
}
