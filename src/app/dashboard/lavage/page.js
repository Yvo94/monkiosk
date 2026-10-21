"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

const rubriques = [
  {
    titre: "Prestations",
    description: "Consulter toutes les opérations effectuées.",
    href: "/dashboard/lavage/services",
    icon: ClipboardList,
  },
  {
    titre: "Véhicules",
    description: "Consulter les véhicules et leur historique.",
    href: "/dashboard/lavage/vehicules",
    icon: CarFront,
  },
  /*
  {
    titre: "Encaissements",
    description: "Suivre les paiements et les recettes.",
    href: "/dashboard/lavage/encaissements",
    icon: CreditCard,
  },
  */
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

const dateHeure = (value) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Abidjan",
  }).format(new Date(value));

function Indicateur({ titre, valeur, detail, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{titre}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#14233B]">
            {valeur}
          </p>
        </div>

        <div className="rounded-xl bg-[#14233B]/5 p-3 text-[#14233B]">
          <Icon size={22} />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export default function LavageDashboardPage() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modalNouvelleOperation, setModalNouvelleOperation] = useState(false);

  async function chargerDashboard() {
    setChargement(true);
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
  }

  useEffect(() => {
    chargerDashboard();
  }, []);

  if (chargement && !donnees) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-slate-500">
        <RefreshCw size={19} className="animate-spin" />
        <p className="text-sm">
          Chargement des statistiques du lavage...
        </p>
      </div>
    );
  }

  if (erreur && !donnees) {
    return (
      <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle size={20} />
          Impossible de charger le dashboard
        </div>

        <p className="mt-2 text-sm">{erreur}</p>

        <button
          type="button"
          onClick={chargerDashboard}
          className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!donnees) return null;

  const {
    station,
    statistiques,
    evolution,
    derniersServices,
    devise,
  } = donnees;

  const totalCommissionsLaveurs = Number(
    statistiques?.commissionsTotales || 0
  );

  const maxEvolution = Math.max(
    1,
    ...(evolution || []).map((jour) => Number(jour.montant || 0))
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-5 md:p-8">
      {/* En-tête de la station */}
      <section className="overflow-hidden rounded-3xl bg-[#14233B] p-6 text-white shadow-lg md:p-9">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-[#D8BD83]">
              <Droplets size={18} />
              <span>MAAX BUSINESS · ESPACE LAVAGE</span>
            </div>

            <h1 className="text-2xl font-bold md:text-3xl">
              {station.nom}
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Vue d’ensemble de votre activité, des lavages terminés,
              des recettes et de la caisse.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs text-slate-300">Devise</p>
              <p className="mt-1 text-xl font-semibold text-[#D8BD83]">
                {devise}
              </p>
            </div>

            {/* Ouverture de la fenêtre Nouvelle opération */}
            <button
              type="button"
              onClick={() => setModalNouvelleOperation(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-5 py-3 text-sm font-bold text-[#14233B] transition hover:bg-[#e6ce98]"
            >
              <CarFront size={18} />
              Nouvelle opération
            </button>

            <button
              type="button"
              onClick={chargerDashboard}
              disabled={chargement}
              title="Actualiser les statistiques"
              className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={chargement ? "animate-spin" : ""}
              />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      {erreur && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Actualisation impossible : les dernières données affichées peuvent
          ne pas être à jour.
        </div>
      )}

      {/* Activité du jour */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-[#14233B]">
            Activité du jour
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Indicateurs calculés à partir des lavages et paiements enregistrés.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicateur
            titre="Chiffre d’affaires"
            valeur={montant(statistiques.chiffreAffaires, devise)}
            detail="Total des lavages terminés aujourd’hui"
            icon={TrendingUp}
          />

          <Indicateur
            titre="Lavages terminés"
            valeur={statistiques.prestationsTerminees}
            detail="Services enregistrés aujourd’hui"
            icon={CarFront}
          />

          <Indicateur
            titre="Commissions laveurs du jour"
            valeur={montant(totalCommissionsLaveurs, devise)}
            detail="Commissions générées par les lavages terminés aujourd’hui"
            icon={Wallet}
          />

          <Indicateur
            titre="Panier moyen"
            valeur={montant(statistiques.panierMoyen, devise)}
            detail="Chiffre d’affaires ÷ lavages terminés"
            icon={Receipt}
          />
        </div>
      </section>

      {/* Évolution et état de la station */}
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-[#14233B]" />
            <h2 className="font-bold text-[#14233B]">
              Évolution sur 7 jours
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Chiffre d’affaires des lavages terminés par jour.
          </p>

          <div className="mt-6 flex h-48 items-end gap-3">
            {(evolution || []).map((jour) => {
              const hauteur =
                Number(jour.montant || 0) === 0
                  ? 4
                  : Math.max(
                      8,
                      (Number(jour.montant) / maxEvolution) * 100
                    );

              return (
                <div
                  key={jour.date}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  title={`${jour.date} : ${montant(jour.montant, devise)}`}
                >
                  <span className="w-full truncate text-center text-[10px] text-slate-500">
                    {Number(jour.montant || 0) > 0
                      ? Number(jour.montant).toLocaleString("fr-FR")
                      : "—"}
                  </span>

                  <div className="flex h-28 w-full items-end">
                    <div
                      className="w-full rounded-t-lg bg-[#D8BD83] transition-all"
                      style={{ height: `${hauteur}%` }}
                    />
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "Africa/Abidjan",
                    }).format(new Date(`${jour.date}T12:00:00Z`))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[#14233B]">
            État de la station
          </h2>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">
                Solde des caisses
              </span>
              <span className="text-right font-semibold text-[#14233B]">
                {montant(statistiques.soldeCaisses, devise)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Caisses actives
              </span>
              <span className="font-semibold">
                {statistiques.caissesActives}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Prestations actives
              </span>
              <span className="font-semibold">
                {statistiques.prestationsConfigurees}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Laveurs actifs
              </span>
              <span className="font-semibold">
                {statistiques.laveursActifs}
              </span>
            </div>

            <Link
              href="/dashboard/lavage/encaissements"
              className="flex items-center justify-between rounded-xl bg-[#14233B] px-4 py-3 text-sm font-semibold text-white hover:bg-[#20385B]"
            >
              Consulter les encaissements
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* Derniers lavages */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-bold text-[#14233B]">
              Derniers lavages
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Les cinq derniers services enregistrés.
            </p>
          </div>

          <CalendarDays size={21} className="text-slate-400" />
        </div>

        {derniersServices.length === 0 ? (
          <div className="p-8 text-center">
            <CarFront size={30} className="mx-auto text-slate-300" />

            <p className="mt-3 font-medium text-slate-700">
              Aucun lavage enregistré
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Les prestations apparaîtront ici après leur enregistrement.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {derniersServices.map((service) => {
              const vehicule = service.lavage_vehicules;
              const laveur = service.lavage_laveurs;

              return (
                <div
                  key={service.id}
                  className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:px-5"
                >
                  <div>
                    <p className="font-semibold text-[#14233B]">
                      {vehicule?.immatriculation || "Véhicule"}
                      {vehicule?.marque ? ` · ${vehicule.marque}` : ""}
                      {vehicule?.modele ? ` ${vehicule.modele}` : ""}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {dateHeure(service.date_service)}
                      {laveur?.nom ? ` · Laveur : ${laveur.nom}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        service.statut === "termine"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {service.statut === "termine"
                        ? "Terminé"
                        : "Annulé"}
                    </span>

                    <span className="font-bold text-[#14233B]">
                      {montant(service.montant_total, devise)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Gestion de la station */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-[#14233B]">
            Gestion de la station
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Accédez aux différentes rubriques du module Lavage.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rubriques.map((rubrique) => {
            const Icon = rubrique.icon;

            return (
              <Link
                key={rubrique.href}
                href={rubrique.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D8BD83] hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-[#14233B]/5 p-3 text-[#14233B]">
                    <Icon size={23} />
                  </div>

                  <ArrowRight
                    size={19}
                    className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#14233B]"
                  />
                </div>

                <h3 className="mt-5 font-semibold text-[#14233B]">
                  {rubrique.titre}
                </h3>

                <p className="mt-2 text-sm leading-5 text-slate-500">
                  {rubrique.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-400">
        Les indicateurs sont calculés à partir des données enregistrées.
        Les recettes affichées ne remplacent pas le contrôle de caisse et
        le rapprochement des paiements.
      </p>

      {/* Fenêtre Nouvelle opération */}
      <NouvelleOperationModal
        open={modalNouvelleOperation}
        onClose={() => setModalNouvelleOperation(false)}
        onSuccess={() => {
          setModalNouvelleOperation(false);
          chargerDashboard();
        }}
      />
    </div>
  );
}