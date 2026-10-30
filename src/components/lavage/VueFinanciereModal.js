"use client";

import { useEffect, useState } from "react";
import {
  X,
  CalendarDays,
  TrendingUp,
  Receipt,
  Wallet,
  PiggyBank,
  Banknote,
  CarFront,
  Plus,
  RefreshCw,
} from "lucide-react";

const obtenirDateAbidjan = (date = new Date()) =>
  new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const debutMoisAbidjan = () => {
  const aujourdHui = obtenirDateAbidjan();
  return `${aujourdHui.slice(0, 7)}-01`;
};

const montant = (valeur, devise = "FCFA") =>
  `${Number(valeur || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} ${devise}`;

function CarteFinanciere({
  titre,
  valeur,
  detail,
  icon: Icon,
  couleur = "text-[#14233B]",
  fond = "bg-[#14233B]/5",
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 sm:text-sm">
            {titre}
          </p>

          <p className={`mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl ${couleur}`}>
            {valeur}
          </p>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${fond} ${couleur}`}>
          <Icon size={21} />
        </div>
      </div>

      {detail && (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {detail}
        </p>
      )}
    </article>
  );
}

export default function VueFinanciereModal({
  open,
  onClose,
  station,
  statistiques = {},
  devise = "FCFA",
  dateDebut,
  dateFin,
  onApplyPeriod,
  onNouvelleOperation,
  chargement = false,
}) {
  const [modePeriode, setModePeriode] = useState("aujourd-hui");
  const [debutTemp, setDebutTemp] = useState("");
  const [finTemp, setFinTemp] = useState("");

  useEffect(() => {
    if (!open) return;

    const aujourdHui = obtenirDateAbidjan();

    if (dateDebut === aujourdHui && dateFin === aujourdHui) {
      setModePeriode("aujourd-hui");
    } else if (
      dateDebut === debutMoisAbidjan() &&
      dateFin === aujourdHui
    ) {
      setModePeriode("mois");
    } else {
      setModePeriode("personnalisee");
    }

    setDebutTemp(dateDebut || aujourdHui);
    setFinTemp(dateFin || aujourdHui);
  }, [open, dateDebut, dateFin]);

  useEffect(() => {
    if (!open) return;

    const fermerAvecEchap = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", fermerAvecEchap);

    return () => {
      window.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [open, onClose]);

  if (!open) return null;

  const aujourdHui = obtenirDateAbidjan();

  const chiffreAffaires = Number(statistiques.chiffreAffaires || 0);
  const commissions = Number(statistiques.commissionsTotales || 0);
  const depenses = Number(statistiques.totalDepensesPayees || 0);

  const benefice = Number(
    statistiques.beneficeNet ??
      chiffreAffaires - commissions - depenses
  );

  const soldeCaisses = Number(statistiques.soldeCaisses || 0);
  const soldeCaissePrincipale = Number(
    statistiques.soldeCaissePrincipale || 0
  );

  const pourcentageCommissions =
    chiffreAffaires > 0
      ? (commissions / chiffreAffaires) * 100
      : 0;

  const appliquerPeriode = (mode) => {
    const aujourdHui = obtenirDateAbidjan();

    let debut = aujourdHui;
    let fin = aujourdHui;

    if (mode === "mois") {
      debut = debutMoisAbidjan();
    }

    if (mode === "personnalisee") {
      debut = debutTemp;
      fin = finTemp;

      if (!debut || !fin || debut > fin || fin > aujourdHui) {
        return;
      }
    }

    setModePeriode(mode);
    onApplyPeriod(debut, fin);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-vue-financiere"
        className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl"
      >
        {/* En-tête */}
        <header className="relative shrink-0 overflow-hidden bg-[#14233B] px-5 py-5 text-white sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border-[25px] border-white/[0.04]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-[#D8BD83] sm:text-xs">
                <TrendingUp size={16} />
                MAAX BUSINESS · SYNTHÈSE FINANCIÈRE
              </div>

              <h2
                id="titre-vue-financiere"
                className="break-words text-xl font-bold sm:text-2xl"
              >
                {station?.nom || "Ma station"}
              </h2>

              <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                Vue d'ensemble de votre situation financière
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la vue financière"
              className="shrink-0 rounded-xl border border-white/15 bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>

          {/* Filtres */}
          <div className="relative mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => appliquerPeriode("aujourd-hui")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                modePeriode === "aujourd-hui"
                  ? "bg-[#D8BD83] text-[#14233B]"
                  : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Aujourd'hui
            </button>

            <button
              type="button"
              onClick={() => appliquerPeriode("mois")}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                modePeriode === "mois"
                  ? "bg-[#D8BD83] text-[#14233B]"
                  : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Mois en cours
            </button>

            <button
              type="button"
              onClick={() => setModePeriode("personnalisee")}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                modePeriode === "personnalisee"
                  ? "bg-[#D8BD83] text-[#14233B]"
                  : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              <CalendarDays size={14} />
              Période personnalisée
            </button>
          </div>

          {modePeriode === "personnalisee" && (
            <div className="relative mt-3 flex flex-col gap-2 rounded-xl border border-white/15 bg-white/[0.07] p-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px] text-slate-300">
                  Du
                </span>
                <input
                  type="date"
                  value={debutTemp}
                  max={aujourdHui}
                  onChange={(event) => setDebutTemp(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/20 bg-white px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#D8BD83]"
                />
              </label>

              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-[11px] text-slate-300">
                  Au
                </span>
                <input
                  type="date"
                  value={finTemp}
                  min={debutTemp || undefined}
                  max={aujourdHui}
                  onChange={(event) => setFinTemp(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/20 bg-white px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#D8BD83]"
                />
              </label>

              <button
                type="button"
                disabled={
                  !debutTemp ||
                  !finTemp ||
                  debutTemp > finTemp ||
                  finTemp > aujourdHui
                }
                onClick={() => appliquerPeriode("personnalisee")}
                className="h-10 rounded-lg bg-[#D8BD83] px-4 text-xs font-bold text-[#14233B] transition hover:bg-[#e6ce98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Appliquer
              </button>
            </div>
          )}
        </header>

        {/* Contenu */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {chargement && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              <RefreshCw size={15} className="animate-spin" />
              Actualisation des données financières...
            </div>
          )}

          {/* Chiffre d'affaires */}
          <div className="rounded-2xl bg-[#14233B] p-5 text-white shadow-md sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-300 sm:text-sm">
                  Chiffre d'affaires
                </p>

                <p className="mt-2 break-words text-3xl font-bold tracking-tight text-[#D8BD83] sm:text-4xl">
                  {montant(chiffreAffaires, devise)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-3 text-[#D8BD83]">
                <TrendingUp size={27} />
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-300">
              Recettes des prestations sur la période sélectionnée
            </p>
          </div>

          {/* Commissions */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CarteFinanciere
              titre="Commissions laveurs"
              valeur={montant(commissions, devise)}
              detail={`${pourcentageCommissions.toLocaleString("fr-FR", {
                maximumFractionDigits: 1,
              })} % du chiffre d'affaires`}
              icon={Receipt}
              couleur="text-amber-700"
              fond="bg-amber-50"
            />

            <CarteFinanciere
              titre="Dépenses et charges payées"
              valeur={montant(depenses, devise)}
              detail="Total des dépenses réglées sur la période"
              icon={Wallet}
              couleur="text-orange-700"
              fond="bg-orange-50"
            />
          </div>

          {/* Résultat */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Résultat net estimé
                </p>

                <p
                  className={`mt-2 break-words text-2xl font-bold sm:text-3xl ${
                    benefice < 0 ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {montant(benefice, devise)}
                </p>
              </div>

              <div
                className={`rounded-2xl p-3 ${
                  benefice < 0
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <Banknote size={27} />
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
              Chiffre d'affaires − commissions laveurs − dépenses payées.
            </div>
          </div>

          {/* Trésorerie */}
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <PiggyBank size={19} className="text-[#14233B]" />
              <h3 className="font-bold text-[#14233B]">
                Trésorerie de la station
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CarteFinanciere
                titre="Solde total des caisses"
                valeur={montant(soldeCaisses, devise)}
                detail="Solde actuellement disponible dans les caisses"
                icon={Wallet}
              />

              <CarteFinanciere
                titre="Caisse PRINCIPALE"
                valeur={montant(soldeCaissePrincipale, devise)}
                detail="Solde disponible dans la caisse principale"
                icon={Banknote}
                couleur="text-emerald-700"
                fond="bg-emerald-50"
              />
            </div>
          </div>

          <p className="mt-5 rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-500">
            Les indicateurs sont calculés à partir des données enregistrées
            dans MAAX Business. Le résultat net est une estimation de gestion
            et ne remplace pas un rapprochement comptable.
          </p>
        </div>

        {/* Pied de fenêtre */}
        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-center text-[10px] text-slate-400 sm:text-left sm:text-xs">
            MAAX Technologies · MAAX Business
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 flex-1 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
            >
              Fermer
            </button>

            <button
              type="button"
              onClick={onNouvelleOperation}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-4 py-2 text-xs font-bold text-[#14233B] transition hover:bg-[#e6ce98] sm:flex-none"
            >
              <Plus size={16} />
              Nouvelle opération
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}