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
  const [modalNouvelleOperation, setModalNouvelleOperation] =
    useState(false);
  const [menuRapideOuvert, setMenuRapideOuvert] = useState(false);

  const chargerDashboard = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setChargement(true);
    setErreur("");

    try {
      const response = await fetch("/api/lavage/dashboard", {
        cache: "no-store",
      });

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
      setErreur(error.message || "Une erreur est survenue.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerDashboard();
  }, [chargerDashboard]);

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

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center md:justify-end">
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
          titre="Activité du jour"
          description="Les chiffres clés de votre station."
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