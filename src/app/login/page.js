
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Phone,
  Store,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telephone: phone,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error || "Identifiant ou mot de passe incorrect."
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Erreur de connexion :", error);
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F6FA] px-4 py-8 sm:px-6">
      {/* Décoration de fond */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#D9A441]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-[#14233B]/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Identité MAAX Business */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14233B] text-[#E5B85C] shadow-lg shadow-[#14233B]/20">
            <Store size={30} strokeWidth={1.8} />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-[#14233B]">
            MAAX <span className="text-[#C99A37]">Business</span>
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Votre activité, votre gestion, votre réussite.
          </p>
        </div>

        {/* Carte de connexion */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-[#14233B]/[0.07] sm:p-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-[#14233B]">
              Bienvenue !
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Connectez-vous pour accéder à votre espace de gestion.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Numéro WhatsApp */}
            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Numéro WhatsApp
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 transition focus-within:border-[#C99A37] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#C99A37]/10">
                <Phone
                  size={19}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  className="w-full bg-transparent py-3.5 text-sm text-[#14233B] outline-none placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Mot de passe
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 transition focus-within:border-[#C99A37] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#C99A37]/10">
                <LockKeyhole
                  size={19}
                  className="shrink-0 text-slate-400"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="w-full bg-transparent py-3.5 text-sm text-[#14233B] outline-none placeholder:text-slate-400"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  className="shrink-0 text-slate-400 transition hover:text-[#14233B]"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* Erreur de connexion */}
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-5 text-red-700"
              >
                {error}
              </p>
            )}

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#14233B] py-3.5 font-semibold text-white shadow-md shadow-[#14233B]/15 transition duration-200 hover:bg-[#203858] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
            
            <div className="mt-6 text-center text-sm text-gray-600">
              Vous n’avez pas encore de compte ?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#D9683C] transition hover:text-[#B94C24] hover:underline"
              >
                Créer un compte
              </Link>
            </div>

          </form>

          {/* Mention de sécurité */}
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
            <ShieldCheck size={15} className="text-[#C99A37]" />
            <span>Accès sécurisé à votre espace professionnel</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 MAAX Business. Tous droits réservés.
        </p>
      </div>
    </main>
  );
}
