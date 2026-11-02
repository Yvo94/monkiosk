
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import NewSaleModal from "@/components/ventes/NewSaleModal";
import NewProductModal from "@/components/produits/NewProductModal";

import {
  ShoppingCart,
  Package,
  Boxes,
  WalletCards,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  Grid2X2,
  FileText,
  Lightbulb,
  Cloud,
  CalendarDays,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

/* ============================================================
   OUTILS
============================================================ */

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatFCFA = (value) =>
  `${formatNumber(value)} FCFA`;

const formatDate = (date) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

function formatTime(value) {
  if (!value) return "Date inconnue";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}   

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date) => {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
};

const dateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getErrorMessage = (error) =>
  error?.message || "Une erreur inattendue est survenue.";

/* ============================================================
   RACCOURCIS
============================================================ */

const shortcuts = [
  {
    title: "Nouvelle vente",
    action: "new-sale",
    icon: ShoppingCart,
    color: "bg-green-500",
  },
  {
    title: "Nouveau produit",
    action: "new-product",
    icon: Package,
    color: "bg-blue-500",
  },
  {
    title: "Gérer catégories",
    href: "/dashboard/categories",
    icon: Grid2X2,
    color: "bg-purple-500",
  },
  {
    title: "Enregistrer un achat",
    href: "/dashboard/achats/nouveau",
    icon: Truck,
    color: "bg-orange-500",
  },
  {
    title: "Voir le stock",
    href: "/dashboard/stock",
    icon: Boxes,
    color: "bg-cyan-500",
  },
  {
    title: "Ouvrir caisse",
    href: "/dashboard/caisse",
    icon: WalletCards,
    color: "bg-rose-500",
  },
  {
    title: "Enregistrer une dépense",
    href: "/dashboard/depenses/nouveau",
    icon: FileText,
    color: "bg-indigo-500",
  },
  {
    title: "Voir les statistiques",
    href: "/dashboard/statistiques",
    icon: BarChart3,
    color: "bg-slate-500",
  },
];

/* ============================================================
   CARTE STATISTIQUE
============================================================ */

function StatCard({ stat }) {
  const Icon = stat.icon;
  const positive = stat.variation >= 0;

  return (
    <div
      className={`rounded-xl border border-gray-200 ${stat.cardBg} p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${stat.iconBg}`}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      <p className="mt-4 text-sm font-semibold text-[#26364B]">
        {stat.title}
      </p>

      <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
        <span className="text-[22px] font-bold tracking-tight text-[#14233B]">
          {formatNumber(stat.value)}
        </span>
        <span className="text-sm font-bold text-[#26364B]">
          {stat.suffix}
        </span>
      </div>

      {stat.variation !== null && (
        <div className="mt-3 flex items-center gap-1.5">
          {positive ? (
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          )}
          <span
            className={`text-sm font-bold ${
              positive ? "text-green-600" : "text-red-500"
            }`}
          >
            {positive ? "+" : ""}
            {formatNumber(stat.variation)}%
          </span>
          <span className="text-xs text-gray-500">vs hier</span>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   GRAPHIQUE DES VENTES
============================================================ */

function SalesChart({ data }) {
  const maxValue = Math.max(
    1,
    ...data.map((item) => item.value)
  );

  const chartMax = Math.ceil(maxValue / 50000) * 50000 || 50000;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#14233B]">
            Évolution des ventes
          </h2>
          <p className="text-sm text-gray-500">
            Les 7 derniers jours
          </p>
        </div>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#D9683C]">
          FCFA
        </span>
      </div>

      <div className="relative h-[250px]">
        <div className="absolute inset-0 flex flex-col justify-between pb-8">
          {[4, 3, 2, 1, 0].map((step) => (
            <div key={step} className="flex items-center gap-3">
              <span className="w-[55px] text-right text-[10px] text-gray-400">
                {formatNumber((chartMax * step) / 4)}
              </span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
          ))}
        </div>

        <div className="absolute bottom-8 left-[65px] right-0 top-0 flex items-end justify-around gap-2">
          {data.map((item) => (
            <div
              key={item.date}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            >
              <span className="mb-1 truncate text-[9px] text-gray-500">
                {item.value > 0 ? formatNumber(item.value) : ""}
              </span>
              <div
                className="w-full max-w-[32px] rounded-t-[3px] bg-[#D9683C] transition-colors hover:bg-[#B94C24]"
                style={{
                  height: `${Math.max(
                    item.value > 0 ? 2 : 0,
                    (item.value / chartMax) * 180
                  )}px`,
                }}
                title={`${item.label} : ${formatFCFA(item.value)}`}
              />
              <span className="mt-3 text-[10px] text-gray-500">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DERNIERES VENTES
============================================================ */

function RecentSales({ sales }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-lg font-bold text-[#14233B]">
          Dernières ventes
        </h2>
        <Link
          href="/dashboard/ventes"
          className="flex items-center gap-1 text-sm font-semibold text-[#D9683C] hover:underline"
        >
          Voir tout <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {sales.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-500">
          Aucune vente enregistrée pour le moment.
        </p>
      ) : (
        <div className="px-5">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
                <ShoppingCart className="h-5 w-5 text-[#D9683C]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-800">
                  Vente {sale.numero}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatTime(sale.date_vente)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-gray-700">
                  {formatFCFA(sale.montant_total)}
                </p>
                <p className="mt-1 text-xs text-green-600">
                  {sale.statut === "payee" ? "Payée" : sale.statut}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   RACCOURCIS
============================================================ */

function QuickActions({ onNewSale, onNewProduct }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-bold text-gray-900">
        Actions rapides
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;

          if (
            shortcut.action === "new-sale" ||
            shortcut.action === "new-product"
          ) {
            const isProduct = shortcut.action === "new-product";
            const handleClick = isProduct ? onNewProduct : onNewSale;

            return (
              <button
                key={shortcut.title}
                type="button"
                onClick={handleClick}
                className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 p-4 text-center transition hover:border-gray-200 hover:bg-gray-50"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${shortcut.color}`}
                >
                  <Icon className="h-5 w-5" />
                </span>

                <span className="text-sm font-semibold text-gray-700">
                  {shortcut.title}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={shortcut.title}
              href={shortcut.href}
              className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 p-4 text-center transition hover:border-gray-200 hover:bg-gray-50"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${shortcut.color}`}
              >
                <Icon className="h-5 w-5" />
              </span>

              <span className="text-sm font-semibold text-gray-700">
                {shortcut.title}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}


/* ============================================================
   ALERTE STOCK
============================================================ */

function StockAlert({ products, onDismiss, dismissed }) {
  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-orange-100 bg-[#FFF7EF] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-400">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-[#14233B]">
            Bon à savoir
          </h2>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer l'alerte"
          className="rounded-lg p-1 text-gray-500 hover:bg-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-5 text-sm font-semibold text-gray-700">
        {products.length > 0
          ? `Stock faible sur ${products.length} produit(s) :`
          : "Aucun produit en stock faible."}
      </p>

      {products.length > 0 && (
        <div className="mt-4 space-y-3">
          {products.slice(0, 5).map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-2"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D72855] text-[11px] font-bold text-white">
                !
              </div>
              <p className="flex-1 text-sm font-semibold text-gray-700">
                {product.nom}
              </p>
              <span className="text-sm font-bold text-[#D72855]">
                {formatNumber(product.stock_actuel)}{" "}
                {product.unite || "unités"}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/dashboard/stock"
        className="mt-5 flex h-10 items-center justify-center gap-2 rounded-full bg-[#D9683C] text-sm font-semibold text-white transition hover:bg-[#B94C24]"
      >
        Voir le stock <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/* ============================================================
   PAGE DASHBOARD
============================================================ */

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [userName, setUserName] = useState("votre kiosque");
  const [currentDate, setCurrentDate] = useState(null);
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [modalNouvelleOperation, setModalNouvelleOperation] = useState(false);

  useEffect(() => {
  setCurrentDate(new Date());
  }, []);

  const [stats, setStats] = useState({
    ventes: 0,
    achats: 0,
    stock: 0,
    caisse: 0,
    variationVentes: null,
    variationAchats: null,
  });

  const [salesChart, setSalesChart] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  const loadDashboard = useCallback(async (isRefresh = false) => {
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
      
            
      const user = session.user;

      const contextResponse = await fetch("/api/auth/context", {
        cache: "no-store",
        credentials: "same-origin",
      });


      if (contextResponse.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (!contextResponse.ok) {
        throw new Error("Impossible de récupérer les modules du compte.");
      }

      const context = await contextResponse.json();
      const modules = context.modules || [];

      const aKiosque = modules.some(
        (module) => module.code === "kiosque"
      );

      if (!aKiosque) {
        // Ce dashboard est réservé au module Kiosque.
        // L'utilisateur choisira sa structure depuis la page dédiée.
        window.location.replace("/structures");
        return;
      }
      // Récupérer le kiosque associé au compte connecté.
      // Cette méthode fonctionne pour le propriétaire et le caissier.
      const kioskResponse = await fetch("/api/admin/users?action=kiosk", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const kioskResult = await kioskResponse.json();

      if (!kioskResponse.ok) {
        throw new Error(
          kioskResult.error || "Impossible de récupérer le kiosque associé au compte."
        );
      }

      const kiosk = kioskResult.kiosk;

      if (!kiosk?.id) {
        throw new Error(
          "Aucun kiosque associé à ce compte. Vérifiez le profil utilisateur."
        );
      }

      
      const { data: authResult, error: authError } =
        await supabase.auth.getUser();

      const authId = authResult?.user?.id;

      const { data: diagnosticProfile, error: profileDiagnosticError } =
        await supabase
          .from("users")
          .select("id, nom, role, kiosque_id, actif")
          .eq("id", authId)
          .maybeSingle();

      const { data: permissionResult, error: permissionError } =
        await supabase.rpc("maax_a_le_droit", {
          p_kiosque_id: kiosk.id,
          p_module: "ventes",
          p_action: "consulter",
        });

      const { data: diagnosticSales, error: diagnosticSalesError } =
        await supabase
          .from("kiosque_ventes")
          .select("id, kiosque_id, statut, montant_total")
          .eq("kiosque_id", kiosk.id);

      const { data: salesByStatus, error: salesByStatusError } =
        await supabase
          .from("kiosque_ventes")
          .select("statut")
          .eq("kiosque_id", kiosk.id);


      let query = supabase
        .from("users")
        .select("nom")
        .limit(1);

      if (user.email) {
        query = query.or(
          `email.eq.${user.email},auth_email.eq.${user.email}`
        );
      } else if (user.phone) {
        query = query.eq("telephone", user.phone);
      } else {
        throw new Error(
          "Impossible d'identifier votre compte utilisateur."
        );
      }

      const { data: profile, error: profileError } =
        await query.maybeSingle();

      if (profileError) {
        throw profileError;
      }

      setUserName(
        profile?.nom?.trim() || "Utilisateur"
      );


      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrowStart = endOfDay(now);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 6);

      const todayISO = todayStart.toISOString();
      const tomorrowISO = tomorrowStart.toISOString();
      const yesterdayISO = yesterdayStart.toISOString();
      const weekISO = weekStart.toISOString();

      // Les requêtes respectent les politiques RLS de Supabase.
      const [
        salesResult,
        purchasesResult,
        productsResult,
        cashResult,
        recentResult,
      ] = await Promise.all([
        supabase
          .from("kiosque_ventes")
          .select("id, numero, date_vente, statut, montant_total")
          .eq("kiosque_id", kiosk.id)
          .gte("date_vente", weekISO)
          .lt("date_vente", tomorrowISO)
          .eq("statut", "terminee")
          .order("date_vente", { ascending: false }),

        supabase
          .from("kiosque_achats")
          .select("id, date_achat, statut, montant_total")
          .eq("kiosque_id", kiosk.id)
          .gte("date_achat", todayISO)
          .lt("date_achat", tomorrowISO)
          .eq("statut", "recu"),

        
        supabase
          .from("kiosque_produits")
          .select("id, nom, stock_actuel, stock_minimum, unite, prix_vente")
          .eq("kiosque_id", kiosk.id)
          .eq("actif", true),

        
        supabase
          .from("kiosque_caisses")
          .select("id, solde_initial, solde_actuel")
          .eq("kiosque_id", kiosk.id)
          .eq("code", "PRINCIPALE")
          .maybeSingle(),


        // Dernières ventes terminées
        supabase
          .from("kiosque_ventes")
          .select("id, numero, date_vente, statut, montant_total")
          .eq("kiosque_id", kiosk.id)
          .eq("statut", "terminee")
          .order("date_vente", { ascending: false })
          .limit(5),
      ]);

      const queryResults = [
        salesResult,
        purchasesResult,
        productsResult,
        cashResult,
        recentResult,
      ];

      const failedQuery = queryResults.find((result) => result.error);

      if (failedQuery) {
        throw failedQuery.error;
      }

      const sales = salesResult.data || [];
      const purchases = purchasesResult.data || [];
      const products = productsResult.data || [];
      const openCash = cashResult.data;
      const latest = recentResult.data || [];

      // Chiffre d'affaires par jour, sur les 7 derniers jours.
      const chartMap = new Map();

      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);

        chartMap.set(dateKey(day), {
          date: dateKey(day),
          label: new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "2-digit",
          }).format(day),
          value: 0,
        });
      }

      for (const sale of sales) {
        const key = dateKey(sale.date_vente);
        const entry = chartMap.get(key);

        if (entry) {
          entry.value += Number(sale.montant_total || 0);
        }
      }

      const chart = Array.from(chartMap.values());

      // Totaux du jour et de la veille.
      const todaySales = sales
        .filter((sale) => sale.date_vente >= todayISO)
        .reduce(
          (sum, sale) => sum + Number(sale.montant_total || 0),
          0
        );

      const yesterdaySales = sales
        .filter(
          (sale) =>
            sale.date_vente >= yesterdayISO &&
            sale.date_vente < todayISO
        )
        .reduce(
          (sum, sale) => sum + Number(sale.montant_total || 0),
          0
        );

      const todayPurchases = purchases.reduce(
        (sum, purchase) =>
          sum + Number(purchase.montant_total || 0),
        0
      );

      // Calcul du stock total et des alertes.
      const totalStock = products.reduce(
        (sum, product) =>
          sum + Number(product.stock_actuel || 0),
        0
      );

      const alerts = products
        .filter(
          (product) =>
            Number(product.stock_actuel || 0) <=
            Number(product.stock_minimum || 0)
        )
        .sort(
          (a, b) =>
            Number(a.stock_actuel) - Number(b.stock_actuel)
        );
      
      // Solde de la caisse permanente.
      
      const cashBalance = Number(openCash?.solde_actuel || 0);



      const variation =
        yesterdaySales > 0
          ? ((todaySales - yesterdaySales) / yesterdaySales) * 100
          : null;

      // Mettre à jour l'interface uniquement après chargement...
      setStats({
        ventes: todaySales,
        achats: todayPurchases,
        stock: totalStock,
        caisse: cashBalance,
        variationVentes: variation,
        variationAchats: null,
      });

      setSalesChart(chart);
      setRecentSales(latest);
      setLowStock(alerts);
    } catch (err) {
      console.error("Erreur dashboard MonKiosk :", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  
  useEffect(() => {
    loadDashboard();

    const handleFocus = () => {
      loadDashboard(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadDashboard(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadDashboard]);


  const statistics = [
    {
      title: "Ventes du jour",
      value: stats.ventes,
      suffix: "FCFA",
      variation: stats.variationVentes,
      icon: ShoppingCart,
      iconBg: "bg-emerald-500",
      cardBg: "bg-emerald-50/40",
    },
    {
      title: "Achats du jour",
      value: stats.achats,
      suffix: "FCFA",
      variation: stats.variationAchats,
      icon: Package,
      iconBg: "bg-blue-500",
      cardBg: "bg-blue-50/40",
    },
    {
      title: "Stock total",
      value: stats.stock,
      suffix: "unités",
      variation: null,
      icon: Boxes,
      iconBg: "bg-orange-500",
      cardBg: "bg-orange-50/40",
    },
    {
      title: "Solde caisse",
      value: stats.caisse,
      suffix: "FCFA",
      variation: null,
      icon: WalletCards,
      iconBg: "bg-purple-500",
      cardBg: "bg-purple-50/40",
    },
  ];

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1450px]">
        {/* BANNIÈRE */}

        <section className="relative mb-5 min-h-[185px] overflow-hidden rounded-xl border border-orange-100 bg-[#FFF3E8]">
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#14233B] sm:text-[30px]">
                Bonjour, {userName} 👋
              </h1>

              <button
                type="button"
                onClick={() => loadDashboard(true)}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white/80 px-3 py-2 text-sm font-semibold text-[#8D4A2D] hover:bg-white disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Actualiser
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-600 sm:text-base">
              Voici un aperçu de l'activité de votre business.
            </p>

            <div className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-full bg-[#FFE4D3] px-4 py-2 text-xs font-semibold text-gray-700">
              <CalendarDays className="h-4 w-4 text-[#D9683C]" />
              {currentDate && (
                <>
                <span>{formatDate(currentDate)}</span>
                <span>•</span>
                <span>{formatTime(currentDate)}</span>
                </>
                )}
            </div>

            {loading && (
              <p className="mt-3 text-xs text-gray-500">
                Chargement des données...
              </p>
            )}
          </div>

          <div className="absolute right-0 top-0 hidden h-full w-[30%] items-center justify-center bg-[#E7C39F] lg:flex">
            <div className="text-center">
              <div className="text-[80px]">🏪</div>
              <p className="text-sm font-semibold text-[#8D4A2D]">
                Votre kiosque
              </p>
            </div>
          </div>
        </section>

        {/* ERREUR */}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">
                Impossible de charger toutes les données.
              </p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => loadDashboard(true)}
                className="mt-2 font-bold underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* STATISTIQUES */}

        <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statistics.map((stat) => (
            <StatCard key={stat.title} stat={stat} />
          ))}
        </section>

        {/* GRAPHIQUE ET VENTES */}

        <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr]">
          <SalesChart data={salesChart} />
          <RecentSales sales={recentSales} />
        </section>

        {/* RACCOURCIS ET STOCK */}

        <section
          className={`grid grid-cols-1 gap-5 ${
            dismissed
              ? ""
              : "xl:grid-cols-[1.55fr_1fr]"
          }`}
        >
          <QuickActions
            onNewSale={() => setNewSaleOpen(true)}
            onNewProduct={() => setNewProductOpen(true)}
          />

          <NewSaleModal
            open={newSaleOpen}
            onClose={() => setNewSaleOpen(false)}
            onSaved={() => loadDashboard(true)}
          />

          <NewProductModal
            open={newProductOpen}
            onClose={() => setNewProductOpen(false)}
            onSaved={() => loadDashboard(true)}
          />

          <StockAlert
            products={lowStock}
            dismissed={dismissed}
            onDismiss={() => setDismissed(true)}
          />
        </section>

        {/* FOOTER */}

        <footer className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-gray-200 py-5 text-xs text-gray-400 sm:flex-row">
          <p>
            MonKiosk <span className="mx-2">•</span>
            Plus qu'un kiosque, une gestion intelligente 🚀
          </p>
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            <span>Déployé sur Vercel</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
