
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const WHATSAPP_NUMBER = "2250544360378";

const MODULE_NAMES = {
  kiosque: "Kiosque",
  lavage: "Lavage",
};

export default function ActivationLicencePage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [modules, setModules] = useState([]);
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =====================================================
  // CHARGEMENT DU CONTEXTE UTILISATEUR
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    async function chargerContexte() {
      try {
        const response = await fetch("/api/auth/context", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/login");
            return;
          }

          throw new Error(
            data.error || "Impossible de charger votre compte."
          );
        }

        if (!cancelled) {
          setUser(data.user);
          setModules(data.modules || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    chargerContexte();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // =====================================================
  // DEMANDE DE LICENCE SUR WHATSAPP
  // =====================================================

  function demanderLicence() {
    if (!user) return;

    if (modules.length === 0) {
        setError(
        "Aucun module n'a été trouvé sur votre compte. Veuillez contacter MAAX Technologies."
        );
        return;
    }

    setError("");

    const nomsModules = modules
        .map((module) => MODULE_NAMES[module.code] || module.code)
        .join(", ");

    const message = [
        "Bonjour MAAX Technologies,",
        "",
        "Je souhaite obtenir ma licence MAAX Business.",
        "",
        `Nom du client : ${user.nom}`,
        `Modules demandés : ${nomsModules}`,
        "",
        "Merci de me transmettre mon code d'activation.",
    ].join("\n");

    const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }

  // =====================================================
  // ACTIVATION DE LA LICENCE
  // =====================================================

  async function activerLicence(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!code.trim()) {
      setError("Veuillez saisir votre code de licence.");
      return;
    }

    setActivating(true);

    try {
      const response = await fetch("/api/licences/activation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "L'activation de votre licence a échoué."
        );
      }

      setSuccess(data.message || "Licence activée avec succès.");

      // Laisser le temps au client de voir le message.
      setTimeout(() => {
        router.replace("/structures");
        router.refresh();
      }, 1200);

    } catch (err) {
      setError(err.message);
    } finally {
      setActivating(false);
    }
  }

  // =====================================================
  // CHARGEMENT
  // =====================================================

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-600">
            Chargement de votre espace...
          </p>
        </div>
      </main>
    );
  }

  // =====================================================
  // INTERFACE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* EN-TÊTE */}

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Activation de votre licence
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            Bienvenue sur MAAX Business.
            Demandez votre code d'activation puis saisissez-le
            pour accéder à votre espace professionnel.
          </p>
        </div>

        {/* DEMANDE WHATSAPP */}

        <div className="mb-6 rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20.52 3.48A11.77 11.77 0 0 0 12.15 0C5.62 0 .3 5.31.3 11.84c0 2.09.55 4.13 1.59 5.93L.2 24l6.38-1.67a11.85 11.85 0 0 0 5.57 1.41h.01c6.53 0 11.85-5.31 11.85-11.84a11.77 11.77 0 0 0-3.49-8.42ZM12.16 21.7a9.84 9.84 0 0 1-5.02-1.38l-.36-.21-3.79.99 1.01-3.69-.24-.38a9.81 9.81 0 0 1-1.51-5.19c0-5.46 4.45-9.9 9.91-9.9a9.84 9.84 0 0 1 7.01 2.9 9.84 9.84 0 0 1 2.9 7.01c0 5.46-4.45 9.9-9.91 9.9Zm5.43-7.41c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.23-.65.08-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.67-2.06-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.51 0 1.48 1.08 2.91 1.23 3.11.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.72.64.72.23 1.37.2 1.89.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z" />
              </svg>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Étape 1 : Demander votre licence
              </h2>
              <p className="text-xs text-slate-500">
                Contactez directement notre équipe.
              </p>
            </div>
          </div>

          <p className="mb-5 text-sm leading-6 text-slate-600">
            Cliquez sur le bouton ci-dessous. Un message contenant
            les informations de votre compte et les modules demandés
            sera préparé automatiquement sur WhatsApp.
          </p>

          <button
            type="button"
            onClick={demanderLicence}
            disabled={modules.length === 0}
            className="w-full rounded-xl bg-green-600 px-5 py-3.5 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Demander ma licence sur WhatsApp
          </button>
        </div>

        {/* SAISIE DU CODE */}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">
              Étape 2 : Activer ma licence
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Saisissez le code transmis par MAAX Technologies.
            </p>
          </div>

          <form onSubmit={activerLicence}>
            <label
              htmlFor="codeLicence"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Code de licence
            </label>

            <input
              id="codeLicence"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MAAX-XXXX-XXXX..."
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-base tracking-wider uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="submit"
              disabled={activating || !code.trim()}
              className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activating
                ? "Activation en cours..."
                : "Valider et activer ma licence"}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {success}
              <p className="mt-1 text-xs">
                Redirection vers votre espace professionnel...
              </p>
            </div>
          )}
        </div>

        {/* PIED DE PAGE */}

        <p className="mt-8 text-center text-xs text-slate-500">
          MAAX Technologies · MAAX Business
          <br />
          Besoin d'assistance ? Contactez-nous au 05 44 36 03 78.
        </p>

      </div>
    </main>
  );
}
