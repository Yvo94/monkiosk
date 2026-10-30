
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NouvelleOperationModal from "@/components/lavage/NouvelleOperationModal";
import {
  ArrowLeft,
  AlertCircle,
  CalendarDays,
  CarFront,
  Droplets,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

const montant = (value, devise = "FCFA") =>
  `${Number(value || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} ${devise}`;

function dateAbidjan() {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function debutMoisAbidjan() {
  return `${dateAbidjan().slice(0, 7)}-01`;
}

function CarteFinanciere({
  titre,
  valeur,
  detail,
  icon: Icon,
  couleur = "#14233B",
  fond = "bg-white",
}) {
  return (
    <article className={`rounded-2xl border border-slate-200 ${fond} p-4 shadow-sm sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 sm:text-sm">
            {titre}
          </p>
          <p
            className="mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl"
            style={{ color: couleur }}
          >
            {valeur}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {detail}
          </p>
        </div>

        <div className="shrink-0 rounded-xl bg-[#14233B]/5 p-3 text-[#14233B]">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

export default function VueFinancierePage() {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const [dateDebutTemp, setDateDebutTemp] = useState("");
  const [dateFinTemp, setDateFinTemp] = useState("");

  const [filtrePersonnalise, setFiltrePersonnalise] = useState(false);
  const [modalNouvelleOperation, setModalNouvelleOperation] =
    useState(false);

  useEffect(() => {
    const aujourdHui = dateAbidjan();
    setDateDebut(aujourdHui);
    setDateFin(aujourdHui);
    setDateDebutTemp(aujourdHui);
    setDateFinTemp(aujourdHui);
  }, []);

  const chargerDonnees = useCallback(async () => {
    if (!dateDebut || !dateFin) return;

    if (dateDebut > dateFin) {
      setErreur("La date de début doit précéder la date de fin.");
      return;
    }

    setChargement(true);
    setErreur("");

    try {
      const params = new URLSearchParams({
        date_debut: dateDebut,
        date_fin: dateFin,
      });

      const response = await fetch(
        `/api/lavage/dashboard?${params.toString()}`,
        { cache: "no-store" }
      );

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const resultat = await response.json();

      if (!response.ok) {
        throw new Error(
          resultat.error || "Impossible de charger les données financières."
        );
      }

      setDonnees(resultat);
    } catch (error) {
      console.error("[Vue financière] Erreur :", error);
      setErreur(
        error.message || "Une erreur est survenue lors du chargement."
      );
    } finally {
      setChargement(false);
    }
  }, [dateDebut, dateFin]);

  useEffect(() => {
    if (dateDebut && dateFin) {
      chargerDonnees();
    }
  }, [dateDebut, dateFin, chargerDonnees]);

  const appliquerPeriode = (type) => {
    const aujourdHui = dateAbidjan();

    if (type === "jour") {
      setDateDebut(aujourdHui);
      setDateFin(aujourdHui);
      setFiltrePersonnalise(false);
      return;
    }

    if (type === "mois") {
      setDateDebut(debutMoisAbidjan());
      setDateFin(aujourdHui);
      setFiltrePersonnalise(false);
    }
  };

  const appliquerPeriodePersonnalisee = () => {
    if (
      !dateDebutTemp ||
      !dateFinTemp ||
      dateDebutTemp > dateFinTemp ||
      dateFinTemp > dateAbidjan()
    ) {
      return;
    }

    setDateDebut(dateDebutTemp);
    setDateFin(dateFinTemp);
    setFiltrePersonnalise(false);
  };

  const statistiques = donnees?.statistiques || {};
  const station = donnees?.station;
  const devise = donnees?.devise || "FCFA";

  const chiffreAffaires = Number(
    statistiques.chiffreAffaires || 0
  );

  const commissions = Number(
    statistiques.commissionsTotales || 0
  );

  const depenses = Number(
    statistiques.totalDepensesPayees || 0
  );

  const beneficeNet = Number(
    statistiques.beneficeNet ??
      chiffreAffaires - commissions - depenses
  );

  const soldeCaisses = Number(
    statistiques.soldeCaisses || 0
  );

  const soldeCaissePrincipale = Number(
    statistiques.soldeCaissePrincipale || 0
  );

  const pourcentageCommissions =
    chiffreAffaires > 0
      ? (commissions / chiffreAffaires) * 100
      : 0;

  const libellePeriode =
    dateDebut === dateFin
      ? `Le ${new Date(`${dateDebut}T12:00:00`).toLocaleDateString("fr-FR")}`
      : `Du ${new Date(`${dateDebut}T12:00:00`).toLocaleDateString("fr-FR")} au ${new Date(`${dateFin}T12:00:00`).toLocaleDateString("fr-FR")}`;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-3 py-4 sm:space-y-7 sm:px-6 sm:py-7">

      {/* En-tête */}
      <header className="relative overflow-hidden rounded-3xl bg-[#14233B] p-5 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full border-[25px] border-white/[0.04]" />

        <div className="relative">
          <Link
            href="/dashboard/lavage"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 sm:text-sm"
          >
            <ArrowLeft size={16} />
            Retour au dashboard
          </Link>

          <div className="mt-6 flex items-center gap-2 text-xs font-semibold tracking-wider text-[#D8BD83]">
            <Droplets size={17} />
            MAAX BUSINESS · LAVAGE
          </div>

          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            Vue financière
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            {station?.nom || "Ma station"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Suivi des recettes, commissions, dépenses et trésorerie.
          </p>
        </div>
      </header>

      {/* Filtres */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-[#14233B]">
              Période financière
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {dateDebut && dateFin ? libellePeriode : "Sélection de la période"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => chargerDonnees()}
            disabled={chargement}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-[#14233B] hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={chargement ? "animate-spin" : ""}
            />
            Actualiser
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => appliquerPeriode("jour")}
            className="min-h-11 rounded-xl bg-[#14233B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#20385B]"
          >
            Aujourd'hui
          </button>

          <button
            type="button"
            onClick={() => appliquerPeriode("mois")}
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#14233B] hover:bg-slate-50"
          >
            Mois en cours
          </button>

          <button
            type="button"
            onClick={() => {
              setDateDebutTemp(dateDebut);
              setDateFinTemp(dateFin);
              setFiltrePersonnalise((ouvert) => !ouvert);
            }}
            className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D8BD83] bg-[#D8BD83]/10 px-4 py-2 text-xs font-semibold text-[#14233B] sm:col-span-1"
          >
            <CalendarDays size={15} />
            Période personnalisée
          </button>
        </div>

        {filtrePersonnalise && (
          <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Du
              </span>
              <input
                type="date"
                value={dateDebutTemp}
                max={dateAbidjan()}
                onChange={(event) => setDateDebutTemp(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Au
              </span>
              <input
                type="date"
                value={dateFinTemp}
                min={dateDebutTemp || undefined}
                max={dateAbidjan()}
                onChange={(event) => setDateFinTemp(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </label>

            <button
              type="button"
              onClick={appliquerPeriodePersonnalisee}
              disabled={
                !dateDebutTemp ||
                !dateFinTemp ||
                dateDebutTemp > dateFinTemp ||
                dateFinTemp > dateAbidjan()
              }
              className="min-h-11 rounded-lg bg-[#14233B] px-5 text-xs font-semibold text-white hover:bg-[#20385B] disabled:opacity-40"
            >
              Appliquer
            </button>
          </div>
        )}
      </section>

      {/* Erreur */}
      {erreur && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Chargement impossible
            </p>
            <p className="mt-1 text-xs leading-5">{erreur}</p>
            <button
              type="button"
              onClick={chargerDonnees}
              className="mt-2 text-xs font-semibold underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Indicateur principal */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-bold text-[#14233B]">
            Synthèse financière
          </h2>
          {chargement && (
            <span className="text-xs text-slate-400">
              Actualisation...
            </span>
          )}
        </div>

        <div className="rounded-3xl bg-[#14233B] p-5 text-white shadow-lg sm:p-7">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <TrendingUp size={18} className="text-[#D8BD83]" />
            Chiffre d'affaires
          </div>

          <p className="mt-3 break-words text-3xl font-bold tracking-tight text-[#D8BD83] sm:text-4xl">
            {montant(chiffreAffaires, devise)}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Recettes des prestations terminées · {libellePeriode}
          </p>
        </div>
      </section>

      {/* Commissions et dépenses */}
      <section>
        <h2 className="mb-3 font-bold text-[#14233B]">
          Charges et commissions
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CarteFinanciere
            titre="Commissions des laveurs"
            valeur={montant(commissions, devise)}
            detail={`${pourcentageCommissions.toLocaleString("fr-FR", {
              maximumFractionDigits: 1,
            })} % du chiffre d'affaires`}
            icon={Receipt}
            couleur="#B45309"
          />

          <CarteFinanciere
            titre="Dépenses payées"
            valeur={montant(depenses, devise)}
            detail="Dépenses réglées enregistrées sur la période"
            icon={Wallet}
            couleur="#B45309"
          />
        </div>
      </section>

      {/* Résultat */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-[#14233B]" />
          <h2 className="font-bold text-[#14233B]">
            Résultat estimé
          </h2>
        </div>

        <p
          className={`mt-4 break-words text-3xl font-bold tracking-tight sm:text-4xl ${
            beneficeNet < 0 ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {montant(beneficeNet, devise)}
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Chiffre d'affaires − commissions des laveurs − dépenses payées.
          Ce résultat est indicatif et ne tient pas compte d'éventuelles
          charges non intégrées dans les données.
        </p>

        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Chiffre d'affaires</span>
            <strong className="text-[#14233B]">
              {montant(chiffreAffaires, devise)}
            </strong>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Commissions</span>
            <strong className="text-amber-700">
              − {montant(commissions, devise)}
            </strong>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Dépenses payées</span>
            <strong className="text-amber-700">
              − {montant(depenses, devise)}
            </strong>
          </div>
        </div>
      </section>

      {/* Trésorerie */}
      <section>
        <h2 className="mb-3 font-bold text-[#14233B]">
          Trésorerie de la station
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CarteFinanciere
            titre="Solde total des caisses"
            valeur={montant(soldeCaisses, devise)}
            detail="Solde disponible dans les caisses de la station"
            icon={Wallet}
            couleur="#166534"
          />

          <CarteFinanciere
            titre="Caisse PRINCIPALE"
            valeur={montant(soldeCaissePrincipale, devise)}
            detail="Solde disponible dans la caisse principale"
            icon={Wallet}
            couleur="#166534"
          />
        </div>
      </section>

      {/* Informations complémentaires */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-500">
            <CarFront size={17} />
            <span className="text-xs">Prestations terminées</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#14233B]">
            {Number(
              statistiques.prestationsTerminees || 0
            ).toLocaleString("fr-FR")}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Wallet size={17} />
            <span className="text-xs">Caisses actives</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#14233B]">
            {Number(statistiques.caissesActives || 0).toLocaleString("fr-FR")}
          </p>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link
          href="/dashboard/lavage"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-[#14233B] hover:bg-slate-50"
        >
          <ArrowLeft size={17} />
          Retour au dashboard
        </Link>

        <button
          type="button"
          onClick={() => setModalNouvelleOperation(true)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-5 py-3 text-sm font-bold text-[#14233B] shadow-sm transition hover:bg-[#e6ce98]"
        >
          <Plus size={19} />
          Nouvelle opération
        </button>
      </div>

      <p className="pb-3 text-[11px] leading-5 text-slate-400">
        Les données affichées proviennent des enregistrements de la station.
        Le solde des caisses est distinct du résultat financier de la période.
      </p>

      <NouvelleOperationModal
        open={modalNouvelleOperation}
        onClose={() => setModalNouvelleOperation(false)}
        onSuccess={() => {
          setModalNouvelleOperation(false);
          chargerDonnees();
        }}
      />
    </main>
  );
}
