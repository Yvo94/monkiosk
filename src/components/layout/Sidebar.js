"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Brand from "@/components/Brand";

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
  { label: "Accueil", href: "/dashboard", icon: Home },
  { label: "Produits", href: "/dashboard/produits", icon: Package },
  { label: "Catégories", href: "/dashboard/categories", icon: Tags },
  { label: "Ventes", href: "/dashboard/ventes", icon: ShoppingCart },
  { label: "Achats", href: "/dashboard/achats", icon: ShoppingBag },
  { label: "Stock", href: "/dashboard/stock", icon: Boxes },
  { label: "Caisses", href: "/dashboard/caisse", icon: WalletCards },
  { label: "Dépenses", href: "/dashboard/depenses", icon: Receipt },
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

  const isActive = (href) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "La déconnexion a échoué.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Déconnexion MAAX Business :", error);

      setLogoutError(
        error.message || "Impossible de contacter le serveur."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50
          flex h-screen w-[275px] flex-col
          border-r border-white/10
          bg-[#111C2E] text-white shadow-2xl
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo et identité */}
        <div className="flex h-[88px] shrink-0 items-center border-b border-white/10 px-5">
          <div className="min-w-0 flex-1">
            <Brand />
          </div>

          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={onClose}
            className="ml-2 rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          aria-label="Navigation principale"
          className="flex-1 overflow-y-auto px-4 py-5"
        >
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Espace de gestion
          </p>

          <div className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`
                    group relative flex h-11 items-center gap-3
                    overflow-hidden rounded-xl px-3.5
                    text-sm font-medium
                    transition-all duration-200
                    ${
                      active
                        ? "bg-[#D9A45B]/15 text-[#F1C98F]"
                        : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                    }
                  `}
                >
                  {active && (
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#D9A45B]" />
                  )}

                  <Icon
                    className={`
                      h-[19px] w-[19px] shrink-0 transition-colors
                      ${
                        active
                          ? "text-[#D9A45B]"
                          : "text-slate-400 group-hover:text-slate-200"
                      }
                    `}
                    strokeWidth={1.8}
                  />

                  <span>{item.label}</span>

                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#D9A45B]" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Déconnexion */}
        <div className="px-4 pb-3">
          {logoutError && (
            <p
              className="mb-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200"
              role="alert"
            >
              {logoutError}
            </p>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="
              flex h-11 w-full items-center gap-3 rounded-xl px-3.5
              text-sm font-medium text-slate-300
              transition hover:bg-red-500/10 hover:text-red-300
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            <LogOut className="h-[19px] w-[19px] shrink-0" />

            <span>
              {loggingOut ? "Déconnexion..." : "Déconnexion"}
            </span>
          </button>
        </div>

        {/* Pied de page */}
        <div className="shrink-0 border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#D9A45B]" />
            <p className="text-xs font-semibold tracking-wide text-slate-200">
              MAAX Business
            </p>
            <span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
              v1.0.0
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Pilotez. Gérez. Développez.
          </p>
        </div>
      </aside>
    </>
  );
}