
"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  Store,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

export default function Header({ onMenuClick }) {
  const [userName, setUserName] = useState("Utilisateur");
  const [userRole, setUserRole] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let active = true;

    const loadUserProfile = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          if (active) {
            setUserName("Utilisateur");
            setUserRole("");
          }
          return;
        }

        const user = session.user;

        let query = supabase
          .from("users")
          .select("nom, role")
          .limit(1);

        if (user.email) {
          query = query.or(
            `email.eq.${user.email},auth_email.eq.${user.email}`
          );
        } else if (user.phone) {
          query = query.eq("telephone", user.phone);
        } else {
          if (active) {
            setUserName("Utilisateur");
            setUserRole("");
          }
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await query.maybeSingle();

        if (profileError) throw profileError;

        if (active) {
          setUserName(
            profile?.nom?.trim() || "Utilisateur"
          );

          setUserRole(profile?.role || "");
        }
      } catch (error) {
        console.error(
          "Erreur de récupération du profil :",
          error
        );

        if (active) {
          setUserName("Utilisateur");
          setUserRole("");
        }
      } finally {
        if (active) {
          setLoadingUser(false);
        }
      }
    };

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

  return (
    <header className="sticky top-0 z-30 flex h-[88px] items-center justify-between border-b border-gray-100 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      {/* GAUCHE */}

      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50">
          <Store className="h-5 w-5 text-[#A94420]" />
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-[#17243A] sm:text-base">
            Kiosque - PAMYA Lavage Auto - Daloa, 2ème rue Fadiga
          </h2>

          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-green-600">
              En ligne
            </span>
          </div>
        </div>
      </div>

      {/* DROITE */}

      <div className="ml-3 flex shrink-0 items-center gap-2 sm:gap-4">
        {/* Notifications */}

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

        {/* UTILISATEUR */}

        <button
          type="button"
          className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-gray-50 sm:gap-3"
          aria-label="Profil utilisateur"
        >
          {/* Avatar avec initiales dynamiques */}

          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D9E1E8]">
            <span className="text-xs font-bold text-[#40505E]">
              {loadingUser ? "..." : initials || "U"}
            </span>
          </div>

          {/* Nom et rôle provenant de public.users */}

          <div className="hidden max-w-[180px] text-left sm:block">
            <p className="truncate text-sm font-bold leading-5 text-[#17243A]">
              {loadingUser ? "Chargement..." : userName}
            </p>

            <p className="truncate text-xs text-gray-500">
              {userRole || "Utilisateur MonKiosk"}
            </p>
          </div>

          <ChevronDown className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block" />
        </button>
      </div>
    </header>
  );
}
