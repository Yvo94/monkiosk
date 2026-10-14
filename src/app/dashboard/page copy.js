"use client";

import Link from "next/link";

import {
  ShoppingCart,
  ShoppingBag,
  Package,
  Tags,
  Boxes,
  WalletCards,
  Receipt,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Bell,
  Store,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  Grid2X2,
  FileText,
  X,
  Lightbulb,
  Cloud,
  ChevronRight,
} from "lucide-react";

/* ============================================================
   STATISTIQUES
============================================================ */

const statistics = [
  {
    title: "Ventes du jour",
    value: "125 500 FCFA",
    variation: "+18%",
    positive: true,
    icon: ShoppingCart,
    bg: "bg-emerald-50",
    iconBg: "bg-emerald-500",
  },
  {
    title: "Achats du jour",
    value: "87 000 FCFA",
    variation: "+12%",
    positive: true,
    icon: Package,
    bg: "bg-blue-50",
    iconBg: "bg-blue-500",
  },
  {
    title: "Stock total",
    value: "8 450",
    suffix: "articles",
    variation: "-2%",
    positive: false,
    icon: Boxes,
    bg: "bg-orange-50",
    iconBg: "bg-orange-500",
  },
  {
    title: "Solde caisse",
    value: "75 000 FCFA",
    variation: "+5%",
    positive: true,
    icon: WalletCards,
    bg: "bg-purple-50",
    iconBg: "bg-purple-500",
  },
];

/* ============================================================
   VENTES
============================================================ */

const sales = [
  {
    date: "10/09",
    value: 98000,
  },
  {
    date: "11/09",
    value: 76000,
  },
  {
    date: "12/09",
    value: 89000,
  },
  {
    date: "13/09",
    value: 112000,
  },
  {
    date: "14/09",
    value: 101000,
  },
  {
    date: "15/09",
    value: 125000,
  },
  {
    date: "16/09",
    value: 155000,
  },
];

/* ============================================================
   DERNIÈRES VENTES
============================================================ */

const recentSales = [
  {
    name: "Coca-Cola 50cl",
    quantity: "2 unités",
    price: "1 000 FCFA",
    time: "18:21",
    type: "drink",
  },
  {
    name: "Pain",
    quantity: "3 unités",
    price: "1 500 FCFA",
    time: "18:17",
    type: "bread",
  },
  {
    name: "Eau minérale 1,5L",
    quantity: "1 unité",
    price: "500 FCFA",
    time: "18:12",
    type: "water",
  },
  {
    name: "Biscuits",
    quantity: "2 unités",
    price: "1 200 FCFA",
    time: "18:07",
    type: "biscuit",
  },
  {
    name: "Jus naturel",
    quantity: "1 unité",
    price: "800 FCFA",
    time: "18:03",
    type: "juice",
  },
];

/* ============================================================
   PRODUITS STOCK FAIBLE
============================================================ */

const lowStock = [
  {
    name: "Coca-Cola 50cl",
    stock: 5,
  },
  {
    name: "Pain de mie",
    stock: 2,
  },
  {
    name: "Chips",
    stock: 3,
  },
];

/* ============================================================
   RACCOURCIS
============================================================ */

const shortcuts = [
  {
    title: "Nouvelle vente",
    href: "/dashboard/ventes/nouveau",
    icon: ShoppingCart,
    color: "bg-green-500",
  },
  {
    title: "Nouveau produit",
    href: "/dashboard/produits/nouveau",
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
   SIDEBAR
============================================================ */

function Sidebar() {
  const menu = [
    {
      name: "Accueil",
      href: "/dashboard",
      icon: Store,
      active: true,
    },
    {
      name: "Produits",
      href: "/dashboard/produits",
      icon: Package,
    },
    {
      name: "Catégories",
      href: "/dashboard/categories",
      icon: Tags,
    },
    {
      name: "Ventes",
      href: "/dashboard/ventes",
      icon: ShoppingCart,
    },
    {
      name: "Achats",
      href: "/dashboard/achats",
      icon: ShoppingBag,
    },
    {
      name: "Stock",
      href: "/dashboard/stock",
      icon: Boxes,
    },
    {
      name: "Caisses",
      href: "/dashboard/caisse",
      icon: WalletCards,
    },
    {
      name: "Dépenses",
      href: "/dashboard/depenses",
      icon: Receipt,
    },
    {
      name: "Statistiques",
      href: "/dashboard/statistiques",
      icon: BarChart3,
    },
    {
      name: "Utilisateurs",
      href: "/dashboard/utilisateurs",
      icon: Users,
    },
    {
      name: "Paramètres",
      href: "/dashboard/parametres",
      icon: Settings,
    },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[275px] flex-col bg-[#A9431D] text-white lg:flex">

      {/* LOGO */}

      <div className="flex h-[88px] items-center gap-3 border-b border-white/10 px-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
          🏪
        </div>

        <div>
          <h1 className="text-2xl font-bold">
            Mon<span className="text-orange-200">Kiosk</span>
          </h1>

          <p className="text-xs text-orange-100">
            Gérez votre kiosque, simplement
          </p>
        </div>
      </div>

      {/* MENU */}

      <nav className="flex-1 space-y-1 px-4 py-5">

        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex h-12 items-center gap-4 rounded-xl px-4 text-sm font-medium transition ${
                item.active
                  ? "bg-[#E96835] text-white shadow-sm"
                  : "text-orange-50 hover:bg-white/10"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />

              <span>{item.name}</span>
            </Link>
          );
        })}

      </nav>

      {/* DECONNEXION */}

      <div className="px-4 pb-4">

        <button className="flex h-12 w-full items-center gap-4 rounded-xl px-4 text-sm font-medium text-orange-50 transition hover:bg-white/10">
          <LogOut className="h-5 w-5" />
          Déconnexion
        </button>

      </div>

      {/* FOOTER SIDEBAR */}

      <div className="border-t border-white/10 px-7 py-5">

        <p className="text-sm font-medium">
          MonKiosk
        </p>

        <p className="mt-1 text-xs text-orange-200">
          v1.0.0
        </p>

      </div>

    </aside>
  );
}

/* ============================================================
   HEADER
============================================================ */

function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-[88px] items-center justify-between border-b border-gray-100 bg-white px-5 shadow-sm lg:px-8">

      {/* KIOSQUE */}

      <div className="flex items-center gap-3">

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50">
          <Store className="h-5 w-5 text-[#A9431D]" />
        </div>

        <div>
          <h2 className="text-sm font-bold text-gray-800 sm:text-base">
            Kiosque Abidjan Centre
          </h2>

          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />

            <span className="text-xs font-medium text-green-600">
              En ligne
            </span>
          </div>
        </div>

      </div>

      {/* PROFIL */}

      <div className="flex items-center gap-4">

        <button className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-50">

          <Bell className="h-5 w-5 text-gray-500" />

          <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D72855] px-1 text-[9px] font-bold text-white">
            3
          </span>

        </button>

        <div className="hidden h-8 w-px bg-gray-200 sm:block" />

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-200">
            <span className="text-sm font-bold text-gray-600">
              YR
            </span>
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-bold text-gray-800">
              Yao Roland
            </p>

            <p className="text-xs text-gray-500">
              Administrateur
            </p>
          </div>

          <ChevronRight className="hidden h-4 w-4 rotate-90 text-gray-400 sm:block" />

        </div>

      </div>

    </header>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({ stat }) {
  const Icon = stat.icon;

  return (
    <div
      className={`rounded-xl border border-gray-100 p-5 shadow-sm ${stat.bg}`}
    >

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${stat.iconBg}`}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      <p className="mt-4 text-sm font-semibold text-gray-700">
        {stat.title}
      </p>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[22px] font-bold text-[#14233B]">
          {stat.value}
        </span>

        {stat.suffix && (
          <span className="text-sm font-semibold text-gray-700">
            {stat.suffix}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">

        {stat.positive ? (
          <ArrowUpRight className="h-4 w-4 text-green-500" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-500" />
        )}

        <span
          className={`text-sm font-bold ${
            stat.positive
              ? "text-green-500"
              : "text-red-500"
          }`}
        >
          {stat.variation}
        </span>

        <span className="text-xs text-gray-500">
          vs hier
        </span>

      </div>

    </div>
  );
}

/* ============================================================
   GRAPH
============================================================ */

function SalesChart() {
  const max = 200000;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">

      <div className="mb-6 flex items-center gap-2">
        <h2 className="text-lg font-bold text-[#14233B]">
          Évolution des ventes
        </h2>

        <span className="text-sm text-gray-500">
          (7 derniers jours)
        </span>
      </div>

      <div className="relative h-[275px]">

        {/* LIGNES */}

        <div className="absolute inset-0 flex flex-col justify-between pb-8">

          {[200000, 150000, 100000, 50000, 0].map(
            (value) => (
              <div
                key={value}
                className="flex items-center gap-3"
              >

                <span className="w-12 text-right text-xs text-gray-400">
                  {value === 0
                    ? "0"
                    : `${value / 1000} 000`}
                </span>

                <div className="h-px flex-1 bg-gray-100" />

              </div>
            )
          )}

        </div>

        {/* BARRES */}

        <div className="absolute bottom-8 left-[60px] right-0 top-0 flex items-end justify-around gap-4">

          {sales.map((item) => {

            const height =
              (item.value / max) * 205;

            return (
              <div
                key={item.date}
                className="flex h-full flex-1 flex-col items-center justify-end"
              >

                <div
                  className="w-full max-w-[32px] rounded-t-sm bg-[#D9683C] transition hover:bg-[#B94C24]"
                  style={{
                    height: `${height}px`,
                  }}
                  title={`${item.value.toLocaleString(
                    "fr-FR"
                  )} FCFA`}
                />

                <span className="mt-3 text-[11px] text-gray-500">
                  {item.date}
                </span>

              </div>
            );
          })}

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   PRODUIT ICON
============================================================ */

function ProductIcon({ type }) {

  const styles = {
    drink: "🥤",
    bread: "🥖",
    water: "💧",
    biscuit: "🍪",
    juice: "🧃",
  };

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-xl">
      {styles[type]}
    </div>
  );
}

/* ============================================================
   DERNIÈRES VENTES
============================================================ */

function RecentSales() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">

      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">

        <h2 className="text-lg font-bold text-[#14233B]">
          Dernières ventes
        </h2>

        <Link
          href="/dashboard/ventes"
          className="flex items-center gap-1 text-sm font-semibold text-[#D9683C] hover:underline"
        >
          Voir tout
          <ArrowUpRight className="h-4 w-4" />
        </Link>

      </div>

      <div className="px-5">

        {recentSales.map((sale) => (
          <div
            key={`${sale.name}-${sale.time}`}
            className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"
          >

            <ProductIcon type={sale.type} />

            <div className="min-w-0 flex-1">

              <p className="truncate text-sm font-bold text-gray-800">
                {sale.name}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {sale.quantity}
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm font-semibold text-gray-700">
                {sale.price}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                {sale.time}
              </p>

            </div>

          </div>
        ))}

      </div>

    </div>
  );
}

/* ============================================================
   RACCOURCIS
============================================================ */

function QuickActions() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">

      <h2 className="text-lg font-bold text-[#14233B]">
        Raccourcis
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        Accédez rapidement aux principales fonctions
      </p>

      <div className="mt-4 grid grid-cols-4 gap-3">

        {shortcuts.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.title}
              href={item.href}
              className={`group flex min-h-[82px] flex-col items-center justify-center rounded-xl px-2 py-3 text-center text-white transition hover:-translate-y-1 hover:shadow-md ${item.color}`}
            >

              <Icon className="h-6 w-6" />

              <span className="mt-2 text-[11px] font-semibold leading-tight">
                {item.title}
              </span>

            </Link>
          );
        })}

      </div>

    </div>
  );
}

/* ============================================================
   BON À SAVOIR
============================================================ */

function StockAlert() {
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

        <button className="text-gray-500 hover:text-gray-800">
          <X className="h-5 w-5" />
        </button>

      </div>

      <p className="mt-5 text-sm font-semibold text-gray-700">
        Votre stock est faible sur 3 produits :
      </p>

      <div className="mt-4 space-y-3">

        {lowStock.map((product) => (
          <div
            key={product.name}
            className="flex items-center gap-3"
          >

            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D72855] text-[11px] font-bold text-white">
              !
            </div>

            <p className="flex-1 text-sm font-semibold text-gray-700">
              {product.name}
            </p>

            <span className="text-sm font-bold text-[#D72855]">
              ({product.stock} unités)
            </span>

          </div>
        ))}

      </div>

      <Link
        href="/dashboard/stock"
        className="mt-5 flex h-10 items-center justify-center gap-2 rounded-full bg-[#D9683C] text-sm font-semibold text-white transition hover:bg-[#B94C24]"
      >
        Voir le stock
        <ArrowUpRight className="h-4 w-4" />
      </Link>

    </div>
  );
}

/* ============================================================
   DASHBOARD
============================================================ */

export default function DashboardPage() {

  return (
    <div className="min-h-screen bg-[#F7F8FA]">

      {/* SIDEBAR */}

      <Sidebar />

      {/* CONTENU */}

      <div className="lg:pl-[275px]">

        <Header />

        <main className="px-4 py-5 sm:px-6 lg:px-8">

          <div className="mx-auto max-w-[1450px]">

            {/* ==================================================
                HERO
            ================================================== */}

            <section className="relative mb-5 min-h-[185px] overflow-hidden rounded-xl bg-[#FFF3E8]">

              <div className="relative z-10 p-6 sm:p-8">

                <h1 className="text-2xl font-bold text-[#14233B] sm:text-[30px]">
                  Bonjour, Yao Roland 👋
                </h1>

                <p className="mt-2 text-sm text-gray-600 sm:text-base">
                  Voici un aperçu de l'activité de votre kiosque aujourd'hui.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#FFE5D5] px-4 py-2 text-xs font-semibold text-gray-700">

                  <CalendarDays className="h-4 w-4 text-[#D9683C]" />

                  Mardi 16 septembre 2025

                  <span>•</span>

                  18:24

                </div>

              </div>

              {/* Illustration */}

              <div className="absolute right-0 top-0 hidden h-full w-[42%] overflow-hidden lg:block">

                <div className="absolute inset-0 bg-gradient-to-r from-[#FFF3E8] via-transparent to-transparent" />

                <div className="flex h-full items-center justify-center bg-[#E9C7A7]">

                  <div className="text-center">

                    <div className="text-7xl">
                      🏪
                    </div>

                    <p className="mt-2 text-sm font-semibold text-[#8E4A2B]">
                      Votre kiosque
                    </p>

                  </div>

                </div>

              </div>

            </section>

            {/* ==================================================
                STATISTIQUES
            ================================================== */}

            <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

              {statistics.map((stat) => (
                <StatCard
                  key={stat.title}
                  stat={stat}
                />
              ))}

            </section>

            {/* ==================================================
                GRAPHIQUE + DERNIÈRES VENTES
            ================================================== */}

            <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr]">

              <SalesChart />

              <RecentSales />

            </section>

            {/* ==================================================
                RACCOURCIS + ALERTES
            ================================================== */}

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">

              <QuickActions />

              <StockAlert />

            </section>

            {/* ==================================================
                FOOTER
            ================================================== */}

            <footer className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-gray-200 py-5 text-xs text-gray-400 sm:flex-row">

              <p>
                MonKiosk
                <span className="mx-2">•</span>
                Plus qu'un kiosque, une gestion intelligente 🚀
              </p>

              <div className="flex items-center gap-2">

                <Cloud className="h-4 w-4" />

                <span>
                  Développé par MAAX Technologies
                </span>

              </div>

            </footer>

          </div>

        </main>

      </div>

    </div>
  );
}