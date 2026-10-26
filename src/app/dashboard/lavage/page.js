"use client";

import { useCallback, useEffect, useState } from "react";
import NouvelleOperationModal from "@/components/lavage/NouvelleOperationModal";
import Link from "next/link";
import {
  CarFront,
  ClipboardList,
  Settings,
  Users,
  ArrowRight,
  Droplets,
  Wallet,
  TrendingUp,
  Receipt,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

const rubriques = [
  {
    titre: "Prestations",
    description: "Consulter les opérations effectuées.",
    href: "/dashboard/lavage/services",
    icon: ClipboardList,
  },
  {
    titre: "Dépenses",
    description: "Suivre les charges et les sorties d'argent.",
    href: "/dashboard/lavage/depense",
    icon: Wallet,
  },
  {
    titre: "Véhicules",
    description: "Consulter les véhicules et leur historique.",
    href: "/dashboard/lavage/vehicules",
    icon: CarFront,
  },
  {
    titre: "Équipe",
    description: "Gérer les laveurs et l'équipe.",
    href: "/dashboard/lavage/equipe",
    icon: Users,
  },
  {
    titre: "Paramètres",
    description: "Configurer la station et ses caisses.",
    href: "/dashboard/lavage/parametres",
    icon: Settings,
  },
];

const montant = (value, devise = "FCFA") =>
  `${Number(value || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} ${devise}`;

const dateHeure = (value) => {
  if (!value) return "Date non disponible";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date non disponible";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Abidjan",
  }).format(date);
};

function Indicateur({
  titre,
  valeur,
  detail,
  icon: Icon,
  couleurValeur,
  compact = false,
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-medium leading-5 text-slate-500 sm:text-sm">
          {titre}
        </p>

        <div className="shrink-0 rounded-xl bg-[#14233B]/5 p-2 text-[#14233B] sm:p-3">
          <Icon size={compact ? 18 : 21} />
        </div>
      </div>

      <p
        className={`mt-3 break-words font-bold leading-tight tracking-tight ${
          compact
            ? "text-lg sm:text-2xl"
            : "text-xl sm:text-2xl"
        }`}
        style={{ color: couleurValeur || "#14233B" }}
      >
        {valeur}
      </p>

      <p className="mt-2 text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5">
        {detail}
      </p>
    </article>
  );
}

function SectionTitre({ titre, description, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-[#14233B] sm:text-xl">
          {titre}
        </h2>

        {description && (
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

export default function LavageDashboardPage() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  const [donneesPrevisions, setDonneesPrevisions] = useState(null);
  const [chargementPrevisions, setChargementPrevisions] = useState(false);
  const [erreurPrevisions, setErreurPrevisions] = useState("");

  const [modalNouvelleOperation, setModalNouvelleOperation] = useState(false);
  const [menuRapideOuvert, setMenuRapideOuvert] = useState(false);

  function aujourdHuiAbidjan(date = new Date()) {
    return new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Africa/Abidjan",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  
    
  const [filtreOuvert, setFiltreOuvert] = useState(false);

  const [dateDebut, setDateDebut] = useState();
  const [dateFin, setDateFin] = useState();

  const [dateDebutTemp, setDateDebutTemp] = useState();
  const [dateFinTemp, setDateFinTemp] = useState();

  useEffect(() => {
    const date = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Africa/Abidjan",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    //setToday(date);
    setDateDebut(date);
    setDateFin(date);
    setDateDebutTemp(date);
    setDateFinTemp(date);
  }, []);


  const chargerDashboard = useCallback(
    async ({
      silencieux = false,
      debut = dateDebut,
      fin = dateFin,
    } = {}) => {
      if (!silencieux) setChargement(true);
      setErreur("");
      

      if (!debut || !fin) {
        console.warn("[Dashboard Lavage] Chargement ignoré : dates non initialisées.");
        return;
      }

      const formatDateValide = /^\d{4}-\d{2}-\d{2}$/;

      if (!formatDateValide.test(debut) || !formatDateValide.test(fin)) {
        console.error("[Dashboard Lavage] Format de date invalide :", {
          debut,
          fin,
        });
        setErreur("Les dates sélectionnées sont invalides.");
        setChargement(false);
        return;
      }

      if (debut > fin) {
        setErreur("La date de début doit être antérieure ou égale à la date de fin.");
        setChargement(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          date_debut: debut,
          date_fin: fin,
        });

        const response = await fetch(
          `/api/lavage/dashboard?${params.toString()}`,
          { cache: "no-store" }
        );

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Impossible de charger le dashboard."
          );
        }

        setDonnees(result);
      } catch (error) {
        console.error("[Dashboard Lavage] Erreur de chargement :", error);
        setErreur(error.message || "Une erreur est survenue.");
      } finally {
        setChargement(false);
      }
    },
    [dateDebut, dateFin]
  );

  useEffect(() => {
    if (!dateDebut || !dateFin) return;

    chargerDashboard({
      debut: dateDebut,
      fin: dateFin,
    });
  }, [dateDebut, dateFin, chargerDashboard]);


  // Chargement des prévisions de la station active.
  useEffect(() => {
    const stationId = donnees?.station?.id;

    if (!stationId) {
      setDonneesPrevisions(null);
      return;
    }

    let annule = false;

    async function chargerPrevisions() {
      setChargementPrevisions(true);
      setErreurPrevisions("");

      try {
        const params = new URLSearchParams({
          lavage_id: stationId,
        });

        const response = await fetch(
          `/api/lavage/previsions?${params.toString()}`,
          { cache: "no-store" }
        );

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        const resultat = await response.json();

        if (!response.ok) {
          throw new Error(
            resultat.error || "Impossible de charger les prévisions."
          );
        }

        if (!annule) {
          setDonneesPrevisions(resultat);
        }
      } catch (error) {
        console.error(
          "[Dashboard Lavage] Erreur prévisions :",
          error
        );

        if (!annule) {
          setErreurPrevisions(
            error.message || "Erreur lors du chargement des prévisions."
          );
        }
      } finally {
        if (!annule) {
          setChargementPrevisions(false);
        }
      }
    }

    chargerPrevisions();

    return () => {
      annule = true;
    };
  }, [donnees?.station?.id]);


  if (chargement && !donnees) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-5 text-center text-slate-500">
        <div className="rounded-2xl bg-[#14233B]/5 p-4">
          <RefreshCw size={24} className="animate-spin text-[#14233B]" />
        </div>
        <p className="text-sm font-medium">
          Chargement des statistiques du lavage...
        </p>
      </div>
    );
  }

  if (erreur && !donnees) {
    return (
      <div className="mx-3 my-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 sm:m-5 sm:p-5">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle size={20} className="shrink-0" />
          <span>Impossible de charger le dashboard</span>
        </div>

        <p className="mt-2 break-words text-sm">{erreur}</p>

        <button
          type="button"
          onClick={() => chargerDashboard()}
          className="mt-4 min-h-11 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!donnees) return null;

  const {
    station,
    statistiques = {},
    evolution = [],
    derniersServices = [],
    devise = "FCFA",
  } = donnees;

  const totalDepensesPayees = Number(
    statistiques.totalDepensesPayees ?? 0
  );

  const totalCommissionsLaveurs = Number(
    statistiques.commissionsTotales ?? 0
  );

  const beneficeNet = Number(
    statistiques.beneficeNet ??
      (
        Number(statistiques.chiffreAffaires ?? 0) -
        totalCommissionsLaveurs -
        totalDepensesPayees
      )
  );

  const maxEvolution = Math.max(
    1,
    ...evolution.map((jour) => Number(jour.montant || 0))
  );

  const previsions = donneesPrevisions?.previsions || [];

  const totalPrevu = Number(
    donneesPrevisions?.statistiques?.totalPrevu7Jours || 0
  );

  const fiabilitePrevisions =
    donneesPrevisions?.statistiques?.fiabilite || "faible";

  const maxPrevision = Math.max(
    1,
    ...previsions.map((jour) => Number(jour.montantPrevu || 0))
  );

  const formatterDatePrevision = (date) => {
    const valeur = new Date(`${date}T12:00:00Z`);

    if (Number.isNaN(valeur.getTime())) return date;

    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "Africa/Abidjan",
    }).format(valeur);
  };

  const libelleFiabilite = {
    faible: "Faible",
    moyenne: "Moyenne",
    bonne: "Bonne",
  }[fiabilitePrevisions] || "Faible";

  const couleurFiabilite = {
    faible: "bg-amber-100 text-amber-800",
    moyenne: "bg-blue-100 text-blue-800",
    bonne: "bg-emerald-100 text-emerald-800",
  }[fiabilitePrevisions] || "bg-amber-100 text-amber-800";

  const formatterJour = (date) => {
    const valeur = new Date(`${date}T12:00:00Z`);

    if (Number.isNaN(valeur.getTime())) return "--";

    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "2-digit",
      timeZone: "Africa/Abidjan",
    }).format(valeur);
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 overflow-x-clip px-3 py-4 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">
      {/* En-tête */}
      <section className="relative overflow-hidden rounded-3xl bg-[#14233B] p-4 text-white shadow-lg sm:p-6 md:p-9">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border-[25px] border-white/[0.04] sm:h-56 sm:w-56" />
        <div className="pointer-events-none absolute -bottom-16 right-20 h-36 w-36 rounded-full bg-[#D8BD83]/[0.07] blur-2xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-[#D8BD83] sm:text-xs">
              <Droplets size={17} />
              <span>MAAX BUSINESS · LAVAGE</span>
            </div>

            <h1 className="break-words text-2xl font-bold leading-tight sm:text-3xl">
              {station?.nom || "Ma station"}
            </h1>

            <p className="mt-2 max-w-xl text-xs leading-5 text-slate-300 sm:mt-3 sm:text-sm sm:leading-6">
              Suivez votre activité, vos recettes et vos opérations en un
              coup d’œil.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-200">
                Devise : {devise}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setModalNouvelleOperation(true)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-4 py-3 text-sm font-bold text-[#14233B] shadow-sm transition hover:bg-[#e6ce98] active:scale-[0.99] sm:px-5"
            >
              <CarFront size={19} />
              Nouvelle opération
            </button>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => chargerDashboard()}
                disabled={chargement}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-medium transition hover:bg-white/10 disabled:opacity-60 sm:px-4 sm:text-sm"
              >
                <RefreshCw
                  size={16}
                  className={chargement ? "animate-spin" : ""}
                />
                Actualiser
              </button>

              <button
                type="button"
                onClick={() => setMenuRapideOuvert((ouvert) => !ouvert)}
                aria-expanded={menuRapideOuvert}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-medium hover:bg-white/10 sm:hidden"
              >
                {menuRapideOuvert ? <X size={17} /> : <Menu size={17} />}
                Rubriques
              </button>
            </div>
            <div className="flex justify-start sm:col-span-2">
              <button
                type="button"
                onClick={() => {
                  setDateDebutTemp(dateDebut);
                  setDateFinTemp(dateFin);
                  setFiltreOuvert(true);
                }}
                className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
              >
                <CalendarDays size={15} />
                Filtrer par période
              </button>
            </div>
          </div>
        </div>

        {menuRapideOuvert && (
          <nav className="relative mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:hidden">
            {rubriques.map((rubrique) => {
              const Icon = rubrique.icon;

              return (
                <Link
                  key={rubrique.href}
                  href={rubrique.href}
                  onClick={() => setMenuRapideOuvert(false)}
                  className="flex min-h-12 items-center gap-2 rounded-xl bg-white/[0.07] p-3 text-xs font-medium text-white transition active:bg-white/15"
                >
                  <Icon size={17} className="shrink-0 text-[#D8BD83]" />
                  <span className="min-w-0 flex-1">{rubrique.titre}</span>
                  <ChevronRight size={15} className="shrink-0 text-slate-400" />
                </Link>
              );
            })}
          </nav>
        )}
      </section>

      {erreur && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 sm:text-sm">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <p>
            Actualisation impossible. Les données affichées peuvent ne pas
            être à jour.
          </p>
          <button
            type="button"
            onClick={() => chargerDashboard()}
            className="ml-auto shrink-0 font-semibold underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Indicateurs du jour */}
      <section>
        <SectionTitre
          titre={
            dateDebut === dateFin
              ? dateDebut === aujourdHuiAbidjan()
                ? "Activité du jour"
                : `Activité du ${new Date(`${dateDebut}T12:00:00`).toLocaleDateString("fr-FR")}`
              : "Activité sur la période"
          }
          description={
            dateDebut === dateFin
              ? "Les chiffres clés de votre station."
              : `Du ${new Date(`${dateDebut}T12:00:00`).toLocaleDateString("fr-FR")} au ${new Date(`${dateFin}T12:00:00`).toLocaleDateString("fr-FR")}.`
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Indicateur
            compact
            titre="Chiffre d’affaires"
            valeur={montant(statistiques.chiffreAffaires, devise)}
            detail="Lavages terminés aujourd’hui"
            icon={TrendingUp}
          />

          <Indicateur
            compact
            titre="Lavages terminés"
            valeur={Number(statistiques.prestationsTerminees || 0).toLocaleString("fr-FR")}
            detail="Services enregistrés aujourd’hui"
            icon={CarFront}
          />

          <Indicateur
            compact
            titre="Commissions laveurs"
            valeur={montant(totalCommissionsLaveurs, devise)}
            detail="Commissions générées aujourd’hui"
            icon={Receipt}
          />

          <Indicateur
            compact
            titre="Bénéfice net"
            valeur={montant(beneficeNet, devise)}
            detail="Recettes − commissions − dépenses payées"
            icon={Wallet}
            couleurValeur={beneficeNet < 0 ? "#B91C1C" : "#166534"}
          />

          <Indicateur
            compact
            titre="Dépenses payées"
            valeur={montant(totalDepensesPayees, devise)}
            detail="Dépenses réglées aujourd’hui"
            icon={Wallet}
            couleurValeur="#B45309"
          />
          <Indicateur
            compact
            titre="Solde caisse PRINCIPALE"
            valeur={montant(
              statistiques.soldeCaissePrincipale,
              devise
            )}
            detail="Solde disponible actuellement"
            icon={Wallet}
            couleurValeur="#166534"
          />
        </div>
      </section>

      {/* Graphique et état */}
      <section className="grid min-w-0 gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#14233B]/5 p-2.5 text-[#14233B]">
              <TrendingUp size={20} />
            </div>

            <div className="min-w-0">
              <h2 className="font-bold text-[#14233B]">
                Évolution sur 7 jours
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                Chiffre d’affaires quotidien.
              </p>
            </div>
          </div>

          {evolution.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-center text-sm text-slate-400">
              Aucune donnée disponible pour cette période.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-3">
              {evolution.map((jour) => {
                const valeur = Number(jour.montant || 0);
                const hauteur =
                  valeur === 0
                    ? 4
                    : Math.max(8, (valeur / maxEvolution) * 100);

                return (
                  <div
                    key={jour.date}
                    className="flex min-w-0 flex-col items-center"
                    title={`${jour.date} : ${montant(valeur, devise)}`}
                  >
                    <span className="mb-2 h-8 w-full overflow-hidden text-center text-[9px] leading-4 text-slate-500 sm:text-[11px]">
                      {valeur > 0
                        ? valeur.toLocaleString("fr-FR")
                        : "—"}
                    </span>

                    <div className="flex h-28 w-full items-end justify-center rounded-t-lg bg-slate-50 sm:h-36">
                      <div
                        className="w-full max-w-10 rounded-t-md bg-[#D8BD83] transition-all duration-500"
                        style={{ height: `${hauteur}%` }}
                      />
                    </div>

                    <span className="mt-2 text-center text-[9px] capitalize text-slate-500 sm:text-[11px]">
                      {formatterJour(jour.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#14233B]/5 p-2.5 text-[#14233B]">
              <Wallet size={20} />
            </div>
            <h2 className="font-bold text-[#14233B]">État de la station</h2>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="text-xs text-slate-500 sm:text-sm">
                Solde des caisses
              </span>
              <span className="text-right text-sm font-bold text-[#14233B]">
                {montant(statistiques.soldeCaisses, devise)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#D8BD83]/15 px-3 py-3">
              <div className="min-w-0">
                <span className="block text-xs font-semibold text-[#14233B] sm:text-sm">
                  Solde caisse PRINCIPALE
                </span>
                <span className="mt-1 block text-[10px] text-slate-500 sm:text-xs">
                  Solde disponible actuellement
                </span>
              </div>
              <span className="shrink-0 text-right text-sm font-bold text-[#166534] sm:text-base">
                {montant(statistiques.soldeCaissePrincipale, devise)}
              </span>
            </div>


            <div className="flex items-center justify-between gap-3 py-3">
              <span className="text-xs text-slate-500 sm:text-sm">
                Caisses actives
              </span>
              <span className="font-semibold text-[#14233B]">
                {statistiques.caissesActives ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 py-3">
              <span className="text-xs text-slate-500 sm:text-sm">
                Prestations actives
              </span>
              <span className="font-semibold text-[#14233B]">
                {statistiques.prestationsConfigurees ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 py-3">
              <span className="text-xs text-slate-500 sm:text-sm">
                Laveurs actifs
              </span>
              <span className="font-semibold text-[#14233B]">
                {statistiques.laveursActifs ?? 0}
              </span>
            </div>
          </div>

          <Link
            href="/dashboard/lavage/encaissements"
            className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[#14233B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#20385B] active:scale-[0.99]"
          >
            <span>Voir les encaissements</span>
            <ArrowRight size={17} className="shrink-0" />
          </Link>
        </div>
      </section>

      {/* Prévisions du chiffre d'affaires */}
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#D8BD83]/20 p-2.5 text-[#14233B]">
              <TrendingUp size={21} />
            </div>

            <div>
              <h2 className="font-bold text-[#14233B]">
                Prévisions du chiffre d’affaires
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                Estimation statistique des sept prochains jours complets.
              </p>
            </div>
          </div>

          {!chargementPrevisions && donneesPrevisions && (
            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${couleurFiabilite}`}
            >
              Fiabilité {libelleFiabilite.toLowerCase()}
            </span>
          )}
        </div>

        {chargementPrevisions && !donneesPrevisions ? (
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-slate-500">
            <RefreshCw size={18} className="animate-spin" />
            Calcul des prévisions...
          </div>
        ) : erreurPrevisions && !donneesPrevisions ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              {erreurPrevisions}
            </p>

            <button
              type="button"
              onClick={() => {
                setDonnees((precedentes) =>
                  precedentes ? { ...precedentes } : precedentes
                );
              }}
              className="mt-3 text-sm font-semibold text-amber-900 underline"
            >
              Réessayer
            </button>
          </div>
        ) : previsions.length === 0 ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            Aucune prévision disponible pour cette station.
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-2xl bg-[#14233B] p-4 text-white sm:p-5">
              <p className="text-xs font-medium text-slate-300 sm:text-sm">
                CA prévisionnel total sur 7 jours
              </p>

              <p className="mt-2 break-words text-2xl font-bold tracking-tight text-[#D8BD83] sm:text-3xl">
                {montant(totalPrevu, devise)}
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-300">
                Moyenne estimée :{" "}
                {montant(
                  Math.round(totalPrevu / previsions.length),
                  devise
                )}{" "}
                par jour.
              </p>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#14233B]">
                  CA estimé par jour
                </h3>

                <span className="text-[11px] text-slate-500">
                  {previsions.length} jours
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
                {previsions.map((jour) => {
                  const valeur = Number(jour.montantPrevu || 0);

                  const hauteur =
                    valeur === 0
                      ? 3
                      : Math.max(6, (valeur / maxPrevision) * 100);

                  return (
                    <div
                      key={jour.date}
                      className="flex min-w-0 flex-col items-center"
                      title={`${formatterDatePrevision(jour.date)} : ${montant(valeur, devise)}`}
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
                        {formatterDatePrevision(jour.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0 text-slate-500"
                />

                <p className="text-xs leading-5 text-slate-600">
                  Ces montants sont des estimations statistiques, pas des
                  recettes garanties. La fiabilité évoluera avec la quantité
                  et la qualité des données historiques enregistrées.
                </p>
              </div>
            </div>
          </>
        )}
      </section>


      {/* Derniers lavages */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="font-bold text-[#14233B]">Derniers lavages</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              Les cinq derniers services enregistrés.
            </p>
          </div>

          <div className="shrink-0 rounded-xl bg-[#14233B]/5 p-2.5 text-[#14233B]">
            <CalendarDays size={19} />
          </div>
        </div>

        {derniersServices.length === 0 ? (
          <div className="px-4 py-10 text-center sm:p-8">
            <CarFront size={30} className="mx-auto text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">
              Aucun lavage enregistré
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              Les prestations apparaîtront ici après leur enregistrement.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {derniersServices.map((service) => {
              const vehicule = service.lavage_vehicules;
              const laveur = service.lavage_laveurs;
              const termine = service.statut === "termine";

              return (
                <article
                  key={service.id}
                  className="flex min-w-0 items-start gap-3 p-4 transition hover:bg-slate-50/70 sm:items-center sm:px-5"
                >
                  <div className="mt-0.5 shrink-0 rounded-xl bg-[#14233B]/5 p-2.5 text-[#14233B] sm:mt-0">
                    <CarFront size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-[#14233B]">
                      {vehicule?.immatriculation || "Véhicule"}
                    </p>

                    {(vehicule?.marque || vehicule?.modele) && (
                      <p className="mt-0.5 break-words text-xs text-slate-600">
                        {[vehicule?.marque, vehicule?.modele]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    )}

                    <p className="mt-1 break-words text-[11px] leading-5 text-slate-500 sm:text-xs">
                      {dateHeure(service.date_service)}
                      {laveur?.nom ? ` · ${laveur.nom}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${
                        termine
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {termine ? "Terminé" : "Annulé"}
                    </span>

                    <span className="text-right text-xs font-bold text-[#14233B] sm:text-sm">
                      {montant(service.montant_total, devise)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="border-t border-slate-100 p-3 sm:px-5">
          <Link
            href="/dashboard/lavage/services"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#14233B] transition hover:bg-slate-50"
          >
            Voir toutes les prestations
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Gestion */}
      <section>
        <SectionTitre
          titre="Gestion de la station"
          description="Retrouvez rapidement les fonctionnalités du module."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {rubriques.map((rubrique) => {
            const Icon = rubrique.icon;

            return (
              <Link
                key={rubrique.href}
                href={rubrique.href}
                className="group flex min-h-[84px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#D8BD83] hover:shadow-md active:bg-slate-50 sm:min-h-0 sm:items-start sm:p-5"
              >
                <div className="shrink-0 rounded-xl bg-[#14233B]/5 p-3 text-[#14233B] transition group-hover:bg-[#D8BD83]/20">
                  <Icon size={21} />
                </div>

                <div className="min-w-0 flex-1 sm:pt-1">
                  <h3 className="text-sm font-semibold text-[#14233B]">
                    {rubrique.titre}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {rubrique.description}
                  </p>
                </div>

                <ArrowRight
                  size={17}
                  className="ml-auto shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#14233B] sm:mt-1"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <p className="px-1 pb-2 text-[11px] leading-5 text-slate-400 sm:text-xs">
        Les indicateurs sont calculés à partir des données enregistrées.
        Les recettes affichées ne remplacent pas le contrôle de caisse et
        le rapprochement des paiements.
      </p>

      {filtreOuvert && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFiltreOuvert(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-filtre-periode"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex rounded-lg bg-[#14233B]/5 p-2 text-[#14233B]">
                  <CalendarDays size={18} />
                </div>

                <h2
                  id="titre-filtre-periode"
                  className="text-base font-bold text-[#14233B]"
                >
                  Filtrer par période
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Choisis les dates à prendre en compte.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFiltreOuvert(false)}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Du
                </span>
                <input
                  type="date"
                  value={dateDebutTemp}
                  max={aujourdHuiAbidjan()}
                  onChange={(event) => setDateDebutTemp(event.target.value)}
                  className="block h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none transition focus:border-[#14233B] focus:ring-2 focus:ring-[#14233B]/10"
                />
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Au
                </span>
                <input
                  type="date"
                  value={dateFinTemp}
                  min={dateDebutTemp || undefined}
                  max={aujourdHuiAbidjan()}
                  onChange={(event) => setDateFinTemp(event.target.value)}
                  className="block h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none transition focus:border-[#14233B] focus:ring-2 focus:ring-[#14233B]/10"
                />
              </label>
            </div>

            {dateDebutTemp && dateFinTemp && dateDebutTemp > dateFinTemp && (
              <p className="mt-2 text-xs text-red-600">
                La date de début doit précéder la date de fin.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setFiltreOuvert(false)}
                className="min-h-9 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={
                  !dateDebutTemp ||
                  !dateFinTemp ||
                  dateDebutTemp > dateFinTemp ||
                  dateFinTemp > aujourdHuiAbidjan()
                }
                onClick={() => {
                  setDateDebut(dateDebutTemp);
                  setDateFin(dateFinTemp);
                  setFiltreOuvert(false);

                  chargerDashboard({
                    debut: dateDebutTemp,
                    fin: dateFinTemp,
                  });
                }}
                className="min-h-9 rounded-lg bg-[#14233B] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#20385B] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Appliquer
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Nouvelle opération */}
      <NouvelleOperationModal
        open={modalNouvelleOperation}
        onClose={() => setModalNouvelleOperation(false)}
        onSuccess={() => {
          setModalNouvelleOperation(false);
          chargerDashboard({ silencieux: true });
        }}
      />
    </main>
  );
}