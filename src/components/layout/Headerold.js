
"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  Store,
  Droplets,
} from "lucide-react";

export default function Header({ onMenuClick }) {
  const [userName, setUserName] = useState("Utilisateur");
  const [userRole, setUserRole] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [moduleName, setModuleName] = useState("MAAX Business");
  const [loadingUser, setLoadingUser] = useState(true);

  // L'état initial doit être identique côté serveur et navigateur.
  const [isOnline, setIsOnline] = useState(null);

  // Détecter la connexion uniquement après le montage.
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateOnlineStatus();

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  // Charger le profil utilisateur et le module actif.
  useEffect(() => {
    let active = true;

    async function loadUserProfile() {
      try {
        setLoadingUser(true);

        const response = await fetch("/api/auth/context", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        // Une réponse 401 signifie que la session n'est plus reconnue.
        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Impossible de récupérer le profil utilisateur."
          );
        }

        const context = await response.json();
        const modules = context.modules || [];

        const path = window.location.pathname;
        const isLavagePage = path.startsWith("/dashboard/lavage");

        const selectedModule = isLavagePage
          ? modules.find((module) => module.code === "lavage")
          : modules.find((module) => module.code === "kiosque") ||
            modules.find((module) => module.code === "lavage");

        if (active) {
          setUserName(context.user?.nom?.trim() || "Utilisateur");
          setUserRole(context.user?.role || "");

          setEstablishmentName(
            selectedModule?.etablissement?.nom?.trim() || ""
          );

          setModuleName(
            selectedModule?.code === "lavage"
              ? "MAAX Lavage"
              : selectedModule?.code === "kiosque"
                ? "MAAX Kiosque"
                : "MAAX Business"
          );
        }
      } catch (error) {
        console.error("Erreur de chargement du Header :", error);

        // Une panne réseau ne signifie pas que la session est expirée.
      } finally {
        if (active) {
          setLoadingUser(false);
        }
      }
    }

    loadUserProfile();

    return () => {
      active = false;
    };
  }, []);

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const isLavage = moduleName === "MAAX Lavage";
  const EstablishmentIcon = isLavage ? Droplets : Store;

  return (
    <header className="sticky top-0 z-30 flex h-[88px] items-center justify-between border-b border-gray-100 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isLavage ? "bg-blue-50" : "bg-orange-50"
          }`}
        >
          <EstablishmentIcon
            className={`h-5 w-5 ${
              isLavage ? "text-blue-700" : "text-[#A94420]"
            }`}
          />
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-[#17243A] sm:text-xl">
            {loadingUser
              ? "Chargement..."
              : establishmentName
                ? `Bienvenue chez - ${establishmentName}`
                : moduleName}
          </h2>

          {/* Indicateur de connexion compatible avec l'hydratation */}
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isOnline === null
                  ? "bg-gray-400"
                  : isOnline
                    ? "bg-green-500"
                    : "bg-red-500"
              }`}
            />

            <span
              className={`text-xs font-medium ${
                isOnline === null
                  ? "text-gray-500"
                  : isOnline
                    ? "text-green-600"
                    : "text-red-600"
              }`}
            >
              {isOnline === null
                ? "Vérification..."
                : isOnline
                  ? "En ligne"
                  : "Hors connexion"}
            </span>
          </div>
        </div>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-50"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />

          <span className="absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#D72855] px-1 text-[9px] font-bold text-white">
            3
          </span>
        </button>

        <div className="hidden h-8 w-px bg-gray-200 sm:block" />

        <button
          type="button"
          className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-gray-50 sm:gap-3"
          aria-label="Profil utilisateur"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D9E1E8]">
            <span className="text-xs font-bold text-[#40505E]">
              {loadingUser ? "..." : initials || "U"}
            </span>
          </div>

          <div className="hidden max-w-[180px] text-left sm:block">
            <p className="truncate text-sm font-bold leading-5 text-[#17243A]">
              {loadingUser ? "Chargement..." : userName}
            </p>

            <p className="truncate text-xs text-gray-500">
              {userRole || moduleName}
            </p>
          </div>

          <ChevronDown className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block" />
        </button>
      </div>
    </header>
  );
}
