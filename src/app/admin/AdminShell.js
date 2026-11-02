
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const navigation = [
  {
    label: "Tableau de bord",
    href: "/admin",
    icon: "▦",
  },
  {
    label: "Licences",
    href: "/admin/licences",
    icon: "🔑",
  },
  {
    label: "Clients",
    href: "/admin/clients",
    icon: "👥",
  },
  {
    label: "Paramètres",
    href: "/admin/parametres",
    icon: "⚙",
  },
];

export default function AdminShell({
  children,
  userLabel,
  adminRole,
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  function isActive(href) {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    const confirmed = window.confirm(
      "Voulez-vous vraiment vous déconnecter de l'administration ?"
    );

    if (!confirmed) return;

    setIsLoggingOut(true);
    setLogoutError("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Erreur de déconnexion :", error);
      setLogoutError(
        "La déconnexion a échoué. Veuillez réessayer."
      );
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">

      {/* MENU LATÉRAL DESKTOP */}
      <aside className="hidden w-72 shrink-0 flex-col bg-[#14233B] text-white lg:flex">

        <div className="border-b border-white/10 px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D8BD83] text-xl font-black text-[#14233B]">
              M
            </div>

            <div>
              <p className="text-lg font-extrabold tracking-wide">
                MAAX BUSINESS
              </p>
              <p className="text-xs font-medium tracking-widest text-[#D8BD83]">
                ADMINISTRATION
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-8">
          <p className="mb-4 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Menu principal
          </p>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-[#D8BD83] text-[#14233B] shadow-md"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="w-6 text-center text-lg">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-[#D8BD83]">
              MAAX TECHNOLOGIES
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Plateforme centralisée de gestion des licences et des clients
              MAAX Business.
            </p>
          </div>
        </div>
      </aside>

      {/* ZONE PRINCIPALE */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* EN-TÊTE */}
        <header className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm md:px-8">
          <div className="flex items-center justify-between gap-4">

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#14233B] lg:hidden">
                MAAX BUSINESS
              </p>

              <p className="hidden text-sm text-slate-500 lg:block">
                Espace d'administration
              </p>

              <p className="mt-1 text-sm font-semibold text-[#14233B]">
                Gestion de la plateforme
              </p>
            </div>

            <div className="flex items-center gap-3">

              <div className="hidden text-right sm:block">
                <p className="text-xs text-slate-500">
                  Administrateur connecté
                </p>
                <p className="max-w-48 truncate text-sm font-semibold text-[#14233B]">
                  {userLabel || "Administrateur"}
                </p>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#14233B] font-bold text-[#D8BD83]">
                {(userLabel || "A").charAt(0).toUpperCase()}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>↪</span>
                <span>
                  {isLoggingOut ? "Déconnexion..." : "Déconnexion"}
                </span>
              </button>

            </div>
          </div>

          {logoutError && (
            <p className="mt-3 text-right text-xs font-medium text-red-600">
              {logoutError}
            </p>
          )}
        </header>

        {/* NAVIGATION MOBILE */}
        <div className="border-b border-slate-200 bg-white px-3 py-3 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navigation.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-[#14233B] text-[#D8BD83]"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* CONTENU DE LA PAGE */}
        <main className="min-w-0 flex-1">
          {children}
        </main>

        {/* PIED DE PAGE */}
        <footer className="border-t border-slate-200 bg-white px-5 py-4 text-center text-xs text-slate-400">
          MAAX Business Administration · MAAX Technologies
        </footer>

      </div>
    </div>
  );
}
