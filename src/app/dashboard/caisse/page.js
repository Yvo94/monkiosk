
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  WalletCards,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Search,
  RefreshCw,
  Plus,
  X,
  CalendarDays,
  History,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  SlidersHorizontal,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatMoney = (value, devise = "FCFA") =>
  `${formatNumber(value)} ${devise}`;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfToday = () => {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
};

function StatCard({ title, value, subtitle, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>

          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-[#14233B]">
            {value}
          </p>

          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        </div>

        <div className={`rounded-xl p-3 ${tone}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ sens, type }) {
  const isEntry = sens === "entree";

  const labels = {
    vente: "Vente",
    depense: "Dépense",
    entree_manuelle: "Entrée manuelle",
    sortie_manuelle: "Sortie manuelle",
    approvisionnement: "Approvisionnement",
    remboursement: "Remboursement",
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
          isEntry
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}
      >
        {isEntry ? (
          <ArrowDownLeft size={14} />
        ) : (
          <ArrowUpRight size={14} />
        )}

        {isEntry ? "Entrée" : "Sortie"}
      </span>

      <span className="text-xs text-gray-500">
        {labels[type] || type || "Autre opération"}
      </span>
    </div>
  );
}

export default function CaissePage() {
  const [kiosk, setKiosk] = useState(null);
  const [caisse, setCaisse] = useState(null);
  const [movements, setMovements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [periodFilter, setPeriodFilter] = useState("tous");
  const [showForm, setShowForm] = useState(false);

  const [currentDate, setCurrentDate] = useState(null);

  const [form, setForm] = useState({
    type_mouvement: "entree",
    montant: "",
    motif: "",
  });

  const devise = kiosk?.devise || "FCFA";

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
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

      const { data: kioskData, error: kioskError } = await supabase
        .from("kiosques")
        .select("id, nom, devise")
        .eq("owner_id", session.user.id)
        .eq("actif", true)
        .maybeSingle();

      if (kioskError) throw kioskError;

      if (!kioskData) {
        throw new Error("Aucun kiosque actif n'a été trouvé.");
      }

      setKiosk(kioskData);

      const { data: caisseData, error: caisseError } = await supabase
        .from("kiosque_caisses")
        .select(
          "id, kiosque_id, code, nom, solde_initial, solde_actuel, statut"
        )
        .eq("kiosque_id", kioskData.id)
        .eq("code", "PRINCIPALE")
        .maybeSingle();

      if (caisseError) throw caisseError;

      if (!caisseData) {
        setCaisse(null);
        setMovements([]);
        return;
      }

      setCaisse(caisseData);

      const { data: movementData, error: movementError } = await supabase
        .from("kiosque_mouvements_caisse")
        .select(
          `
            id,
            caisse_id,
            kiosque_id,
            type_mouvement,
            sens,
            montant,
            mode_paiement,
            reference,
            description,
            solde_avant,
            solde_apres,
            created_by,
            created_at
          `
        )
        .eq("kiosque_id", kioskData.id)
        .eq("caisse_id", caisseData.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (movementError) throw movementError;

      setMovements(movementData || []);
    } catch (err) {
      console.error("Erreur de chargement de la caisse :", err);
      setError(err?.message || "Impossible de charger la caisse.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setCurrentDate(new Date());
    loadData();
  }, [loadData]);

  const todayMovements = useMemo(() => {
    if (!currentDate) return [];

    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return movements.filter((movement) => {
        const date = new Date(movement.created_at);
        return date >= start && date < end;
    });
    }, [movements, currentDate]);

  const todayTotals = useMemo(() => {
    return todayMovements.reduce(
      (totals, movement) => {
        const amount = Number(movement.montant || 0);

        if (movement.sens === "entree") {
          totals.entrees += amount;
        } else if (movement.sens === "sortie") {
          totals.sorties += amount;
        }

        return totals;
      },
      { entrees: 0, sorties: 0 }
    );
  }, [todayMovements]);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const matchesSearch =
        !term ||
        [
          movement.description,
          movement.type_mouvement,
          movement.sens,
          movement.montant,
          movement.reference,
          movement.mode_paiement,
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(term)
        );

      const matchesType =
        typeFilter === "tous" || movement.sens === typeFilter;

      let matchesPeriod = true;
      if (!currentDate) return false;
      const now = currentDate;
      const movementDate = new Date(movement.created_at);

      if (periodFilter === "aujourd_hui") {
        matchesPeriod =
          movementDate >= startOfToday() &&
          movementDate < endOfToday();
      } else if (periodFilter === "7_jours") {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        lastWeek.setHours(0, 0, 0, 0);

        matchesPeriod = movementDate >= lastWeek && movementDate <= now;
      } else if (periodFilter === "30_jours") {
        const lastMonth = new Date();
        lastMonth.setDate(lastMonth.getDate() - 30);
        lastMonth.setHours(0, 0, 0, 0);

        matchesPeriod = movementDate >= lastMonth && movementDate <= now;
      }

      return matchesSearch && matchesType && matchesPeriod;
    });
  }, [movements, search, typeFilter, periodFilter]);

  function openForm(type = "entree") {
    setError("");
    setSuccess("");

    setForm({
      type_mouvement: type,
      montant: "",
      motif: "",
    });

    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const amount = Number(form.montant);

    if (!caisse?.id || !kiosk?.id) {
      setError("La caisse principale est introuvable.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Le montant doit être supérieur à zéro.");
      return;
    }

    if (!form.motif.trim()) {
      setError("Veuillez préciser le motif de l'opération.");
      return;
    }

    if (
      form.type_mouvement === "sortie" &&
      amount > Number(caisse.solde_actuel || 0)
    ) {
      setError(
        `Solde insuffisant. Solde disponible : ${formatMoney(
          caisse.solde_actuel,
          devise
        )}.`
      );
      return;
    }

    setSaving(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        "gerer_mouvement_caisse",
        {
          p_kiosque_id: kiosk.id,
          p_caisse_id: caisse.id,
          p_type_mouvement:
            form.type_mouvement === "entree"
              ? "entree_manuelle"
              : "sortie_manuelle",
          p_sens: form.type_mouvement,
          p_montant: amount,
          p_description: form.motif.trim(),
          p_mode_paiement: "especes",
        }
      );

      if (rpcError) throw rpcError;

      setShowForm(false);
      setSuccess("Le mouvement de caisse a été enregistré.");

      await loadData(true);
    } catch (err) {
      console.error("Erreur d'enregistrement du mouvement :", err);

      setError(
        err?.message ||
          "Impossible d'enregistrer le mouvement de caisse."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !kiosk) {
    return (
      <div className="flex min-h-64 items-center justify-center text-gray-500">
        <RefreshCw className="mr-2 animate-spin" size={20} />
        Chargement de la caisse...
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1450px] space-y-6">
        {/* EN-TÊTE */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#D9683C]"
            >
              <ArrowLeft size={16} />
              Retour au tableau de bord
            </Link>

            <h1 className="text-2xl font-bold tracking-tight text-[#14233B] sm:text-3xl">
              Caisse principale
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {kiosk?.nom || "MonKiosk"} · Suivi permanent de votre trésorerie.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Actualiser
            </button>

            <button
              type="button"
              onClick={() => openForm("entree")}
              disabled={!caisse}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D9683C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B94C24] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={18} />
              Nouveau mouvement
            </button>
          </div>
        </div>

        {/* ERREURS */}
        {error && !showForm && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={20} className="shrink-0" />

            <div className="flex-1">
              <p className="font-semibold">Une erreur est survenue</p>
              <p className="mt-1">{error}</p>

              <button
                type="button"
                onClick={() => loadData(true)}
                className="mt-2 font-bold underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMATION */}
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={18} />
            <span className="flex-1">{success}</span>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Fermer"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* CAISSE ABSENTE */}
        {!caisse && !loading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 shrink-0 text-amber-700" />

              <div>
                <h2 className="font-bold text-amber-900">
                  Caisse principale introuvable
                </h2>

                <p className="mt-1 text-sm text-amber-800">
                  Aucune caisse avec le code PRINCIPALE n'a été trouvée pour
                  ce kiosque. Vérifie la table kiosque_caisses.
                </p>
              </div>
            </div>
          </div>
        ) : (
          caisse && (
            <>
              {/* SOLDE PRINCIPAL */}
              <section className="relative overflow-hidden rounded-2xl bg-[#14233B] p-6 text-white shadow-sm sm:p-8">
                <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-blue-100">
                      <WalletCards size={18} />
                      Solde disponible
                    </div>

                    <p className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl">
                      {formatMoney(caisse.solde_actuel, devise)}
                    </p>

                    <p className="mt-2 text-sm text-blue-100">
                      Caisse principale · Solde permanent
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openForm("entree")}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600"
                    >
                      <ArrowDownLeft size={18} />
                      Entrée d'argent
                    </button>

                    <button
                      type="button"
                      onClick={() => openForm("sortie")}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
                    >
                      <ArrowUpRight size={18} />
                      Sortie d'argent
                    </button>
                  </div>
                </div>

                <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[30px] border-white/5" />
                <div className="absolute -bottom-24 right-36 h-48 w-48 rounded-full bg-white/5" />
              </section>

              {/* INDICATEURS */}
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  title="Entrées aujourd'hui"
                  value={formatMoney(todayTotals.entrees, devise)}
                  subtitle={`${
                    todayMovements.filter(
                      (item) => item.sens === "entree"
                    ).length
                  } opération(s)`}
                  icon={TrendingUp}
                  tone="bg-emerald-50 text-emerald-700"
                />

                <StatCard
                  title="Sorties aujourd'hui"
                  value={formatMoney(todayTotals.sorties, devise)}
                  subtitle={`${
                    todayMovements.filter(
                      (item) => item.sens === "sortie"
                    ).length
                  } opération(s)`}
                  icon={TrendingDown}
                  tone="bg-red-50 text-red-700"
                />

                <StatCard
                  title="Variation nette du jour"
                  value={formatMoney(
                    todayTotals.entrees - todayTotals.sorties,
                    devise
                  )}
                  subtitle="Entrées moins sorties"
                  icon={Banknote}
                  tone="bg-blue-50 text-blue-700"
                />
              </section>

              {/* HISTORIQUE */}
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#14233B]">
                      <History size={20} className="text-[#D9683C]" />
                      Historique de caisse
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Les 500 derniers mouvements enregistrés.
                    </p>
                  </div>

                  <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#B94C24]">
                    {filteredMovements.length} mouvement(s)
                  </span>
                </div>

                {/* FILTRES */}
                <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 md:grid-cols-[1fr_180px_180px]">
                  <div className="relative">
                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher un motif..."
                      className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#D9683C]"
                    />
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#D9683C]"
                  >
                    <option value="tous">Tous les sens</option>
                    <option value="entree">Entrées</option>
                    <option value="sortie">Sorties</option>
                  </select>

                  <select
                    value={periodFilter}
                    onChange={(event) => setPeriodFilter(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#D9683C]"
                  >
                    <option value="tous">Toute la période</option>
                    <option value="aujourd_hui">Aujourd'hui</option>
                    <option value="7_jours">7 derniers jours</option>
                    <option value="30_jours">30 derniers jours</option>
                  </select>
                </div>

                {/* TABLEAU */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Date</th>
                        <th className="px-5 py-4 font-semibold">Opération</th>
                        <th className="px-5 py-4 font-semibold">Motif</th>
                        <th className="px-5 py-4 font-semibold">Paiement</th>
                        <th className="px-5 py-4 text-right font-semibold">
                          Montant
                        </th>
                        <th className="px-5 py-4 text-right font-semibold">
                          Solde avant
                        </th>
                        <th className="px-5 py-4 text-right font-semibold">
                          Solde après
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {filteredMovements.map((movement) => (
                        <tr
                          key={movement.id}
                          className="hover:bg-gray-50/70"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                            {formatDate(movement.created_at)}
                          </td>

                          <td className="px-5 py-4">
                            <TypeBadge
                              sens={movement.sens}
                              type={movement.type_mouvement}
                            />
                          </td>

                          <td className="max-w-xs whitespace-normal px-5 py-4 text-gray-700">
                            {movement.description || "Sans description"}
                            {movement.reference && (
                              <p className="mt-1 text-xs text-gray-400">
                                Réf. : {movement.reference}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                            {movement.mode_paiement || "—"}
                          </td>

                          <td
                            className={`whitespace-nowrap px-5 py-4 text-right font-bold ${
                              movement.sens === "entree"
                                ? "text-emerald-700"
                                : "text-red-700"
                            }`}
                          >
                            {movement.sens === "entree" ? "+" : "−"}
                            {formatMoney(movement.montant, devise)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600">
                            {movement.solde_avant == null
                              ? "—"
                              : formatMoney(movement.solde_avant, devise)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-900">
                            {movement.solde_apres == null
                              ? "—"
                              : formatMoney(movement.solde_apres, devise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredMovements.length === 0 && (
                  <div className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                      <SlidersHorizontal size={21} />
                    </div>

                    <p className="mt-3 font-semibold text-gray-800">
                      Aucun mouvement trouvé
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Modifie les filtres ou enregistre une nouvelle opération.
                    </p>
                  </div>
                )}

                <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
                  Les soldes avant/après ne sont affichés que lorsqu'ils sont
                  disponibles dans l'historique.
                </div>
              </section>
            </>
          )
        )}

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-gray-200 py-5 text-xs text-gray-400 sm:flex-row">
          <p>MonKiosk · Gestion de caisse</p>

          <p className="flex items-center gap-2">
            <CalendarDays size={14} />
            {currentDate
                ? currentDate.toLocaleDateString("fr-FR")
                : "Chargement..."}
          </p>
        </footer>
      </div>

      {/* FORMULAIRE DE MOUVEMENT */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              closeForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-form-title"
            className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <h2
                  id="cash-form-title"
                  className="text-lg font-bold text-[#14233B]"
                >
                  Nouveau mouvement
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Solde actuel : {formatMoney(caisse?.solde_actuel, devise)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Fermer"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {/* TYPE */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Type d'opération
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        type_mouvement: "entree",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold ${
                      form.type_mouvement === "entree"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <ArrowDownLeft size={18} />
                    Entrée
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        type_mouvement: "sortie",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold ${
                      form.type_mouvement === "sortie"
                        ? "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <ArrowUpRight size={18} />
                    Sortie
                  </button>
                </div>
              </div>

              {/* MONTANT */}
              <div>
                <label
                  htmlFor="cash-amount"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Montant ({devise})
                </label>

                <input
                  id="cash-amount"
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={form.montant}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      montant: event.target.value,
                    }))
                  }
                  placeholder="Ex. : 25 000"
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#D9683C]"
                />
              </div>

              {/* SOLDE PRÉVISIONNEL */}
              {form.montant !== "" &&
                Number.isFinite(Number(form.montant)) &&
                Number(form.montant) > 0 && (
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-medium text-gray-500">
                      Solde prévisionnel après opération
                    </p>

                    <p className="mt-1 text-xl font-bold text-[#14233B]">
                      {formatMoney(
                        Number(caisse?.solde_actuel || 0) +
                          (form.type_mouvement === "entree"
                            ? Number(form.montant)
                            : -Number(form.montant)),
                        devise
                      )}
                    </p>
                  </div>
                )}

              {/* MOTIF */}
              <div>
                <label
                  htmlFor="cash-reason"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Motif
                </label>

                <textarea
                  id="cash-reason"
                  rows={3}
                  required
                  value={form.motif}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      motif: event.target.value,
                    }))
                  }
                  placeholder={
                    form.type_mouvement === "entree"
                      ? "Ex. : Apport de fonds, remboursement..."
                      : "Ex. : Retrait, achat divers, frais..."
                  }
                  className="w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#D9683C]"
                />
              </div>

              {/* ACTIONS */}
              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D9683C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#B94C24] disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
