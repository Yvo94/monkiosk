
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  RefreshCw,
  CalendarDays,
  Wallet,
  ClipboardList,
  CheckCircle2,
  Clock3,
  Truck,
  Eye,
  AlertCircle,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import NouvelAchatModal from "@/components/achats/NouvelAchatModal";

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatFCFA = (value) => `${formatNumber(value)} FCFA`;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const statusConfig = {
  recu: {
    label: "Reçu",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  en_attente: {
    label: "En attente",
    className: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  commande: {
    label: "Commandé",
    className: "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
  annule: {
    label: "Annulé",
    className: "bg-red-50 text-red-700 ring-red-600/20",
  },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || {
    label: status || "Inconnu",
    className: "bg-gray-100 text-gray-600 ring-gray-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function StatCard({ title, value, description, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#14233B]">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function AchatsPage() {
  const [achats, setAchats] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showNouvelAchat, setShowNouvelAchat] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  
  const loadAchats = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      // Récupérer le kiosque associé à l'utilisateur connecté
      const response = await fetch("/api/admin/users?action=kiosk", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Impossible de récupérer le kiosque associé."
        );
      }

      const kioskData = result.kiosk;

      if (!kioskData?.id) {
        throw new Error(
          "Aucun kiosque actif n'est associé à votre compte."
        );
      }

      // Charger les achats et les fournisseurs du kiosque
      const [achatsResult, fournisseursResult] = await Promise.all([
        supabase
          .from("kiosque_achats")
          .select(
            "id, kiosque_id, fournisseur_id, numero, date_achat, statut, montant_total, montant_paye, notes, created_at"
          )
          .eq("kiosque_id", kioskData.id)
          .order("date_achat", { ascending: false }),

        supabase
          .from("kiosque_fournisseurs")
          .select("id, nom, telephone, whatsapp")
          .eq("kiosque_id", kioskData.id)
          .eq("actif", true)
          .order("nom", { ascending: true }),
      ]);

      if (achatsResult.error) throw achatsResult.error;
      if (fournisseursResult.error) throw fournisseursResult.error;

      setAchats(achatsResult.data || []);
      setFournisseurs(fournisseursResult.data || []);
    } catch (err) {
      console.error("Erreur chargement des achats :", err);
      setError(
        err?.message || "Impossible de charger les achats."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


  useEffect(() => {
    loadAchats();

    const handleFocus = () => loadAchats(true);

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadAchats]);

  const fournisseurMap = useMemo(
    () => new Map(fournisseurs.map((f) => [f.id, f])),
    [fournisseurs]
  );

  const filteredAchats = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("fr");

    return achats.filter((achat) => {
      const fournisseur = fournisseurMap.get(achat.fournisseur_id);
      const fournisseurNom = fournisseur?.nom || "Sans fournisseur";

      const matchesSearch =
        !term ||
        String(achat.numero || "").toLocaleLowerCase("fr").includes(term) ||
        fournisseurNom.toLocaleLowerCase("fr").includes(term);

      const matchesStatus =
        statusFilter === "tous" || achat.statut === statusFilter;

      const date = achat.date_achat
        ? new Date(achat.date_achat)
        : null;

      const matchesStart =
        !startDate ||
        (date && !Number.isNaN(date.getTime()) &&
          date >= new Date(`${startDate}T00:00:00`));

      const matchesEnd =
        !endDate ||
        (date && !Number.isNaN(date.getTime()) &&
          date < new Date(
            new Date(`${endDate}T00:00:00`).getTime() + 86400000
          ));

      return matchesSearch && matchesStatus && matchesStart && matchesEnd;
    });
  }, [achats, fournisseurMap, search, statusFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const total = filteredAchats.reduce(
      (sum, achat) => sum + Number(achat.montant_total || 0),
      0
    );

    const paye = filteredAchats.reduce(
      (sum, achat) => sum + Number(achat.montant_paye || 0),
      0
    );

    const recus = filteredAchats.filter(
      (achat) => achat.statut === "recu"
    ).length;

    return {
      total,
      paye,
      reste: total - paye,
      recus,
    };
  }, [filteredAchats]);

  function resetFilters() {
    setSearch("");
    setStatusFilter("tous");
    setStartDate("");
    setEndDate("");
  }

  return (
    <div className="min-h-full bg-slate-50/60 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        {/* En-tête */}
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <ShoppingBag className="h-4 w-4" />
              <span>Gestion commerciale</span>
              <span>/</span>
              <span className="font-medium text-[#D9A45B]">Achats</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#14233B] sm:text-3xl">
              Gestion des achats
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Suivez vos approvisionnements et les paiements fournisseurs.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => loadAchats(true)}
              disabled={loading || refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Actualiser
            </button>

            <button
                type="button"
                onClick={() => setShowNouvelAchat(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#14233B] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#203653]"
                >
                <Plus className="h-4 w-4" />
                Nouvel achat
            </button>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">
                Impossible de charger les données.
              </p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => loadAchats(true)}
                className="mt-2 font-semibold underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* Indicateurs */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Montant des achats"
            value={formatFCFA(stats.total)}
            description={`${filteredAchats.length} achat(s) affiché(s)`}
            icon={ClipboardList}
            color="bg-blue-50 text-blue-700"
          />

          <StatCard
            title="Montant payé"
            value={formatFCFA(stats.paye)}
            description="Somme des paiements enregistrés"
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-700"
          />

          <StatCard
            title="Reste à payer"
            value={formatFCFA(stats.reste)}
            description="Montant total moins montant payé"
            icon={Wallet}
            color="bg-amber-50 text-amber-700"
          />

          <StatCard
            title="Achats reçus"
            value={formatNumber(stats.recus)}
            description="Achats au statut reçu"
            icon={Truck}
            color="bg-violet-50 text-violet-700"
          />
        </section>

        {/* Liste */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-lg font-bold text-[#14233B]">
                  Historique des achats
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Retrouvez les commandes et les approvisionnements de votre kiosque.
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un numéro, un fournisseur..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#D9A45B] focus:ring-2 focus:ring-[#D9A45B]/20"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_180px_180px_auto]">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  aria-label="Date de début"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 min-w-0 w-full bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  aria-label="Date de fin"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 min-w-0 w-full bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrer par statut"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#D9A45B]"
              >
                <option value="tous">Tous les statuts</option>
                <option value="recu">Reçu</option>
                <option value="en_attente">En attente</option>
                <option value="commande">Commandé</option>
                <option value="annule">Annulé</option>
              </select>

              <div className="flex items-center rounded-xl border border-slate-200 px-3 text-sm text-slate-500">
                {filteredAchats.length} résultat(s)
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
                Effacer
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center px-5 py-20">
              <RefreshCw className="h-7 w-7 animate-spin text-[#D9A45B]" />
              <p className="mt-3 text-sm text-slate-500">
                Chargement des achats...
              </p>
            </div>
          ) : filteredAchats.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <ShoppingBag className="h-8 w-8 text-slate-400" />
              </div>

              <h3 className="mt-4 text-base font-bold text-[#14233B]">
                {achats.length === 0
                  ? "Aucun achat enregistré"
                  : "Aucun résultat"}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                {achats.length === 0
                  ? "Enregistrez votre premier approvisionnement pour commencer à suivre vos achats."
                  : "Essayez de modifier votre recherche ou vos filtres."}
              </p>

              {achats.length === 0 ? (
                <button
                    type="button"
                    onClick={() => setShowNouvelAchat(true)}
                    className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#14233B] px-5 text-sm font-semibold text-white hover:bg-[#203653]"
                    >
                    <Plus className="h-4 w-4" />
                    Enregistrer un achat
                    </button>
              ) : (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Tableau ordinateur */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[850px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">N° achat</th>
                      <th className="px-5 py-4 font-semibold">Date</th>
                      <th className="px-5 py-4 font-semibold">Fournisseur</th>
                      <th className="px-5 py-4 text-right font-semibold">Total</th>
                      <th className="px-5 py-4 text-right font-semibold">Payé</th>
                      <th className="px-5 py-4 font-semibold">Statut</th>
                      <th className="px-5 py-4 text-right font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredAchats.map((achat) => {
                      const fournisseur = fournisseurMap.get(
                        achat.fournisseur_id
                      );

                      return (
                        <tr
                          key={achat.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <span className="font-bold text-[#14233B]">
                              {achat.numero}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatDate(achat.date_achat)}
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-slate-800">
                              {fournisseur?.nom || "Sans fournisseur"}
                            </p>
                            {fournisseur?.telephone && (
                              <p className="mt-1 text-xs text-slate-500">
                                {fournisseur.telephone}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-bold text-[#14233B]">
                            {formatFCFA(achat.montant_total)}
                          </td>

                          <td className="px-5 py-4 text-right text-sm text-slate-600">
                            {formatFCFA(achat.montant_paye)}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={achat.statut} />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/dashboard/achats/${achat.id}`}
                              aria-label={`Consulter l'achat ${achat.numero}`}
                              title="Consulter le détail"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-[#D9A45B] hover:bg-amber-50 hover:text-[#8D632D]"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cartes mobile */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredAchats.map((achat) => {
                  const fournisseur = fournisseurMap.get(
                    achat.fournisseur_id
                  );

                  return (
                    <div key={achat.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-[#14233B]">
                            {achat.numero}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(achat.date_achat)}
                          </p>
                        </div>
                        <StatusBadge status={achat.statut} />
                      </div>

                      <p className="mt-3 text-sm font-medium text-slate-700">
                        {fournisseur?.nom || "Sans fournisseur"}
                      </p>

                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-500">Montant total</p>
                          <p className="mt-1 font-bold text-[#14233B]">
                            {formatFCFA(achat.montant_total)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Payé : {formatFCFA(achat.montant_paye)}
                          </p>
                        </div>

                        <Link
                          href={`/dashboard/achats/${achat.id}`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          Détail
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center">
                <span>
                  {filteredAchats.length} achat(s) affiché(s)
                </span>
                <span>
                  Total filtré :{" "}
                  <strong className="text-[#14233B]">
                    {formatFCFA(stats.total)}
                  </strong>
                </span>
              </div>
            </>
          )}
        </section>
      </div>
      {showNouvelAchat && (
        <NouvelAchatModal
            fournisseurs={fournisseurs}
            onClose={() => setShowNouvelAchat(false)}
            onSaved={() => loadAchats(true)}
        />
        )}
    </div>
);
}
