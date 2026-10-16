
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-[#14233B] outline-none transition placeholder:text-slate-400 focus:border-[#D8BD83] focus:bg-white focus:ring-4 focus:ring-[#D8BD83]/15";

const labelClass = "block text-sm font-semibold text-[#14233B]";

function normalizePhone(value) {
  let phone = String(value || "")
    .trim()
    .replace(/[\s().-]/g, "");

  // Conserver la même normalisation que les API existantes.
  if (/^0\d{9}$/.test(phone)) {
    phone = `+225${phone}`;
  } else if (/^225\d{10}$/.test(phone)) {
    phone = `+${phone}`;
  } else if (/^\d{10}$/.test(phone)) {
    phone = `+225${phone}`;
  }

  return phone;
}

export default function RegisterPage() {
  const router = useRouter();

  const [nomKiosque, setNomKiosque] = useState("");
  const [nomProprietaire, setNomProprietaire] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [devise, setDevise] = useState("FCFA");

  const [step, setStep] = useState("owner");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function validateOwner() {
    const phone = normalizePhone(whatsapp);

    if (!nomProprietaire.trim()) {
      setError("Renseigne le nom complet du propriétaire.");
      return false;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setError("Saisis un numéro WhatsApp valide avec son indicatif.");
      return false;
    }

    if (
      email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      setError("Saisis une adresse e-mail valide.");
      return false;
    }

    if (motDePasse.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return false;
    }

    if (motDePasse !== confirmation) {
      setError("Les mots de passe ne correspondent pas.");
      return false;
    }

    return true;
  }

  function handleContinue(e) {
    e.preventDefault();
    clearFeedback();

    if (!validateOwner()) return;

    setWhatsapp(normalizePhone(whatsapp));
    setStep("structure");
  }

  function handleBack() {
    clearFeedback();
    setStep("owner");
  }

  async function handleRegister(e) {
    e.preventDefault();
    clearFeedback();

    if (!validateOwner()) {
      setStep("owner");
      return;
    }

    if (!nomKiosque.trim()) {
      setError("Renseigne le nom de la structure.");
      return;
    }

    if (nomKiosque.trim().length > 150) {
      setError(
        "Le nom de la structure ne doit pas dépasser 150 caractères."
      );
      return;
    }

    setLoading(true);

    const phone = normalizePhone(whatsapp);

    try {
      // 1. Création du propriétaire et de sa structure côté serveur.
      const registerResponse = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomProprietaire: nomProprietaire.trim(),
          nomKiosque: nomKiosque.trim(),
          whatsapp: phone,
          email: email.trim(),
          motDePasse,
          devise,
        }),
      });

      const registerResult = await registerResponse
        .json()
        .catch(() => ({}));

      if (!registerResponse.ok) {
        throw new Error(
          registerResult.error ||
            "Impossible de créer le compte. Vérifie les informations saisies."
        );
      }

      // 2. Connexion automatique avec le numéro WhatsApp.
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telephone: phone,
          password: motDePasse,
        }),
      });

      const loginResult = await loginResponse
        .json()
        .catch(() => ({}));

      if (!loginResponse.ok) {
        // Le compte existe déjà : proposer la connexion manuelle.
        router.replace("/login?inscription=success");
        return;
      }

      // 3. Accès au tableau de bord.
      setMessage("Compte créé avec succès.");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err.message ||
          "Une erreur est survenue pendant la création du compte."
      );
    } finally {
      setLoading(false);
    }
  }

  const isOwnerStep = step === "owner";
  const isStructureStep = step === "structure";
  const progress = isOwnerStep ? 50 : 100;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F6F9] px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#D8BD83]/15 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#14233B]/5 blur-3xl"
      />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_80px_rgba(20,35,59,0.10)] lg:grid-cols-[0.8fr_1.2fr]">
        {/* Identité MAAX Business */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#14233B] p-10 text-white lg:flex xl:p-12">
          <div
            aria-hidden="true"
            className="absolute -right-24 top-32 h-72 w-72 rounded-full border border-[#D8BD83]/20"
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D8BD83]/50 bg-[#D8BD83]/10 text-2xl font-bold text-[#D8BD83]">
                M
              </div>

              <div>
                <p className="text-xl font-bold tracking-[0.18em]">
                  MAAX
                </p>
                <p className="text-[10px] font-semibold tracking-[0.35em] text-[#D8BD83]">
                  BUSINESS
                </p>
              </div>
            </div>
          </div>

          <div className="relative my-12">
            <div className="mb-5 h-1 w-14 rounded-full bg-[#D8BD83]" />

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8BD83]">
              Votre espace professionnel
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-tight xl:text-5xl">
              Donnez une
              <br />
              nouvelle dimension
              <br />
              <span className="text-[#D8BD83]">
                à votre activité.
              </span>
            </h1>

            <p className="mt-6 max-w-sm text-sm leading-7 text-slate-300">
              Gérez votre structure, vos ventes, vos stocks et vos
              opérations depuis une plateforme pensée pour votre activité.
            </p>

            <div className="mt-9 space-y-4 text-sm text-slate-200">
              {[
                "Un espace dédié à votre structure",
                "Une gestion centralisée",
                "Des outils pour suivre votre activité",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#D8BD83]/40 text-xs text-[#D8BD83]">
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="relative border-t border-white/10 pt-5 text-xs text-slate-400">
            MAAX Business · Votre activité, mieux gérée.
          </p>
        </aside>

        {/* Formulaire */}
        <section className="px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#14233B] text-xl font-bold text-[#D8BD83]">
                M
              </div>

              <div>
                <p className="font-bold tracking-[0.15em] text-[#14233B]">
                  MAAX
                </p>
                <p className="text-[10px] font-semibold tracking-[0.3em] text-[#B3975C]">
                  BUSINESS
                </p>
              </div>
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B3975C]">
              Rejoignez MAAX Business
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#14233B]">
              {isOwnerStep && "Créer le compte propriétaire"}
              {isStructureStep && "Créer votre structure"}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {isOwnerStep &&
                "Étape 1 sur 2 — Identité et connexion"}
              {isStructureStep &&
                "Étape 2 sur 2 — Informations de votre activité"}
            </p>

            {/* Progression */}
            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between text-xs font-semibold">
                <span
                  className={
                    isOwnerStep
                      ? "text-[#14233B]"
                      : "text-[#B3975C]"
                  }
                >
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#14233B] text-white">
                    {isStructureStep ? "✓" : "1"}
                  </span>
                  Propriétaire
                </span>

                <span
                  className={
                    isStructureStep
                      ? "text-[#14233B]"
                      : "text-slate-400"
                  }
                >
                  <span
                    className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full ${
                      isStructureStep
                        ? "bg-[#14233B] text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    2
                  </span>
                  Structure
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#14233B] to-[#D8BD83] transition-all duration-500 ease-in-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Étape 1 : propriétaire */}
            {isOwnerStep && (
              <form
                key="owner"
                onSubmit={handleContinue}
                className="mt-8 space-y-5 animate-in fade-in slide-in-from-left-3 duration-300"
              >
                <div>
                  <label htmlFor="nomProprietaire" className={labelClass}>
                    Nom complet du propriétaire *
                  </label>
                  <input
                    id="nomProprietaire"
                    autoComplete="name"
                    className={inputClass}
                    value={nomProprietaire}
                    onChange={(e) => setNomProprietaire(e.target.value)}
                    placeholder="Nom et prénoms"
                    maxLength={120}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="whatsapp" className={labelClass}>
                    Numéro WhatsApp *
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    autoComplete="tel"
                    className={inputClass}
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="0700000000 ou +2250700000000"
                    title="Numéro ivoirien à 10 chiffres ou numéro international avec indicatif"
                    required
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Un numéro ivoirien à 10 chiffres ou un numéro
                    international avec indicatif.
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>
                    Adresse e-mail
                    <span className="ml-2 font-normal text-slate-400">
                      (facultatif)
                    </span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="proprietaire@exemple.com"
                    maxLength={254}
                  />
                </div>

                <div>
                  <label htmlFor="motDePasse" className={labelClass}>
                    Mot de passe *
                  </label>

                  <div className="relative">
                    <input
                      id="motDePasse"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className={`${inputClass} pr-24`}
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      minLength={8}
                      maxLength={128}
                      required
                      placeholder="8 caractères minimum"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-[#14233B]"
                    >
                      {showPassword ? "Masquer" : "Afficher"}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmation" className={labelClass}>
                    Confirmer le mot de passe *
                  </label>
                  <input
                    id="confirmation"
                    type="password"
                    autoComplete="new-password"
                    className={inputClass}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    minLength={8}
                    maxLength={128}
                    required
                    placeholder="Répétez le mot de passe"
                  />
                </div>

                <button
                  type="submit"
                  className="flex min-h-13 w-full items-center justify-center gap-3 rounded-xl bg-[#14233B] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#14233B]/10 transition hover:bg-[#203653]"
                >
                  Continuer vers la structure
                  <span className="text-lg text-[#D8BD83]">→</span>
                </button>
              </form>
            )}

            {/* Étape 2 : structure */}
            {isStructureStep && (
              <form
                key="structure"
                onSubmit={handleRegister}
                className="mt-8 space-y-5 animate-in fade-in slide-in-from-right-3 duration-300"
              >
                <div>
                  <label htmlFor="nomKiosque" className={labelClass}>
                    Nom de la structure *
                  </label>
                  <input
                    id="nomKiosque"
                    autoComplete="organization"
                    className={inputClass}
                    value={nomKiosque}
                    onChange={(e) => setNomKiosque(e.target.value)}
                    placeholder="Ex. : Mon commerce"
                    maxLength={150}
                    required
                    autoFocus
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Le nom commercial de votre boutique, restaurant,
                    lavage auto ou autre activité.
                  </p>
                </div>

                <div>
                  <label htmlFor="devise" className={labelClass}>
                    Devise de la structure *
                  </label>
                  <select
                    id="devise"
                    className={inputClass}
                    value={devise}
                    onChange={(e) => setDevise(e.target.value)}
                    required
                  >
                    <option value="FCFA">FCFA (XOF)</option>
                  </select>
                </div>

                <div className="rounded-xl border border-[#D8BD83]/40 bg-[#D8BD83]/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8B7447]">
                    Récapitulatif
                  </p>

                  <p className="mt-2 text-sm text-[#14233B]">
                    <span className="text-slate-500">Propriétaire :</span>{" "}
                    <strong>{nomProprietaire}</strong>
                  </p>

                  <p className="mt-1 text-sm text-[#14233B]">
                    <span className="text-slate-500">WhatsApp :</span>{" "}
                    <strong>{normalizePhone(whatsapp)}</strong>
                  </p>

                  {email.trim() && (
                    <p className="mt-1 break-all text-sm text-[#14233B]">
                      <span className="text-slate-500">E-mail :</span>{" "}
                      <strong>{email.trim()}</strong>
                    </p>
                  )}

                  <p className="mt-1 text-sm text-[#14233B]">
                    <span className="text-slate-500">Devise :</span>{" "}
                    <strong>{devise}</strong>
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-[#14233B] transition hover:border-[#D8BD83] hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span>←</span>
                    Retour
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex min-h-13 flex-[1.5] items-center justify-center gap-3 rounded-xl bg-[#14233B] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#14233B]/10 transition hover:bg-[#203653] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Création en cours...
                      </>
                    ) : (
                      <>
                        Créer mon espace
                        <span className="text-lg text-[#D8BD83]">→</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-center text-xs leading-5 text-slate-400">
                  Votre compte propriétaire et votre structure seront
                  créés après validation de cette étape.
                </p>
              </form>
            )}

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
              >
                {error}
              </div>
            )}

            {message && (
              <div
                role="status"
                className="mt-5 rounded-xl border border-[#D8BD83]/40 bg-[#D8BD83]/10 p-4 text-sm leading-6 text-[#66532F]"
              >
                {message}
              </div>
            )}

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">
                Déjà inscrit ?
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <p className="text-center text-sm text-slate-600">
              Vous avez déjà un compte ?{" "}
              <Link
                href="/login"
                className="font-bold text-[#14233B] underline decoration-[#D8BD83] decoration-2 underline-offset-4 hover:text-[#B3975C]"
              >
                Se connecter
              </Link>
            </p>

            <p className="mt-8 text-center text-xs text-slate-400">
              © 2026 MAAX Business
              <br />
              Votre activité, mieux gérée.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
