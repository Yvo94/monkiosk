
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function pourcentage(valeur, total) {
  if (!total) return 0;
  return Math.round((valeur / total) * 100);
}

function CarteIndicateur({
  titre,
  valeur,
  description,
  icone: Icone,
  couleur,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{titre}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            {montant(valeur)}
          </p>
          <p className="mt-2 text-xs text-slate-500">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${couleur}`}>
          <Icone size={21} />
        </div>
      </div>
    </div>
  );
}

function BlocSection({ titre, description, children, action }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{titre}</h2>
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

export default function PrevisionsRentabilitePage() {
  const [station, setStation] = useState(null);
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState("");
  const [horizonCA, setHorizonCA] = useState(7);

  const chargerDonnees = useCallback(async (silencieux = false) => {
    if (silencieux) {
      setActualisation(true);
    } else {
      setChargement(true);
    }

    setErreur("");

    try {
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
          dashboard.error || "Impossible de récupérer la station active."
        );
      }

      const stationActive = dashboard?.station;

      if (!stationActive?.id) {
        throw new Error("Aucune station de lavage active n'a été identifiée.");
      }

      setStation(stationActive);

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
          resultat.error || "Impossible de calculer les prévisions."
        );
      }

      setDonnees(resultat);
    } catch (error) {
      console.error("[Prévisions rentabilité]", error);
      setErreur(
        error.message || "Une erreur est survenue pendant le chargement."
      );
    } finally {
      setChargement(false);
      setActualisation(false);
    }
  }, []);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  const previsions = donnees?.previsions || {};
  const historique = donnees?.historique || {};
  const maturite = donnees?.maturite || {};

  // Prévisions CA limitées à l'horizon choisi.
  const toutesLesPrevisionsCA = Array.isArray(
    previsions?.chiffreAffaires?.jours
  )
    ? previsions.chiffreAffaires.jours
    : [];

  const joursCA = toutesLesPrevisionsCA.slice(0, horizonCA);

  const totalCA = joursCA.reduce(
    (total, jour) => total + Number(jour.montantPrevu || 0),
    0
  );

  const moyenneCA = joursCA.length
    ? Math.round(totalCA / joursCA.length)
    : 0;

  // Commissions estimées selon l'horizon sélectionné.
  const moyenneCommissionsParJour = Number(
    previsions?.commissions?.moyenneQuotidienne || 0
  );

  const totalCommissions = Math.round(
    moyenneCommissionsParJour * horizonCA
  );

  // Dépenses toujours estimées sur 30 jours.
  const moyenneDepensesParJour = Number(
    previsions?.depenses?.moyenneQuotidienne || 0
  );

  const totalDepenses = Math.round(
    moyenneDepensesParJour * HORIZON_DEPENSES
  );

  // Pour le résultat, les dépenses sont ramenées à la période sélectionnée.
  const depensesSurHorizonCA = Math.round(
    moyenneDepensesParJour * horizonCA
  );

  const resultatEstime =
    totalCA - totalCommissions - depensesSurHorizonCA;

  const categoriesDepenses = Array.isArray(previsions?.depenses?.categories)
    ? previsions.depenses.categories
    : [];

  const recommandations = donnees?.recommandations || [];

  const recommandationsDepenses = useMemo(() => {
    return categoriesDepenses.map((categorie) => {
      const nom = String(categorie.categorie || "").toLowerCase();

      const budget30Jours = Math.round(
        Number(categorie.moyenneQuotidienne || 0) * HORIZON_DEPENSES
      );

      if (nom.includes("électricité") || nom.includes("electricite")) {
        return {
          id: "electricite",
          titre: "Anticiper le rechargement électrique",
          message: `Prévoir une enveloppe d'environ ${montant(
            budget30Jours
          )} pour l'électricité sur les 30 prochains jours.`,
          detail:
            "Cette estimation repose sur les dépenses quotidiennes historiques. Elle ne permet pas de connaître le niveau actuel du compteur.",
          icone: Zap,
        };
      }

      if (nom.includes("produit")) {
        return {
          id: "produits",
          titre: "Anticiper le stock de produits",
          message: `Prévoir environ ${montant(
            budget30Jours
          )} pour les produits de lavage sur les 30 prochains jours.`,
          detail:
            "Surveille les stocks de shampoing, détergent et autres consommables.",
          icone: Droplets,
        };
      }

      return {
        id: nom || `categorie-${categorie.categorie}`,
        titre: `Anticiper : ${categorie.categorie}`,
        message: `Prévoir environ ${montant(
          budget30Jours
        )} sur les 30 prochains jours.`,
        detail:
          "Projection calculée à partir des dépenses quotidiennes historiques.",
        icone: Wallet,
      };
    });
  }, [categoriesDepenses]);

  const montantMaximum = Math.max(
    ...joursCA.map((jour) => Number(jour.montantPrevu || 0)),
    1
  );

  if (chargement && !donnees) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <RefreshCw
            className="mx-auto animate-spin text-[#D8BD83]"
            size={32}
          />
          <p className="mt-4 text-sm text-slate-500">
            Calcul des prévisions de votre station...
          </p>
        </div>
      </div>
    );
  }

  if (erreur && !donnees) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle size={24} />
          <h2 className="font-semibold">
            Impossible de charger les prévisions
          </h2>
        </div>

        <p className="mt-3 text-sm text-red-600">{erreur}</p>

        <button
          onClick={() => chargerDonnees()}
          className="mt-5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!donnees) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      {/* En-tête */}
      <div className="overflow-hidden rounded-3xl bg-[#14233B] p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-[#D8BD83]">
              <Activity size={17} />
              <span>MAAX BUSINESS · PILOTAGE INTELLIGENT</span>
            </div>

            <h1 className="text-2xl font-bold md:text-3xl">
              Prévisions & rentabilité
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Anticipez les recettes, les dépenses et les besoins de votre
              station pour mieux préparer les prochains jours.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <CalendarDays size={15} />
                Prévisions CA sur {horizonCA} jours
              </span>

              <span className="text-slate-500">•</span>
              <span>Dépenses sur 30 jours</span>

              {station?.nom && (
                <>
                  <span className="text-slate-500">•</span>
                  <span>{station.nom}</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => chargerDonnees(true)}
            disabled={actualisation}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50 md:self-center"
          >
            <RefreshCw
              size={16}
              className={actualisation ? "animate-spin" : ""}
            />
            Actualiser
          </button>
        </div>
      </div>

      {/* Fiabilité */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#D8BD83]/40 bg-[#D8BD83]/10 p-4 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-[#14233B]">
            <Activity size={20} />
          </div>

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

        <div className="min-w-36">
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
            <span>Progression</span>
            <span>{maturite.progression || 0}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#D8BD83]"
              style={{
                width: `${Math.min(Number(maturite.progression || 0), 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Indicateurs */}
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
          description={`Rémunérations estimées sur ${horizonCA} jours`}
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

      {/* Graphique  CA */}
      
      <BlocSection
        titre="Évolution prévisionnelle du chiffre d'affaires"
        description={`Estimation quotidienne pour les ${horizonCA} prochains jours.`}
        action={
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Fiabilité :{" "}
            {previsions?.chiffreAffaires?.fiabilite || "Non précisée"}
          </span>
        }
      >
        <div className="space-y-6">
          {/* Sélecteur */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">
              Choisir la période
            </p>

            <div className="flex rounded-xl bg-slate-100 p-1">
              {HORIZONS_CA.map((horizon) => (
                <button
                  key={horizon}
                  type="button"
                  onClick={() => setHorizonCA(horizon)}
                  aria-pressed={horizonCA === horizon}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    horizonCA === horizon
                      ? "bg-[#14233B] text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {horizon} jours
                </button>
              ))}
            </div>
          </div>

          {/* Total et moyenne */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                CA prévisionnel sur {horizonCA} jours
              </p>
              <p className="mt-1 text-xl font-bold text-[#14233B]">
                {montant(totalCA)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Moyenne quotidienne estimée
              </p>
              <p className="mt-1 text-xl font-bold text-[#14233B]">
                {montant(moyenneCA)}
              </p>
            </div>
          </div>

          {/* Barres du graphique */}
          {joursCA.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Aucune prévision quotidienne disponible.
            </p>
          ) : (
            <div className="overflow-x-auto pb-3">
              <div
                className="grid min-w-[650px] gap-3"
                style={{
                  gridTemplateColumns: `repeat(${joursCA.length}, minmax(0, 1fr))`,
                }}
              >
                {joursCA.map((jour) => {
                  const valeur = Number(jour.montantPrevu || 0);
                  const hauteur =
                    valeur > 0
                      ? Math.max((valeur / montantMaximum) * 100, 3)
                      : 0;

                  return (
                    <div
                      key={jour.date}
                      className="flex min-w-0 flex-col items-center"
                    >
                      <p className="mb-2 min-h-8 text-center text-[10px] font-semibold leading-4 text-slate-600 sm:text-xs">
                        {valeur.toLocaleString("fr-FR")}
                      </p>

                      <div className="flex h-48 w-full items-end justify-center rounded-t-lg bg-slate-50">
                        <div
                          className="w-full max-w-12 rounded-t-lg transition-all duration-300"
                          style={{
                            height: `${hauteur}%`,
                            background:
                              "linear-gradient(to top, #14233B 0%, #D8BD83 100%)",
                          }}
                        />
                      </div>

                      <p className="mt-3 text-center text-[10px] capitalize text-slate-500 sm:text-xs">
                        {dateCourte(jour.date)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span
              className="h-3 w-3 rounded-sm"
              style={{
                background:
                  "linear-gradient(to top, #14233B 0%, #D8BD83 100%)",
              }}
            />
            Prévision quotidienne du chiffre d'affaires
          </div>
        </div>
      </BlocSection>

      {/* Recommandations */}
      <BlocSection
        titre="Recommandations pour votre station"
        description="Actions à anticiper à partir de l'activité et des dépenses enregistrées."
      >
        <div className="space-y-3">
          {recommandationsDepenses.map((item) => {
            const Icone = item.icone;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white p-2 text-amber-600">
                    <Icone size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {item.titre}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {item.message}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {item.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {recommandations.map((item, index) => (
            <div
              key={`${item.type || "recommandation"}-${index}`}
              className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 text-blue-700">
                  <Lightbulb size={20} />
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">
                      {item.titre}
                    </p>

                    {item.priorite && (
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase text-blue-700">
                        {item.priorite.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-slate-700">
                    {item.message}
                  </p>

                  {item.action && (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      <strong>Action conseillée :</strong> {item.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {recommandationsDepenses.length === 0 &&
            recommandations.length === 0 && (
              <div className="rounded-xl bg-slate-50 p-5 text-center">
                <CheckCircle2
                  className="mx-auto text-emerald-600"
                  size={25}
                />
                <p className="mt-2 font-medium text-slate-800">
                  Aucune alerte particulière
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Les données disponibles ne signalent pas de point nécessitant
                  une attention immédiate.
                </p>
              </div>
            )}
        </div>
      </BlocSection>

      {/* Budget des dépenses sur 30 jours */}
      <BlocSection
        titre="Budget des dépenses à prévoir"
        description="Répartition estimée des dépenses sur les 30 prochains jours."
      >
        {categoriesDepenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Aucune catégorie de dépense disponible.
          </p>
        ) : (
          <div className="space-y-5">
            {categoriesDepenses.map((categorie, index) => {
              const budgetCategorie30Jours = Math.round(
                Number(categorie.moyenneQuotidienne || 0) *
                  HORIZON_DEPENSES
              );

              const part = pourcentage(
                budgetCategorie30Jours,
                totalDepenses
              );

              const nomCategorie = String(
                categorie.categorie || ""
              ).toLowerCase();

              const electricite =
                nomCategorie.includes("électricité") ||
                nomCategorie.includes("electricite");

              return (
                <div key={`${categorie.categorie}-${index}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {electricite ? (
                        <Zap size={17} className="text-amber-500" />
                      ) : (
                        <Wallet size={17} className="text-slate-500" />
                      )}

                      <span className="text-sm font-medium text-slate-700">
                        {categorie.categorie}
                      </span>
                    </div>

                    <strong className="text-sm text-slate-900">
                      {montant(budgetCategorie30Jours)}
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
                    {part}% du budget prévisionnel sur 30 jours
                  </p>
                </div>
              );
            })}

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm font-semibold text-slate-700">
                Budget total à prévoir sur 30 jours
              </span>

              <span className="text-lg font-bold text-[#14233B]">
                {montant(totalDepenses)}
              </span>
            </div>
          </div>
        )}
      </BlocSection>

      {/* Historique et méthode */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BlocSection
          titre="Historique de la station"
          description="Données utilisées pour établir les prévisions."
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Chiffre d'affaires</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {montant(historique.chiffreAffaires)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Commissions</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {montant(historique.commissions)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Dépenses payées</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {montant(historique.depensesPayees)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Résultat historique</p>
              <p className="mt-2 text-lg font-bold text-emerald-700">
                {montant(
                  historique.resultatApresCommissionsEtDepenses
                )}
              </p>
            </div>
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
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 text-emerald-600"
                size={18}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Prévision du chiffre d'affaires
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {previsions?.chiffreAffaires?.methode ||
                    "Méthode statistique basée sur l'historique disponible."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 text-blue-600" size={18} />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Estimation des dépenses
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {previsions?.depenses?.avertissement ||
                    "Les dépenses sont estimées à partir de l'historique disponible."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 text-amber-600"
                size={18}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Résultat estimé
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Ce résultat n'est pas un bénéfice comptable. Il ne tient
                  compte que du chiffre d'affaires, des commissions et des
                  dépenses enregistrées dans l'application. Pour le résultat
                  affiché, les dépenses sont ramenées à la période CA
                  sélectionnée.
                </p>
              </div>
            </div>
          </div>
        </BlocSection>
      </div>

      {/* Limites */}
      {Array.isArray(donnees.limites) && donnees.limites.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">
              Limites des prévisions
            </h2>
          </div>

          <ul className="mt-3 space-y-2">
            {donnees.limites.map((limite, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-xs leading-5 text-slate-500"
              >
                <span className="mt-1">•</span>
                <span>{limite}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        Prévisions statistiques · {station?.nom || "MAAX Business"} ·
        Actualisées à la demande
      </p>
    </div>
  );
}
