"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Home,
  Package,
  Tags,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  WalletCards,
  Receipt,
  BarChart3,
  Users,
  Settings,
  LogOut,
  X,
} from "lucide-react";

const menuItems = [
  {
    label: "Accueil",
    href: "/dashboard",
    icon: Home,
  },
  {
    label: "Produits",
    href: "/dashboard/produits",
    icon: Package,
  },
  {
    label: "Catégories",
    href: "/dashboard/categories",
    icon: Tags,
  },
  {
    label: "Ventes",
    href: "/dashboard/ventes",
    icon: ShoppingCart,
  },
  {
    label: "Achats",
    href: "/dashboard/achats",
    icon: ShoppingBag,
  },
  {
    label: "Stock",
    href: "/dashboard/stock",
    icon: Boxes,
  },
  {
    label: "Caisses",
    href: "/dashboard/caisse",
    icon: WalletCards,
  },
  {
    label: "Dépenses",
    href: "/dashboard/depenses",
    icon: Receipt,
  },
  {
    label: "Statistiques",
    href: "/dashboard/statistiques",
    icon: BarChart3,
  },
  {
    label: "Utilisateurs",
    href: "/dashboard/utilisateurs",
    icon: Users,
  },
  {
    label: "Paramètres",
    href: "/dashboard/parametres",
    icon: Settings,
  },
];


export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "La déconnexion a échoué."
        );
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Déconnexion MonKiosk :", error);
      setLogoutError(
        error.message || "Impossible de contacter le serveur."
      );
    } finally {
      setLoggingOut(false);
    }
  }
  const isActive = (href) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname.startsWith(href);
  };

  return (
    <>
      {/* =====================================================
          OVERLAY MOBILE
      ====================================================== */}

      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className={`
          fixed
          left-0
          top-0
          z-50
          flex
          h-screen
          w-[275px]
          flex-col
          bg-[#A94420]
          text-white
          shadow-xl
          transition-transform
          duration-300
          ease-in-out
          lg:translate-x-0
          ${
            open
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* =================================================
            LOGO
        ================================================== */}

        <div className="flex h-[88px] shrink-0 items-center border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
              🏪
            </div>

            <div>
              <h1 className="text-[23px] font-bold leading-none">
                Mon<span className="text-orange-200">Kiosk</span>
              </h1>

              <p className="mt-1 text-[11px] text-orange-100">
                Gérez votre kiosque, simplement
              </p>
            </div>
          </div>

          {/* Fermeture mobile */}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-white/80 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* =================================================
            MENU
        ================================================== */}

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <div className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex
                    h-12
                    items-center
                    gap-4
                    rounded-xl
                    px-4
                    text-sm
                    font-medium
                    transition-all
                    duration-200
                    ${
                      active
                        ? "bg-[#E96A35] text-white shadow-sm"
                        : "text-orange-50 hover:bg-white/10"
                    }
                  `}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      active
                        ? "text-white"
                        : "text-orange-100"
                    }`}
                    strokeWidth={2}
                  />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* =================================================
            DECONNEXION
        ================================================== */}

        
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex h-12 w-full items-center gap-4 rounded-xl px-4 text-sm font-medium text-orange-50 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-5 w-5 shrink-0" />

            <span>
              {loggingOut ? "Déconnexion..." : "Déconnexion"}
            </span>
          </button>

          {logoutError && (
            <p className="mt-2 px-4 text-xs text-red-100" role="alert">
              {logoutError}
            </p>
          )}
        </div>


        {/* =================================================
            FOOTER
        ================================================== */}

        <div className="shrink-0 border-t border-white/10 px-7 py-4">
          <p className="text-sm font-medium">
            MonKiosk
          </p>

          <p className="mt-1 text-[11px] text-orange-200">
            v1.0.0
          </p>
        </div>
      </aside>
    </>
  );
}