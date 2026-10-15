
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
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

function normalizePhone(value) {
  const input = value.trim().replace(/[\s().-]/g, "");

  if (input.startsWith("+")) {
    return input;
  }

  if (input.startsWith("225")) {
    return `+${input}`;
  }

  // Numéro ivoirien saisi au format national
  if (/^\d{10}$/.test(input)) {
    return `+225${input}`;
  }

  return input;
}


export default function LoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /*
  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    const normalizedPhone = normalizePhone(phone);

    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError(
        "Saisis un numéro valide avec l'indicatif du pays."
      );
      return;
    }

    if (!password) {
      setError("Saisis ton mot de passe.");
      return;
    }

    setLoading(true);

    try {
      const { error: authError } =
        await supabase.auth.signInWithPassword({
          phone: normalizedPhone,
          password,
        });

      if (authError) {
        setError(
          "Connexion impossible. Vérifie ton numéro et ton mot de passe."
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  }
  */
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
    <main className="min-h-screen bg-[#FAF7F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-[#EEE5DF]">
        <div className="flex justify-center mb-5">
          <div className="rounded-2xl bg-[#A94420] p-4 text-white">
            <Store size={30} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-[#332824]">
          MonKiosk
        </h1>

        <p className="mt-2 text-center text-sm text-gray-500">
          Connecte-toi avec ton numéro WhatsApp
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Numéro WhatsApp
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-4 focus-within:border-[#A94420]">
              <Phone size={19} className="text-gray-400" />

              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225 07 00 00 00 00"
                className="w-full py-3 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Mot de passe
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-4 focus-within:border-[#A94420]">
              <LockKeyhole
                size={19}
                className="text-gray-400"
              />

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ton mot de passe"
                className="w-full py-3 outline-none"
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
                className="text-gray-500"
              >
                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#A94420] py-3 font-semibold text-white transition hover:bg-[#873719] disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
          {/*
        <p className="mt-6 text-center text-sm text-gray-600">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#A94420] hover:underline"
          >
            Créer un compte
          </Link>
        </p>
        */}
      </div>
    </main>
  );
}

