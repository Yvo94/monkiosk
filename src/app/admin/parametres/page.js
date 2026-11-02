
"use client";

import { useState } from "react";

const rubriques = [
  {
    id: "profil",
    icon: "👤",
    titre: "Profil administrateur",
    description: "Consulter et modifier les informations du compte administrateur.",
    details: ["Nom et prénom", "Téléphone", "Adresse e-mail"],
  },
  {
    id: "plateforme",
    icon: "🏢",
    titre: "Identité de la plateforme",
    description: "Configurer les informations générales de MAAX Business.",
    details: ["Nom de la plateforme", "Logo", "Coordonnées de MAAX Technologies"],
  },
  {
    id: "modules",
    icon: "⚙️",
    titre: "Gestion des modules",
    description: "Consulter les modules disponibles sur la plateforme.",
    details: ["MAAX Kiosque", "MAAX Lavage", "État des modules"],
  },
  {
    id: "securite",
    icon: "🔐",
    titre: "Sécurité du compte",
    description: "Gérer les paramètres de sécurité de votre accès administrateur.",
    details: ["Mot de passe", "Sécurité de connexion", "Accès administrateurs"],
  },
];

export default function ParametresPage() {
  const [rubriqueActive, setRubriqueActive] = useState(null);

  const rubrique = rubriques.find(
    (item) => item.id === rubriqueActive
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-7 md:px-8 md:py-10">
      {/* En-tête */}
      <div>
        <p className="text-sm font-semibold tracking-wide text-[#B18F4E]">
          CONFIGURATION
        </p>

        <h1 className="mt-1 text-2xl font-bold text-[#14233B] sm:text-3xl">
          Paramètres
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Gérez les informations et la configuration de votre plateforme
          MAAX Business.
        </p>
      </div>

      {/* Présentation */}
      <div className="overflow-hidden rounded-2xl bg-[#14233B] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#D8BD83]">
              MAAX TECHNOLOGIES
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Centre de configuration
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Retrouvez ici les différents paramètres de gestion de la
              plateforme et de votre espace d'administration.
            </p>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D8BD83]/40 bg-white/5 text-3xl">
            ⚙️
          </div>
        </div>
      </div>

      {/* Rubriques */}
      <div>
        <h2 className="mb-4 font-bold text-[#14233B]">
          Rubriques disponibles
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rubriques.map((item) => (
            <button
              key={item.id}
              onClick={() =>
                setRubriqueActive(
                  rubriqueActive === item.id ? null : item.id
                )
              }
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                rubriqueActive === item.id
                  ? "border-[#D8BD83] ring-2 ring-[#D8BD83]/20"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#14233B] text-2xl">
                  {item.icon}
                </div>

                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  À configurer
                </span>
              </div>

              <h3 className="mt-4 font-bold text-[#14233B]">
                {item.titre}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {item.description}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-medium text-slate-400">
                  {item.details.length} éléments
                </span>

                <span className="text-sm font-semibold text-[#B18F4E]">
                  {rubriqueActive === item.id
                    ? "Masquer"
                    : "Explorer"} →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Détail de la rubrique sélectionnée */}
      {rubrique && (
        <div className="rounded-2xl border border-[#D8BD83] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{rubrique.icon}</span>
            <div>
              <h3 className="font-bold text-[#14233B]">
                {rubrique.titre}
              </h3>
              <p className="text-xs text-slate-500">
                Éléments prévus pour cette rubrique
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {rubrique.details.map((detail) => (
              <div
                key={detail}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
              >
                <span className="text-sm font-medium text-slate-700">
                  {detail}
                </span>
                <span className="text-xs text-slate-400">
                  À configurer
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-400">
            Les fonctionnalités de cette rubrique seront activées
            progressivement.
          </p>
        </div>
      )}

      <p className="pt-2 text-center text-xs text-slate-400">
        MAAX Business — Administration de la plateforme
      </p>
    </div>
  );
}
