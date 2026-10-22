"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  LockKeyhole,
  Droplets,
  CarFront,
  ClipboardList,
  UserRound,
  ArrowLeftRight,
  Building2,
} from "lucide-react";

const kioskMenuItems = [
  { label: "Accueil", href: "/dashboard", icon: Home },
  { label: "Catégories", href: "/dashboard/categories", icon: Tags },
  { label: "Produits", href: "/dashboard/produits", icon: Package },
  { label: "Ventes", href: "/dashboard/ventes", icon: ShoppingCart },
  { label: "Achats", href: "/dashboard/achats", icon: ShoppingBag },
  { label: "Dépenses", href: "/dashboard/depenses", icon: Receipt },
  { label: "Stock", href: "/dashboard/stock", icon: Boxes },
  { label: "Caisses", href: "/dashboard/caisse", icon: WalletCards },
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

const lavageMenuItems = [
  {
    label: "Vue d'ensemble",
    href: "/dashboard/lavage",
    icon: Home,
  },
  {
    label: "Prestations",
    href: "/dashboard/lavage/services",
    icon: CarFront,
  },
  /*{
    label: "File de lavage",
    href: "/dashboard/lavage/file",
    icon: ClipboardList,
  },
  {
    label: "Historique des prestations",
    href: "/dashboard/lavage/historique",
    icon: Receipt,
  },*/
  {
    label: "Laveurs",
    href: "/dashboard/lavage/equipe",
    icon: Users,
  },
  {
    label: "Types de véhicules",
    href: "/dashboard/lavage/vehicules",
    icon: CarFront,
  },
  {
    label: "Types de lavage",
    href: "/dashboard/lavage/types-lavage",
    icon: Droplets,
  },
  {
    label: "Tarifs",
    href: "/dashboard/lavage/tarifs",
    icon: Tags,
  },
  /*{
    label: "Clients",
    href: "/dashboard/lavage/clients",
    icon: UserRound,
  },
  {
    label: "Encaissements",
    href: "/dashboard/lavage/encaissements",
    icon: WalletCards,
  },*/
  {
    label: "Dépenses",
    href: "/dashboard/lavage/depense",
    icon: ShoppingBag,
  },
  {
    label: "Statistiques",
    href: "/dashboard/lavage/statistiques",
    icon: BarChart3,
  },
  /*{
    label: "Caisses",
    href: "/dashboard/lavage/configuration/caisses",
    icon: WalletCards,
  },*/
  {
    label: "Paramètres",
    href: "/dashboard/lavage/configuration/Parametres",
    icon: Settings,
  },
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [navHovered, setNavHovered] = useState(false);

  const [role, setRole] = useState(null);
  const [modules, setModules] = useState([]);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUserContext() {
      setRoleLoading(true);
      setRoleError("");

      try {
        const response = await fetch("/api/auth/context", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Impossible de récupérer votre profil."
          );
        }

        if (!cancelled) {
          setRole(result.user?.role || null);
          setModules(result.modules || []);
        }
      } catch (error) {
        console.error("Chargement du contexte MAAX Business :", error);

        if (!cancelled) {
          setRoleError(
            error.message || "Impossible de charger votre profil."
          );
        }
      } finally {
        if (!cancelled) {
          setRoleLoading(false);
        }
      }
    }

    loadUserContext();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const hasKiosk = modules.some(
    (module) => module.code === "kiosque"
  );

  const hasLavage = modules.some(
    (module) => module.code === "lavage"
  );

  // Le menu dépend du tableau de bord actuellement ouvert.
  const isLavageRoute =
    pathname === "/dashboard/lavage" ||
    pathname.startsWith("/dashboard/lavage/");

  const currentModule = isLavageRoute ? "lavage" : "kiosque";
  const hasCurrentModule =
    currentModule === "lavage" ? hasLavage : hasKiosk;

  const currentMenu =
    currentModule === "lavage" ? lavageMenuItems : kioskMenuItems;

  const currentModuleTitle =
    currentModule === "lavage" ? "Gestion du lavage" : "Gestion du kiosque";

  const isActive = (href) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    if (href === "/dashboard/lavage") {
      return pathname === "/dashboard/lavage";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
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

  function handleChangeStructure() {
    onClose?.();
    router.push("/structures");
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

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
        {/* Identité */}
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

        {/* Structure et changement d'espace */}
        <div className="border-b border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 px-1">
            {currentModule === "lavage" ? (
              <Droplets className="h-5 w-5 text-[#D9A45B]" />
            ) : (
              <Building2 className="h-5 w-5 text-[#D9A45B]" />
            )}

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Espace actuel
              </p>
              <p className="truncate text-sm font-semibold text-white">
                {currentModule === "lavage" ? "Lavage" : "Kiosque"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleChangeStructure}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-[#D9A45B]/40 hover:bg-[#D9A45B]/10 hover:text-[#F1C98F]"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Changer de structure
          </button>
        </div>

        {/* Navigation métier */}
        <nav
          aria-label="Navigation principale"
          onMouseEnter={() => setNavHovered(true)}
          onMouseLeave={() => setNavHovered(false)}
          className={`sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 ${
            navHovered ? "sidebar-scroll-active" : ""
          }`}
        >
          {roleLoading ? (
            <p className="px-3 py-3 text-sm text-slate-400">
              Chargement du menu...
            </p>
          ) : roleError ? (
            <p
              className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-3 text-xs leading-relaxed text-red-200"
              role="alert"
            >
              {roleError} Rechargez la page ou reconnectez-vous.
            </p>
          ) : !hasCurrentModule ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
              <p className="text-xs leading-relaxed text-amber-200">
                Vous n'avez pas accès à cet espace.
              </p>
              <button
                type="button"
                onClick={handleChangeStructure}
                className="mt-3 text-xs font-bold text-[#F1C98F] underline"
              >
                Choisir une autre structure
              </button>
            </div>
          ) : (
            <section>
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {role === "caissier" && currentModule === "kiosque"
                  ? "Espace caisse"
                  : currentModuleTitle}
              </p>

              <div className="space-y-1.5">
                {currentMenu.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  // Restriction visuelle conservée pour le caissier Kiosque.
                  const locked =
                    role === "caissier" &&
                    currentModule === "kiosque" &&
                    item.href !== "/dashboard/ventes";

                  const menuClassName = `
                    group relative flex h-11 items-center gap-3
                    overflow-hidden rounded-xl px-3.5
                    text-sm font-medium transition-all duration-200
                    ${
                      locked
                        ? "cursor-not-allowed text-slate-500 opacity-50"
                        : active
                          ? "bg-[#D9A45B]/15 text-[#F1C98F]"
                          : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                    }
                  `;

                  const content = (
                    <>
                      {active && !locked && (
                        <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#D9A45B]" />
                      )}

                      <Icon
                        className={`
                          h-[19px] w-[19px] shrink-0 transition-colors
                          ${
                            locked
                              ? "text-slate-500"
                              : active
                                ? "text-[#D9A45B]"
                                : "text-slate-400 group-hover:text-slate-200"
                          }
                        `}
                        strokeWidth={1.8}
                      />

                      <span>{item.label}</span>

                      {locked ? (
                        <span
                          className="ml-auto text-slate-500"
                          title="Accès réservé"
                        >
                          <LockKeyhole className="h-4 w-4" />
                        </span>
                      ) : active ? (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#D9A45B]" />
                      ) : null}
                    </>
                  );

                  if (locked) {
                    return (
                      <div
                        key={item.href}
                        aria-disabled="true"
                        title="Accès réservé à un autre profil."
                        className={menuClassName}
                      >
                        {content}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={menuClassName}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
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
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
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
