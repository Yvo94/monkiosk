
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Wallet,
  CreditCard,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  Banknote,
  Smartphone,
  Landmark,
  Clock3,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const PAYMENT_LABELS = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  carte: "Carte bancaire",
  virement: "Virement",
  credit: "Crédit",
  mixte: "Paiement mixte",
};

const PAYMENT_ICONS = {
  especes: Banknote,
  mobile_money: Smartphone,
  carte: CreditCard,
  virement: Landmark,
  credit: Clock3,
  mixte: Wallet,
};

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPeriodDates(period, referenceDate) {
  const now = new Date(referenceDate);
  const today = localDate(now);

  if (period === "today") {
    return { start: today, end: today };
  }

  if (period === "week") {
    const start = new Date(now);
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);

    return { start: localDate(start), end: today };
  }

  if (period === "month") {
    return {
      start: `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-01`,
      end: today,
    };
  }

  return {
    start: `${now.getFullYear()}-01-01`,
    end: today,
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value || 0);
}

function formatShortDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function StatCard({ title, value, description, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500">{description}</p>
        </div>

        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function StatistiquesPage() {
  const [kiosqueId, setKiosqueId] = useState(null);
  const [period, setPeriod] = useState("year");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [referenceDate, setReferenceDate] = useState(null);

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // La date courante est initialisée après le montage du composant.
  useEffect(() => {
    const now = new Date();

    setReferenceDate(now.toISOString());
    setStartDate(`${now.getFullYear()}-01-01`);
    setEndDate(localDate(now));
  }, []);

  const loadStatistics = useCallback(async () => {
    if (!referenceDate) return;

    setError("");
    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setSales([]);
        setKiosqueId(null);
        setError("Veuillez vous connecter pour consulter les statistiques.");
        return;
      }

      const { data: kiosque, error: kiosqueError } = await supabase
        .from("kiosques")
        .select("id")
        .eq("owner_id", user.id)
        .eq("actif", true)
        .limit(1)
        .maybeSingle();

      if (kiosqueError) throw kiosqueError;

      if (!kiosque) {
        setSales([]);
        setKiosqueId(null);
        setError("Aucun kiosque actif n'est associé à votre compte.");
        return;
      }

      setKiosqueId(kiosque.id);

      const dates =
        period === "custom"
          ? { start: startDate, end: endDate }
          : getPeriodDates(period, referenceDate);

      if (!dates.start || !dates.end || dates.start > dates.end) {
        setSales([]);
        setError("La période sélectionnée est invalide.");
        return;
      }

      const from = new Date(`${dates.start}T00:00:00`);
      const until = new Date(`${dates.end}T00:00:00`);
      until.setDate(until.getDate() + 1);

      const { data, error: salesError } = await supabase
        .from("kiosque_ventes")
        .select(
          "id, montant_total, mode_paiement, created_at, statut"
        )
        .eq("kiosque_id", kiosque.id)
        .eq("statut", "terminee")
        .gte("created_at", from.toISOString())
        .lt("created_at", until.toISOString())
        .order("created_at", { ascending: true });

      if (salesError) throw salesError;

      setSales(data || []);
    } catch (err) {
      console.error("Erreur de chargement des statistiques :", err);
      setError(
        err?.message ||
          "Impossible de charger les statistiques. Réessayez."
      );
      setSales([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, startDate, endDate, referenceDate]);

  useEffect(() => {
    if (referenceDate) {
      loadStatistics();
    }
  }, [loadStatistics, referenceDate]);

  const totals = useMemo(() => {
    const revenue = sales.reduce(
      (sum, sale) => sum + (Number(sale.montant_total) || 0),
      0
    );

    const count = sales.length;

    return {
      revenue,
      count,
      average: count > 0 ? revenue / count : 0,
    };
  }, [sales]);

  const dailySales = useMemo(() => {
    if (!referenceDate) return [];

    const dates =
      period === "custom"
        ? { start: startDate, end: endDate }
        : getPeriodDates(period, referenceDate);

    if (!dates.start || !dates.end || dates.start > dates.end) {
      return [];
    }

    const start = new Date(`${dates.start}T12:00:00`);
    const end = new Date(`${dates.end}T12:00:00`);
    const dayCount = Math.floor((end - start) / 86400000) + 1;
    const groupByMonth = dayCount > 62;
    const groups = new Map();

    sales.forEach((sale) => {
      const date = new Date(sale.created_at);

      const key = groupByMonth
        ? `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`
        : localDate(date);

      if (!groups.has(key)) {
        groups.set(key, { key, revenue: 0, count: 0 });
      }

      const group = groups.get(key);
      group.revenue += Number(sale.montant_total) || 0;
      group.count += 1;
    });

    // Crée aussi les périodes sans ventes.
    const cursor = new Date(start);

    while (cursor <= end) {
      const key = groupByMonth
        ? `${cursor.getFullYear()}-${String(
            cursor.getMonth() + 1
          ).padStart(2, "0")}`
        : localDate(cursor);

      if (!groups.has(key)) {
        groups.set(key, { key, revenue: 0, count: 0 });
      }

      if (groupByMonth) {
        cursor.setDate(1);
        cursor.setMonth(cursor.getMonth() + 1);
      } else {
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return Array.from(groups.values())
      .map((item) => ({
        ...item,
        label:
          item.key.length === 7
            ? new Date(`${item.key}-01T12:00:00`).toLocaleDateString(
                "fr-FR",
                { month: "short", year: "2-digit" }
              )
            : formatShortDate(item.key),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [sales, period, startDate, endDate, referenceDate]);

  const paymentStats = useMemo(() => {
    const map = new Map();

    sales.forEach((sale) => {
      const method = sale.mode_paiement || "autre";
      const current = map.get(method) || { amount: 0, count: 0 };

      current.amount += Number(sale.montant_total) || 0;
      current.count += 1;
      map.set(method, current);
    });

    return Array.from(map.entries())
      .map(([method, values]) => ({
        method,
        label: PAYMENT_LABELS[method] || method,
        amount: values.amount,
        count: values.count,
        percentage:
          totals.revenue > 0
            ? (values.amount / totals.revenue) * 100
            : 0,
        Icon: PAYMENT_ICONS[method] || Wallet,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [sales, totals.revenue]);

  const maxRevenue = Math.max(
    1,
    ...dailySales.map((item) => item.revenue)
  );

  function applyPreset(value) {
    setPeriod(value);

    if (value === "custom") return;
    if (!referenceDate) return;

    const dates = getPeriodDates(value, referenceDate);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }

  function handleRefresh() {
    setRefreshing(true);
    loadStatistics();
  }

  if (!referenceDate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw className="mx-auto animate-spin text-slate-500" size={28} />
          <p className="mt-3 text-sm text-slate-500">
            Initialisation des statistiques...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <BarChart3 size={17} />
              <span>Tableau de bord</span>
              <span>/</span>
              <span>Statistiques</span>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Statistiques
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Analysez les performances de votre activité.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={loading || refreshing ? "animate-spin" : ""}
            />
            Actualiser
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={19} className="text-slate-600" />
            <h2 className="font-semibold text-slate-900">
              Période d'analyse
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "today", label: "Aujourd'hui" },
              { value: "week", label: "Cette semaine" },
              { value: "month", label: "Ce mois-ci" },
              { value: "year", label: "Cette année" },
              { value: "custom", label: "Personnalisée" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => applyPreset(item.value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  period === item.value
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              <div>
                <label
                  htmlFor="startDate"
                  className="mb-1.5 block text-sm font-medium text-slate-600"
                >
                  Du
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="endDate"
                  className="mb-1.5 block text-sm font-medium text-slate-600"
                >
                  Au
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={localDate(new Date(referenceDate))}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={loadStatistics}
                disabled={loading}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                Appliquer les dates
              </button>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Seules les ventes terminées sont comptabilisées.
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertTriangle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                Impossible d'afficher les statistiques
              </p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Chiffre d'affaires"
            value={formatMoney(totals.revenue)}
            description="Total des ventes terminées"
            icon={Wallet}
          />

          <StatCard
            title="Nombre de ventes"
            value={formatNumber(totals.count)}
            description="Transactions terminées"
            icon={ShoppingCart}
          />

          <StatCard
            title="Panier moyen"
            value={formatMoney(totals.average)}
            description="Chiffre d'affaires / ventes"
            icon={TrendingUp}
          />

          <StatCard
            title="Ventes enregistrées"
            value={formatNumber(totals.count)}
            description="Ventes au statut terminée"
            icon={CreditCard}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2 sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Évolution du chiffre d'affaires
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {period === "year"
                    ? "Répartition mensuelle sur l'année en cours"
                    : "Répartition sur la période sélectionnée"}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <ArrowUpRight size={17} />
                {formatMoney(totals.revenue)}
              </div>
            </div>

            {loading ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                Chargement du graphique...
              </div>
            ) : dailySales.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <BarChart3 size={35} className="text-slate-300" />
                <p className="mt-3 font-medium text-slate-700">
                  Aucune donnée disponible
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Les ventes terminées apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="mt-8">
                <div className="flex h-56 items-end gap-1.5 overflow-x-auto border-b border-slate-200 pb-2 sm:gap-3">
                  {dailySales.map((item) => (
                    <div
                      key={item.key}
                      className="group flex h-full min-w-5 flex-1 flex-col items-center justify-end"
                      title={`${item.label} : ${formatMoney(item.revenue)} (${item.count} vente(s))`}
                    >
                      <div
                        className="w-full max-w-12 rounded-t-md bg-slate-800 transition hover:bg-slate-600"
                        style={{
                          height:
                            item.revenue > 0
                              ? `${Math.max(
                                  3,
                                  (item.revenue / maxRevenue) * 100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between gap-2 overflow-hidden text-xs text-slate-500">
                  <span>{dailySales[0]?.label}</span>
                  {dailySales.length > 2 && (
                    <span>
                      {dailySales[Math.floor(dailySales.length / 2)]?.label}
                    </span>
                  )}
                  <span>{dailySales[dailySales.length - 1]?.label}</span>
                </div>

                <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-800" />
                    Chiffre d'affaires
                  </span>
                  <span>{formatNumber(totals.count)} vente(s)</span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Modes de paiement
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Répartition du montant des ventes
            </p>

            {loading ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                Chargement...
              </div>
            ) : paymentStats.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <CreditCard size={32} className="text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">
                  Aucun paiement à afficher.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {paymentStats.map((payment) => {
                  const Icon = payment.Icon;

                  return (
                    <div key={payment.method}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {payment.label}
                            </p>
                            <p className="text-xs text-slate-500">
                              {payment.count} vente(s)
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                            {formatMoney(payment.amount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {payment.percentage.toFixed(1)} %
                          </p>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-800 transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              payment.percentage
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Détail des ventes
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Historique agrégé par jour ou par mois.
              </p>
            </div>

            <span className="w-fit rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {dailySales.length} période(s)
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chargement des données...
            </div>
          ) : dailySales.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Aucune vente terminée sur cette période.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Période</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Nombre de ventes
                    </th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Chiffre d'affaires
                    </th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Panier moyen
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {[...dailySales].reverse().map((item) => (
                    <tr key={item.key} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                        {item.label}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-600">
                        {formatNumber(item.count)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                        {formatMoney(item.revenue)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                        {formatMoney(
                          item.count > 0
                            ? item.revenue / item.count
                            : 0
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="px-5 py-4 font-bold text-slate-900">
                      TOTAL
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">
                      {formatNumber(totals.count)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-slate-900">
                      {formatMoney(totals.revenue)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-slate-900">
                      {formatMoney(totals.average)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-400">
          MAAX Business · Statistiques calculées à partir des ventes terminées.
        </p>
      </div>
    </div>
  );
}
