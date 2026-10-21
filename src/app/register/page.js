
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-[#14233B] outline-none transition placeholder:text-slate-400 focus:border-[#D8BD83] focus:bg-white focus:ring-4 focus:ring-[#D8BD83]/15";

const labelClass = "block text-sm font-semibold text-[#14233B]";

const modulesDisponibles = [
  {
    code: "kiosque",
    nom: "Kiosque",
    description: "Boutique, commerce, restaurant et supermarché.",
    details: ["Ventes et encaissements", "Produits et stocks", "Achats et dépenses"],
    symbole: "K",
  },
  {
    code: "lavage",
    nom: "Lavage Auto",
    description: "Gérez votre station de lavage automobile.",
    details: ["Prestations et tarifs", "Véhicules et clients", "Suivi des encaissements"],
    symbole: "L",
  },
];

function normalizePhone(value) {
  let phone = String(value || "")
    .trim()
    .replace(/[\s().-]/g, "");

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
  const [nomLavage, setNomLavage] = useState("");
  const [nomProprietaire, setNomProprietaire] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [devise, setDevise] = useState("FCFA");

  // Kiosque reste sélectionné par défaut pour les inscriptions classiques.
  const [modules, setModules] = useState(["kiosque"]);
  const [step, setStep] = useState("owner");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isOwnerStep = step === "owner";
  const isStructureStep = step === "structure";
  const progress = isOwnerStep ? 50 : 100;
  const aKiosque = modules.includes("kiosque");
  const aLavage = modules.includes("lavage");

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function toggleModule(code) {
    clearFeedback();

    setModules((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
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

    if (modules.length === 0) {
      setError("Sélectionne au moins une activité pour continuer.");
      return;
    }

    if (aKiosque && !nomKiosque.trim()) {
      setError("Renseigne le nom de ton établissement Kiosque.");
      return;
    }

    if (aLavage && !nomLavage.trim()) {
      setError("Renseigne le nom de ta station de lavage.");
      return;
    }

    if (
      (aKiosque && nomKiosque.trim().length > 150) ||
      (aLavage && nomLavage.trim().length > 150)
    ) {
      setError("Le nom de chaque établissement ne doit pas dépasser 150 caractères.");
      return;
    }

    setLoading(true);

    const phone = normalizePhone(whatsapp);

    try {
      const registerResponse = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomProprietaire: nomProprietaire.trim(),
          nomKiosque: aKiosque ? nomKiosque.trim() : "",
          nomLavage: aLavage ? nomLavage.trim() : "",
          modules,
          whatsapp: phone,
          email: email.trim(),
          motDePasse,
          devise,
        }),
      });

      const registerResult = await registerResponse.json().catch(() => ({}));

      if (!registerResponse.ok) {
        throw new Error(
          registerResult.error ||
            "Impossible de créer le compte. Vérifie les informations saisies."
        );
      }

      // Connexion automatique après création du compte.
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

      if (!loginResponse.ok) {
        router.replace("/login?inscription=success");
        return;
      }

      router.replace("/structures");
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

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F6F9] px-4 py-8 sm:px-6 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#D8BD83]/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#14233B]/5 blur-3xl"
      />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_90px_rgba(20,35,59,0.12)] lg:grid-cols-[0.78fr_1.22fr]">
        {/* Panneau de marque */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#14233B] p-10 text-white lg:flex xl:p-12">
          <div
            aria-hidden="true"
            className="absolute -right-28 top-32 h-80 w-80 rounded-full border border-[#D8BD83]/20"
          />
          <div
            aria-hidden="true"
            className="absolute -right-12 top-48 h-48 w-48 rounded-full border border-[#D8BD83]/15"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[#D8BD83]/5 blur-2xl"
          />

          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D8BD83]/50 bg-[#D8BD83]/10 text-2xl font-bold text-[#D8BD83]">
              M
            </div>
            <div>
              <p className="text-xl font-bold tracking-[0.18em]">MAAX</p>
              <p className="text-[10px] font-semibold tracking-[0.35em] text-[#D8BD83]">
                BUSINESS
              </p>
            </div>
          </div>

          <div className="relative my-12">
            <div className="mb-5 h-1 w-14 rounded-full bg-[#D8BD83]" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8BD83]">
              Votre espace professionnel
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight xl:text-[42px]">
              Une gestion plus simple.
              <br />
              <span className="text-[#D8BD83]">Des ambitions plus grandes.</span>
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-7 text-slate-300">
              Centralisez les outils de votre activité dans un espace conçu
              pour vous aider à piloter votre entreprise au quotidien.
            </p>

            <div className="mt-9 space-y-4">
              {[
                ["01", "Un espace dédié à votre entreprise"],
                ["02", "Des outils adaptés à votre activité"],
                ["03", "Une gestion claire de vos opérations"],
              ].map(([numero, texte]) => (
                <div key={numero} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D8BD83]/30 bg-white/5 text-[11px] font-bold text-[#D8BD83]">
                    {numero}
                  </span>
                  <span className="text-sm text-slate-200">{texte}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative border-t border-white/10 pt-5">
            <p className="text-xs text-slate-400">
              MAAX Business · Votre activité, mieux gérée.
            </p>
          </div>
        </aside>

        {/* Formulaire */}
        <section className="px-5 py-7 sm:px-9 sm:py-10 lg:px-12 xl:px-14">
          <div className="mx-auto max-w-xl">
            <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#14233B] text-xl font-bold text-[#D8BD83]">
                  M
                </div>
                <div>
                  <p className="font-bold tracking-[0.15em] text-[#14233B]">MAAX</p>
                  <p className="text-[10px] font-semibold tracking-[0.3em] text-[#B3975C]">
                    BUSINESS
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-[#D8BD83]/40 bg-[#D8BD83]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8B7447]">
                Inscription
              </span>
            </div>

            <div className="mb-7">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B3975C]">
                Rejoignez MAAX Business
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#14233B] sm:text-[34px]">
                {isOwnerStep ? "Créons votre compte." : "Parlez-nous de votre activité."}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
                {isOwnerStep
                  ? "Commencez par vos informations personnelles. Elles vous permettront d'accéder à votre espace."
                  : "Choisissez les activités que vous souhaitez gérer et personnalisez votre espace professionnel."}
              </p>
            </div>

            {/* Progression */}
            <div className="mb-8 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                      isStructureStep
                        ? "bg-[#14233B] text-[#D8BD83]"
                        : "bg-[#14233B] text-white"
                    }`}
                  >
                    {isStructureStep ? "✓" : "1"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#14233B]">Propriétaire</p>
                    <p className="text-xs text-slate-500">Vos coordonnées</p>
                  </div>
                </div>

                <div className="h-px flex-1 bg-slate-200" />

                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                      isStructureStep
                        ? "bg-[#14233B] text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    2
                  </span>
                  <div className="hidden sm:block">
                    <p className={`text-sm font-semibold ${isStructureStep ? "text-[#14233B]" : "text-slate-400"}`}>
                      Activités
                    </p>
                    <p className="text-xs text-slate-500">Votre espace</p>
                  </div>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#14233B] to-[#D8BD83] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Étape 1 */}
            {isOwnerStep && (
              <form
                key="owner"
                onSubmit={handleContinue}
                className="space-y-5 animate-in fade-in slide-in-from-left-3 duration-300"
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
                    Utilisé pour vous identifier et accéder à votre compte.
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>
                    Adresse e-mail{" "}
                    <span className="font-normal text-slate-400">(facultatif)</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-[#14233B]"
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
                  className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#14233B] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#14233B]/10 transition hover:-translate-y-0.5 hover:bg-[#203653]"
                >
                  Continuer
                  <span className="text-lg text-[#D8BD83] transition-transform group-hover:translate-x-1">→</span>
                </button>
              </form>
            )}

            {/* Étape 2 */}
            {isStructureStep && (
              <form
                key="structure"
                onSubmit={handleRegister}
                className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300"
              >
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#14233B]">
                        Quelles activités souhaitez-vous gérer ?
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Sélectionnez une ou plusieurs activités.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#14233B]/5 px-3 py-1 text-xs font-semibold text-[#14233B]">
                      {modules.length} sélectionnée{modules.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {modulesDisponibles.map((item) => {
                      const selected = modules.includes(item.code);

                      return (
                        <button
                          key={item.code}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleModule(item.code)}
                          className={`relative flex h-full flex-col rounded-2xl border p-4 text-left transition duration-200 ${
                            selected
                              ? "border-[#D8BD83] bg-[#D8BD83]/10 shadow-[0_8px_25px_rgba(216,189,131,0.12)] ring-1 ring-[#D8BD83]/50"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex w-full items-start justify-between gap-3">
                            <span
                              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${
                                selected
                                  ? "bg-[#14233B] text-[#D8BD83]"
                                  : "bg-slate-100 text-[#14233B]"
                              }`}
                            >
                              {item.symbole}
                            </span>
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold transition ${
                                selected
                                  ? "border-[#14233B] bg-[#14233B] text-[#D8BD83]"
                                  : "border-slate-300 text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                          </div>

                          <span className="mt-4 text-base font-bold text-[#14233B]">
                            {item.nom}
                          </span>
                          <span className="mt-1 min-h-10 text-xs leading-5 text-slate-500">
                            {item.description}
                          </span>

                          <span className="my-3 h-px w-full bg-slate-200/80" />

                          <span className="space-y-2">
                            {item.details.map((detail) => (
                              <span
                                key={detail}
                                className="flex items-start gap-2 text-xs leading-5 text-slate-600"
                              >
                                <span className={selected ? "text-[#B3975C]" : "text-slate-400"}>✓</span>
                                {detail}
                              </span>
                            ))}
                          </span>

                          <span
                            className={`mt-4 rounded-lg px-3 py-2 text-center text-xs font-bold ${
                              selected
                                ? "bg-[#14233B] text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {selected ? "Activité sélectionnée" : "Sélectionner cette activité"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {aKiosque && (
                  <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14233B] font-bold text-[#D8BD83]">
                        K
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#14233B]">Votre espace Kiosque</p>
                        <p className="text-xs text-slate-500">Boutique, commerce ou restaurant</p>
                      </div>
                    </div>
                    <label htmlFor="nomKiosque" className={labelClass}>
                      Nom de l'établissement *
                    </label>
                    <input
                      id="nomKiosque"
                      autoComplete="organization"
                      className={inputClass}
                      value={nomKiosque}
                      onChange={(e) => setNomKiosque(e.target.value)}
                      placeholder="Ex. : Le Petit Marché"
                      maxLength={150}
                      required={aKiosque}
                      autoFocus
                    />
                  </div>
                )}

                {aLavage && (
                  <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14233B] font-bold text-[#D8BD83]">
                        L
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#14233B]">Votre espace Lavage auto</p>
                        <p className="text-xs text-slate-500">Gestion de votre station de lavage</p>
                      </div>
                    </div>
                    <label htmlFor="nomLavage" className={labelClass}>
                      Nom de la station *
                    </label>
                    <input
                      id="nomLavage"
                      autoComplete="organization"
                      className={inputClass}
                      value={nomLavage}
                      onChange={(e) => setNomLavage(e.target.value)}
                      placeholder="Ex. : Auto Clean Abidjan"
                      maxLength={150}
                      required={aLavage}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="devise" className={labelClass}>
                    Devise de vos espaces *
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

                {/* Récapitulatif */}
                <div className="overflow-hidden rounded-2xl border border-[#D8BD83]/50 bg-gradient-to-br from-[#D8BD83]/10 to-white">
                  <div className="border-b border-[#D8BD83]/30 px-4 py-3 sm:px-5">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8B7447]">
                      Récapitulatif de l'inscription
                    </p>
                  </div>

                  <div className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="text-slate-500">Propriétaire</span>
                      <strong className="text-right text-[#14233B]">{nomProprietaire.trim()}</strong>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="text-slate-500">WhatsApp</span>
                      <strong className="text-right text-[#14233B]">{normalizePhone(whatsapp)}</strong>
                    </div>
                    {email.trim() && (
                      <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span className="text-slate-500">E-mail</span>
                        <strong className="max-w-[65%] break-all text-right text-[#14233B]">{email.trim()}</strong>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="text-slate-500">Activités choisies</span>
                      <strong className="text-right text-[#14233B]">
                        {modulesDisponibles
                          .filter((item) => modules.includes(item.code))
                          .map((item) => item.nom)
                          .join(" + ") || "Aucune"}
                      </strong>
                    </div>

                    {aKiosque && (
                      <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span className="text-slate-500">Espace Kiosque</span>
                        <strong className="text-right text-[#14233B]">{nomKiosque.trim() || "À renseigner"}</strong>
                      </div>
                    )}
                    {aLavage && (
                      <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span className="text-slate-500">Espace Lavage</span>
                        <strong className="text-right text-[#14233B]">{nomLavage.trim() || "À renseigner"}</strong>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-between gap-2 border-t border-[#D8BD83]/30 pt-3 text-sm">
                      <span className="text-slate-500">Devise</span>
                      <strong className="text-[#14233B]">{devise}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-[#14233B] transition hover:border-[#D8BD83] hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span>←</span>
                    Retour
                  </button>

                  <button
                    type="submit"
                    disabled={loading || modules.length === 0}
                    className="group flex min-h-14 flex-[1.6] items-center justify-center gap-3 rounded-xl bg-[#14233B] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#14233B]/10 transition hover:-translate-y-0.5 hover:bg-[#203653] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Création en cours...
                      </>
                    ) : (
                      <>
                        Créer mon espace
                        <span className="text-lg text-[#D8BD83] transition-transform group-hover:translate-x-1">→</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-center text-xs leading-5 text-slate-400">
                  Chaque activité sélectionnée disposera de son propre espace
                  et de sa caisse principale indépendante.
                </p>
              </form>
            )}

            {error && (
              <div
                role="alert"
                className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
              >
                <span className="font-bold">!</span>
                <span>{error}</span>
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
              <span className="text-xs text-slate-400">Déjà inscrit ?</span>
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

            <p className="mt-8 text-center text-xs leading-5 text-slate-400">
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
