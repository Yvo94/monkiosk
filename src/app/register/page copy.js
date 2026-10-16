
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

function normalizePhone(value) {
  const input = value.trim().replace(/[\s().-]/g, "");

  if (input.startsWith("+")) return input;
  if (input.startsWith("225")) return `+${input}`;

  if (/^\d{10}$/.test(input)) {
    return `+225${input}`;
  }

  return input;
}

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [step, setStep] = useState("register");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const normalizedPhone = normalizePhone(phone);

    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError("Saisis un numéro de téléphone valide.");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signupError } =
        await supabase.auth.signUp({
          phone: normalizedPhone,
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
          },
        });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      if (data.user) {
        setPendingPhone(normalizedPhone);
        setStep("verify");
        setMessage(
          "Un code de confirmation peut avoir été envoyé selon ta configuration Supabase."
        );
      } else {
        setMessage(
          "Vérifie la configuration d'authentification de ton projet Supabase."
        );
      }
    } catch {
      setError("Impossible de créer le compte. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Saisis le code à 6 chiffres reçu par SMS.");
      return;
    }

    setLoading(true);

    try {
      const { error: verifyError } =
        await supabase.auth.verifyOtp({
          phone: pendingPhone,
          token: otp.trim(),
          type: "sms",
        });

      if (verifyError) {
        setError("Code invalide ou expiré. Vérifie le code reçu.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("La confirmation a échoué. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-[#EEE5DF]">
        <h1 className="text-3xl font-bold text-center text-[#332824]">
          Créer un compte MonKiosk
        </h1>

        <p className="mt-2 text-center text-sm text-gray-500">
          Utilise ton numéro WhatsApp pour accéder à ton espace.
        </p>

        {step === "register" ? (
          <form onSubmit={handleRegister} className="mt-8 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">
                Nom complet
              </label>
              <input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#A94420]"
                placeholder="Ton nom"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                Numéro WhatsApp
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#A94420]"
                placeholder="+225 07 00 00 00 00"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#A94420]"
                placeholder="8 caractères minimum"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#A94420]"
                placeholder="Répète le mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#A94420] py-3 font-semibold text-white hover:bg-[#873719] disabled:opacity-60"
            >
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-8 space-y-4">
            <p className="text-sm text-gray-600">
              Numéro : <strong>{pendingPhone}</strong>
            </p>

            <label htmlFor="otp" className="block text-sm font-medium">
              Code de confirmation SMS
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#A94420]"
              placeholder="123456"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#A94420] py-3 font-semibold text-white hover:bg-[#873719] disabled:opacity-60"
            >
              {loading ? "Vérification..." : "Confirmer mon numéro"}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-semibold text-[#A94420] hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
