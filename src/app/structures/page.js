"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Droplets,
  ArrowRight,
  RefreshCw,
  LogOut,
  ShieldCheck,
} from "lucide-react";

const MODULES = {
  kiosque: {
    titre: "MAAX Kiosque",
    description:
      "Gérez vos produits, ventes, achats, stocks, dépenses et caisses.",
    icone: Store,
    destination: "/dashboard",
    couleur: "from-[#14233B] to-[#263F60]",
  },
  lavage: {
    titre: "MAAX Lavage",
    description:
      "Gérez votre file de lavage, vos laveurs, vos prestations, vos clients et vos encaissements.",
    icone: Droplets,
    destination: "/dashboard/lavage",
    couleur: "from-[#087E8B] to-[#07545D]",
  },
};

export default function StructuresPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState("");
  const [error, setError] = useState("");

  async function loadStructures() {
    setLoading(true);
    setError("");

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
          result.error || "Impossible de récupérer vos structures."
        );
      }

      const authorizedModules = (result.modules || []).filter(
        (module) =>
          MODULES[module.code] &&
          module.etablissement
      );

      setUser(result.user || null);
      setModules(authorizedModules);

      if (authorizedModules.length === 0) {
        setError(
          "Aucune structure active n'est associée à votre compte. Contactez votre administrateur."
        );
      }
    } catch (err) {
      console.error("Erreur de chargement des structures :", err);
      setError(
        err.message || "Impossible de contacter le serveur."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStructures();
  }, []);

  function openStructure(module) {
    const config = MODULES[module.code];

    if (!config || selectedCode) return;

    setSelectedCode(module.code);
    router.push(config.destination);
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F4F6FA] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#D9A441]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-[#14233B]/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#14233B]">
              MAAX <span className="text-[#C99A37]">Business</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Votre activité, votre gestion, votre réussite.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-600"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        </header>

        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#C99A37]">
            <ShieldCheck size={18} />
            ESPACE PROFESSIONNEL SÉCURISÉ
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-[#14233B] sm:text-4xl">
            Bonjour{user?.nom ? `, ${user.nom}` : ""} !
          </h2>

          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
            Quelle structure souhaitez-vous gérer aujourd’hui ?
            Sélectionnez un espace pour accéder à son tableau de bord.
          </p>
        </section>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
              <RefreshCw size={20} className="animate-spin" />
              Chargement de vos structures...
            </div>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5"
          >
            <p className="font-semibold text-red-800">
              {error}
            </p>
            <button
              type="button"
              onClick={loadStructures}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#14233B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#203858]"
            >
              <RefreshCw size={16} />
              Réessayer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {modules.map((module) => {
              const config = MODULES[module.code];
              const Icon = config.icone;
              const isOpening = selectedCode === module.code;

              return (
                <button
                  key={`${module.code}-${module.etablissement.id}`}
                  type="button"
                  onClick={() => openStructure(module)}
                  disabled={Boolean(selectedCode)}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#D9B66F] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 sm:p-8"
                >
                  <div
                    className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${config.couleur} text-white shadow-lg`}
                  >
                    <Icon size={30} strokeWidth={1.8} />
                  </div>

                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#B68A31]">
                    Espace de gestion
                  </div>

                  <h3 className="text-2xl font-extrabold text-[#14233B]">
                    {module.etablissement.nom || config.titre}
                  </h3>

                  <p className="mt-2 text-sm font-medium text-slate-500">
                    {config.titre}
                  </p>

                  <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">
                    {config.description}
                  </p>

                  <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-5">
                    <span className="text-sm font-semibold text-slate-500">
                      Devise : {module.etablissement.devise || "FCFA"}
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-xl bg-[#14233B] px-4 py-3 text-sm font-bold text-white transition group-hover:bg-[#203858]">
                      {isOpening ? "Ouverture..." : "Accéder"}
                      {isOpening ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <ArrowRight
                          size={17}
                          className="transition-transform group-hover:translate-x-1"
                        />
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <footer className="mt-12 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
          © 2026 MAAX Business. Tous droits réservés.
        </footer>
      </div>
    </main>
  );
}
