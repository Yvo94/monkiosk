
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const modulesDisponibles = [
  {
    id: "kiosque",
    nom: "MAAX Kiosque",
    description: "Gestion commerciale et des kiosques.",
    icone: "🏪",
  },
  {
    id: "lavage",
    nom: "MAAX Lavage",
    description: "Gestion des centres de lavage automobile.",
    icone: "🚗",
  },
];

const dureesDisponibles = [
  { value: "30", label: "1 mois (30 jours)" },
  { value: "90", label: "3 mois (90 jours)" },
  { value: "180", label: "6 mois (180 jours)" },
  { value: "365", label: "12 mois (365 jours)" },
  { value: "730", label: "24 mois (730 jours)" },
];

export default function LicencesPage() {
  const [typeClient, setTypeClient] = useState("existant");

  const [recherche, setRecherche] = useState("");
  const [clients, setClients] = useState([]);
  const [clientSelectionne, setClientSelectionne] = useState(null);
  const [rechercheLoading, setRechercheLoading] = useState(false);

  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");

  const [modules, setModules] = useState(["kiosque"]);
  const [duree, setDuree] = useState("365");

  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const [licence, setLicence] = useState(null);
  const [copie, setCopie] = useState(false);

  // Recherche automatique des propriétaires
  useEffect(() => {
    if (typeClient !== "existant") return;

    if (recherche.trim().length < 3) {
      setClients([]);
      setRechercheLoading(false);
      return;
    }

    let annule = false;

    const timer = setTimeout(async () => {
      setRechercheLoading(true);

      try {
        const response = await fetch(
          `/api/admin/clients?q=${encodeURIComponent(recherche.trim())}`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Erreur de recherche.");
        }

        if (!annule) {
          setClients(result.clients || []);
        }
      } catch {
        if (!annule) setClients([]);
      } finally {
        if (!annule) setRechercheLoading(false);
      }
    }, 350);

    return () => {
      annule = true;
      clearTimeout(timer);
    };
  }, [recherche, typeClient]);

  function changerType(type) {
    setTypeClient(type);
    setRecherche("");
    setClients([]);
    setClientSelectionne(null);
    setClientNom("");
    setClientTelephone("");
    setErreur("");
    setLicence(null);
    setCopie(false);
  }

  function toggleModule(module) {
    setModules((previous) =>
      previous.includes(module)
        ? previous.filter((item) => item !== module)
        : [...previous, module]
    );
  }

  async function genererLicence(e) {
    e.preventDefault();

    setErreur("");
    setLicence(null);
    setCopie(false);

    if (modules.length === 0) {
      setErreur("Sélectionne au moins un module.");
      return;
    }

    if (typeClient === "existant" && !clientSelectionne) {
      setErreur("Recherche et sélectionne un propriétaire.");
      return;
    }

    if (
      typeClient === "nouveau" &&
      (!clientNom.trim() || !clientTelephone.trim())
    ) {
      setErreur("Renseigne le nom et le téléphone du nouveau client.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/licences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type_client: typeClient,
          proprietaire_id:
            typeClient === "existant"
              ? clientSelectionne.id
              : null,
          client_nom: clientNom,
          client_telephone: clientTelephone,
          modules,
          duree_jours: Number(duree),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur de génération.");
      }

      setLicence(result);

      if (typeClient === "nouveau") {
        setClientNom("");
        setClientTelephone("");
      }
    } catch (error) {
      setErreur(error.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function copierCode() {
    if (!licence?.code) return;

    try {
      await navigator.clipboard.writeText(licence.code);
      setCopie(true);
    } catch {
      setErreur("Impossible de copier le code automatiquement.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-7 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">

        {/* EN-TÊTE DE PAGE */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#14233B] transition hover:text-[#B99A5C]"
          >
            <span>←</span>
            Retour au tableau de bord
          </Link>

          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B99A5C]">
                Administration MAAX Business
              </p>

              <h1 className="mt-2 text-2xl font-extrabold text-[#14233B] md:text-3xl">
                Gestion des licences
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                Créez et attribuez des licences aux clients pour leur donner
                accès aux modules MAAX Business.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-xl border border-[#D8BD83]/50 bg-[#D8BD83]/10 px-4 py-3 sm:self-auto">
              <span className="text-xl">🔑</span>
              <div>
                <p className="text-xs font-semibold text-[#14233B]">
                  Gestion sécurisée
                </p>
                <p className="text-[11px] text-slate-500">
                  Codes d'activation
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENU PRINCIPAL */}
        <div className="grid items-start gap-6 lg:grid-cols-5">

          {/* FORMULAIRE */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-3">

            <div className="border-b border-slate-100 bg-[#14233B] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D8BD83] text-xl text-[#14233B]">
                  ＋
                </div>

                <div>
                  <h2 className="font-bold text-white">
                    Générer une nouvelle licence
                  </h2>
                  <p className="mt-1 text-xs text-slate-300">
                    Renseignez les informations nécessaires.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={genererLicence} className="space-y-7 p-5 md:p-7">

              {/* TYPE DE CLIENT */}
              <div>
                <label className="mb-3 block text-sm font-bold text-[#14233B]">
                  01. Type de client
                </label>

                <div className="grid gap-3 sm:grid-cols-2">

                  <button
                    type="button"
                    onClick={() => changerType("existant")}
                    className={`rounded-xl border p-4 text-left transition ${
                      typeClient === "existant"
                        ? "border-[#D8BD83] bg-[#D8BD83]/10 ring-1 ring-[#D8BD83]"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">👥</span>
                      {typeClient === "existant" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#14233B] text-xs text-white">
                          ✓
                        </span>
                      )}
                    </div>

                    <p className="mt-3 font-bold text-[#14233B]">
                      Client existant
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Rechercher un propriétaire déjà inscrit.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => changerType("nouveau")}
                    className={`rounded-xl border p-4 text-left transition ${
                      typeClient === "nouveau"
                        ? "border-[#D8BD83] bg-[#D8BD83]/10 ring-1 ring-[#D8BD83]"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">➕</span>
                      {typeClient === "nouveau" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#14233B] text-xs text-white">
                          ✓
                        </span>
                      )}
                    </div>

                    <p className="mt-3 font-bold text-[#14233B]">
                      Nouveau client
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Préparer une licence avant son inscription.
                    </p>
                  </button>
                </div>
              </div>

              {/* CLIENT EXISTANT */}
              {typeClient === "existant" && (
                <div>
                  <label className="mb-3 block text-sm font-bold text-[#14233B]">
                    02. Rechercher un propriétaire
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                      🔍
                    </span>

                    <input
                      type="text"
                      value={recherche}
                      onChange={(e) => {
                        setRecherche(e.target.value);
                        setClientSelectionne(null);
                      }}
                      placeholder="Nom ou numéro de téléphone..."
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/20"
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    Saisissez au moins 3 caractères pour lancer la recherche.
                  </p>

                  {rechercheLoading && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#14233B]" />
                      Recherche en cours...
                    </div>
                  )}

                  {!rechercheLoading &&
                    recherche.trim().length >= 3 &&
                    clients.length === 0 &&
                    !clientSelectionne && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Aucun propriétaire actif trouvé.
                      </div>
                    )}

                  {clients.length > 0 && !clientSelectionne && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Résultats de recherche
                        </p>
                      </div>

                      {clients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setClientSelectionne(client);
                            setClients([]);
                            setRecherche("");
                          }}
                          className="w-full border-b border-slate-100 p-4 text-left transition last:border-b-0 hover:bg-[#D8BD83]/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#14233B]">
                                {client.nom}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {client.telephone || "Téléphone non renseigné"}
                              </p>
                            </div>

                            <span className="shrink-0 text-sm font-bold text-[#14233B]">
                              Sélectionner →
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {clientSelectionne && (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-green-800">
                          ✓ Propriétaire sélectionné
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            setClientSelectionne(null);
                            setRecherche("");
                          }}
                          className="text-xs font-semibold text-[#14233B] underline"
                        >
                          Changer
                        </button>
                      </div>

                      <p className="font-bold text-slate-800">
                        {clientSelectionne.nom}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {clientSelectionne.telephone || "Téléphone non renseigné"}
                      </p>

                      <p className="mt-2 break-all text-[11px] text-slate-400">
                        Identifiant : {clientSelectionne.id}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* NOUVEAU CLIENT */}
              {typeClient === "nouveau" && (
                <div>
                  <label className="mb-3 block text-sm font-bold text-[#14233B]">
                    02. Informations du nouveau client
                  </label>

                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Nom du client ou de l'entreprise
                      </label>

                      <input
                        type="text"
                        value={clientNom}
                        onChange={(e) => setClientNom(e.target.value)}
                        placeholder="Ex : Entreprise ABC"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/20"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Téléphone WhatsApp
                      </label>

                      <input
                        type="tel"
                        value={clientTelephone}
                        onChange={(e) => setClientTelephone(e.target.value)}
                        placeholder="+225 07 XX XX XX XX"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/20"
                      />
                    </div>

                    <div className="rounded-lg bg-[#14233B]/5 p-3">
                      <p className="text-xs leading-relaxed text-slate-600">
                        Cette licence sera préparée sans propriétaire associé.
                        Le rattachement sera effectué lors de son activation,
                        selon les règles de validation prévues.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULES */}
              <div>
                <label className="mb-3 block text-sm font-bold text-[#14233B]">
                  03. Modules à attribuer
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  {modulesDisponibles.map((module) => {
                    const selectionne = modules.includes(module.id);

                    return (
                      <label
                        key={module.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                          selectionne
                            ? "border-[#D8BD83] bg-[#D8BD83]/10"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectionne}
                          onChange={() => toggleModule(module.id)}
                          className="mt-1 h-4 w-4 accent-[#14233B]"
                        />

                        <span className="text-2xl">{module.icone}</span>

                        <span className="min-w-0">
                          <span className="block font-bold text-[#14233B]">
                            {module.nom}
                          </span>

                          <span className="mt-1 block text-xs text-slate-500">
                            {module.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  Vous pouvez sélectionner un ou plusieurs modules.
                </p>
              </div>

              {/* DURÉE */}
              <div>
                <label className="mb-3 block text-sm font-bold text-[#14233B]">
                  04. Durée de validité
                </label>

                <select
                  value={duree}
                  onChange={(e) => setDuree(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/20"
                >
                  {dureesDisponibles.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ERREUR */}
              {erreur && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  <p className="font-semibold">Une erreur est survenue</p>
                  <p className="mt-1">{erreur}</p>
                </div>
              )}

              {/* BOUTON */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-5 py-4 text-sm font-extrabold text-[#14233B] shadow-sm transition hover:bg-[#E6CE98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#14233B]/30 border-t-[#14233B]" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <span>＋</span>
                    Générer la licence
                  </>
                )}
              </button>

            </form>
          </section>

          {/* PANNEAU RÉSULTAT */}
          <section className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14233B] text-lg text-[#D8BD83]">
                    🔐
                  </div>

                  <div>
                    <h2 className="font-bold text-[#14233B]">
                      Résultat de génération
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Informations de votre licence.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6">

                {!licence && (
                  <div className="py-12 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#D8BD83]/15 text-4xl">
                      🔑
                    </div>

                    <h3 className="mt-5 font-bold text-[#14233B]">
                      Aucune licence générée
                    </h3>

                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                      Le code d'activation et les détails de la licence
                      apparaîtront ici après la génération.
                    </p>
                  </div>
                )}

                {licence && (
                  <div className="space-y-5">

                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-sm text-white">
                          ✓
                        </span>

                        <p className="font-bold text-green-800">
                          Licence générée avec succès
                        </p>
                      </div>

                      <p className="mt-2 text-xs text-green-700">
                        Statut initial : Disponible
                      </p>
                    </div>

                    {/* CODE */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Code d'activation
                      </label>

                      <div className="mt-2 break-all rounded-xl border border-[#D8BD83] bg-[#14233B] p-5 text-center font-mono text-base font-bold tracking-wide text-[#D8BD83]">
                        {licence.code}
                      </div>

                      <button
                        type="button"
                        onClick={copierCode}
                        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                          copie
                            ? "border-green-300 bg-green-50 text-green-700"
                            : "border-[#14233B] text-[#14233B] hover:bg-[#14233B] hover:text-white"
                        }`}
                      >
                        {copie ? "✓ Code copié !" : "Copier le code d'activation"}
                      </button>

                      <div className="mt-3 rounded-lg bg-amber-50 p-3">
                        <p className="text-xs leading-relaxed text-amber-800">
                          Attention : ce code ne sera plus récupérable après
                          avoir quitté cette page. Conservez-le et transmettez-le
                          au client de manière sécurisée.
                        </p>
                      </div>
                    </div>

                    {/* INFORMATIONS */}
                    <div className="border-t border-slate-100 pt-5">
                      <h3 className="mb-4 text-sm font-bold text-[#14233B]">
                        Détails de la licence
                      </h3>

                      <div className="space-y-3 text-sm">

                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Client</span>
                          <span className="text-right font-semibold text-slate-800">
                            {licence.licence.client_nom || "Non renseigné"}
                          </span>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Téléphone</span>
                          <span className="text-right font-semibold text-slate-800">
                            {licence.licence.client_telephone || "Non renseigné"}
                          </span>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">
                            Propriétaire associé
                          </span>
                          <span className="text-right font-semibold text-slate-800">
                            {licence.licence.proprietaire_id
                              ? "Oui"
                              : "En attente d'activation"}
                          </span>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Modules</span>
                          <span className="text-right font-semibold text-slate-800">
                            {licence.licence.modules.join(" + ")}
                          </span>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Durée</span>
                          <span className="font-semibold text-slate-800">
                            {licence.licence.duree_jours} jours
                          </span>
                        </div>

                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {/* AIDE */}
            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold text-[#14233B]">
                Informations importantes
              </h3>

              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-500">
                <li>• Chaque code d'activation est généré de manière sécurisée.</li>
                <li>• Une licence peut contenir plusieurs modules.</li>
                <li>• La durée commence selon les règles d'activation de la licence.</li>
                <li>• Le code généré doit être conservé en lieu sûr.</li>
              </ul>
            </div>

          </section>
        </div>
      </div>
    </div>
  );
}
