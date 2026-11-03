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
  { value: "1", label: "24 heures (1 jour)" },
  { value: "7", label: "1 semaine (7 jours)" },
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

  const [historique, setHistorique] = useState([]);
  const [historiqueLoading, setHistoriqueLoading] = useState(false);
  const [historiqueErreur, setHistoriqueErreur] = useState("");
  const [rechercheHistorique, setRechercheHistorique] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [filtreClient, setFiltreClient] = useState("tous");
  const [codesVisibles, setCodesVisibles] = useState({});

  // Rattachement des licences orphelines
  const [licenceARattacher, setLicenceARattacher] = useState(null);
  const [rechercheRattachement, setRechercheRattachement] = useState("");
  const [clientsRattachement, setClientsRattachement] = useState([]);
  const [clientRattachement, setClientRattachement] = useState(null);
  const [rechercheRattachementLoading, setRechercheRattachementLoading] =
    useState(false);
  const [rattachementLoading, setRattachementLoading] = useState(false);
  const [erreurRattachement, setErreurRattachement] = useState("");

  // Désactivation des licences
  const [licenceDesactivationId, setLicenceDesactivationId] = useState(null);

  async function chargerHistorique() {
    setHistoriqueLoading(true);
    setHistoriqueErreur("");

    try {
      const response = await fetch("/api/admin/licences");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de charger l'historique.");
      }

      setHistorique(result.historique || []);
    } catch (error) {
      setHistoriqueErreur(error.message || "Erreur de chargement.");
    } finally {
      setHistoriqueLoading(false);
    }
  }

  useEffect(() => {
    chargerHistorique();
  }, []);

  // --------------------------------------------------
  // RECHERCHE DES CLIENTS
  // --------------------------------------------------

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

        if (!annule) setClients(result.clients || []);
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

  async function rechercherClientRattachement(valeur) {
    setRechercheRattachement(valeur);
    setClientRattachement(null);
    setErreurRattachement("");

    if (valeur.trim().length < 3) {
      setClientsRattachement([]);
      return;
    }

    setRechercheRattachementLoading(true);

    try {
      const response = await fetch(
        `/api/admin/clients?q=${encodeURIComponent(valeur.trim())}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur de recherche.");
      }

      setClientsRattachement(result.clients || []);
    } catch (error) {
      setClientsRattachement([]);
      setErreurRattachement(error.message || "Erreur de recherche.");
    } finally {
      setRechercheRattachementLoading(false);
    }
  }

  // --------------------------------------------------
  // GÉNÉRATION D'UNE LICENCE
  // --------------------------------------------------

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_client: typeClient,
          proprietaire_id:
            typeClient === "existant" ? clientSelectionne.id : null,
          client_nom: typeClient === "nouveau" ? clientNom.trim() : null,
          client_telephone:
            typeClient === "nouveau" ? clientTelephone.trim() : null,
          modules,
          duree_jours: Number(duree),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur de génération.");
      }

      setLicence(result);
      await chargerHistorique();

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

  async function copierCodeHistorique(code) {
    try {
      await navigator.clipboard.writeText(code);
      alert("Code d'activation copié !");
    } catch {
      alert("Impossible de copier le code.");
    }
  }

  // --------------------------------------------------
  // PARTAGE WHATSAPP
  // --------------------------------------------------

  function partagerLicence(item) {
    if (!item.code) {
      alert("Le code de cette ancienne licence n'est pas disponible.");
      return;
    }

    const modulesLibelles = (item.modules || [])
      .map((module) =>
        module === "kiosque"
          ? "MAAX Kiosque"
          : module === "lavage"
            ? "MAAX Lavage"
            : module
      )
      .join(" et ");

    const message = [
      "Bonjour,",
      "",
      "Voici votre code d'activation MAAX Business.",
      "",
      `Client : ${item.client_affichage || "Sans client"}`,
      `Module(s) : ${modulesLibelles}`,
      `Durée : ${item.duree_jours} jours`,
      "",
      `Code d'activation : *${item.code}*`,
      "",
      "Merci de conserver ce code précieusement.",
      "L'équipe MAAX Technologies",
    ].join("\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // --------------------------------------------------
  // RATTACHEMENT D'UNE LICENCE ORPHELINE
  // --------------------------------------------------

  function ouvrirRattachement(item) {
    setLicenceARattacher(item);
    setRechercheRattachement("");
    setClientsRattachement([]);
    setClientRattachement(null);
    setErreurRattachement("");
  }

  async function confirmerRattachement() {
    if (!licenceARattacher || !clientRattachement) {
      setErreurRattachement("Sélectionne un client.");
      return;
    }

    setRattachementLoading(true);
    setErreurRattachement("");

    try {
      const response = await fetch("/api/admin/licences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licence_id: licenceARattacher.id,
          proprietaire_id: clientRattachement.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur de rattachement.");
      }

      setLicenceARattacher(null);
      setRechercheRattachement("");
      setClientsRattachement([]);
      setClientRattachement(null);

      await chargerHistorique();

      alert(
        "La licence a été rattachée au client avec succès. Son code n'a pas changé."
      );
    } catch (error) {
      setErreurRattachement(error.message || "Erreur de rattachement.");
    } finally {
      setRattachementLoading(false);
    }
  }

  // --------------------------------------------------
  // DÉSACTIVATION D'UNE LICENCE
  // --------------------------------------------------

  async function desactiverLicence(item) {
    const confirme = window.confirm(
      `Voulez-vous vraiment désactiver cette licence ?\n\nClient : ${
        item.client_affichage || "Sans client"
      }\n\nCette opération révoquera le code d'activation. Il ne pourra plus être utilisé.`
    );

    if (!confirme) return;

    setLicenceDesactivationId(item.id);
    setHistoriqueErreur("");

    try {
      const response = await fetch("/api/admin/licences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "desactiver",
          licence_id: item.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de désactiver cette licence.");
      }

      await chargerHistorique();

      alert("La licence a été désactivée avec succès.");
    } catch (error) {
      setHistoriqueErreur(error.message || "Erreur de désactivation.");
    } finally {
      setLicenceDesactivationId(null);
    }
  }

  // --------------------------------------------------
  // AFFICHAGE ET FILTRAGE
  // --------------------------------------------------

  function afficherDate(date) {
    if (!date) return "Non renseignée";

    const valeur = new Date(date);

    if (Number.isNaN(valeur.getTime())) return "Non renseignée";

    return valeur.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function calculerDateExpiration(dateCreation, dureeJours) {
    if (!dateCreation || !dureeJours) return "—";

    const date = new Date(dateCreation);
    date.setDate(date.getDate() + Number(dureeJours));

    return afficherDate(date);
  }

  function obtenirIndicateurExpiration(dateCreation, dureeJours) {
    if (!dateCreation || !dureeJours) {
      return { texte: "Date inconnue", classe: "text-gray-500" };
    }

    const expiration = new Date(dateCreation);
    expiration.setDate(expiration.getDate() + Number(dureeJours));
    expiration.setHours(0, 0, 0, 0);

    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);

    const joursRestants = Math.ceil(
      (expiration.getTime() - aujourdHui.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (joursRestants < 0) {
      return {
        texte: `Expirée depuis ${Math.abs(joursRestants)} jour(s)`,
        classe: "font-semibold text-red-600",
      };
    }

    if (joursRestants === 0) {
      return {
        texte: "Expire aujourd'hui",
        classe: "font-semibold text-orange-600",
      };
    }

    return {
      texte: `Expire dans ${joursRestants} jour(s)`,
      classe:
        joursRestants <= 7
          ? "font-semibold text-orange-600"
          : "font-medium text-green-700",
    };
  }

  function libelleStatut(statut) {
    const statuts = {
      disponible: "Disponible",
      active: "Activée",
      activee: "Activée",
      expiree: "Expirée",
      "expirée": "Expirée",
      revoquee: "Révoquée",
      "révoquée": "Révoquée",
    };

    return (
      statuts[String(statut || "").toLowerCase()] ||
      statut ||
      "Inconnu"
    );
  }

  function filtrerHistorique(item) {
    const rechercheTexte = rechercheHistorique.trim().toLowerCase();

    const correspondRecherche =
      !rechercheTexte ||
      (item.client_affichage || "").toLowerCase().includes(rechercheTexte) ||
      (item.code || "").toLowerCase().includes(rechercheTexte) ||
      String(item.id).toLowerCase().includes(rechercheTexte);

    const correspondStatut =
      filtreStatut === "tous" ||
      String(item.statut).toLowerCase() === filtreStatut;

    const correspondClient =
      filtreClient === "tous" ||
      (filtreClient === "orphelines" && item.est_orpheline) ||
      (filtreClient === "associees" && !item.est_orpheline);

    return correspondRecherche && correspondStatut && correspondClient;
  }

  const historiqueFiltre = historique.filter(filtrerHistorique);

  // --------------------------------------------------
  // INTERFACE
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-7 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#14233B] hover:text-[#B99A5C]"
          >
            ← Retour au tableau de bord
          </Link>

          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B99A5C]">
                Administration MAAX Business
              </p>
              <h1 className="mt-2 text-2xl font-extrabold text-[#14233B] md:text-3xl">
                Gestion des licences
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Créez, attribuez, consultez et désactivez les licences MAAX Business.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#D8BD83]/50 bg-[#D8BD83]/10 px-4 py-3">
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

        <div className="grid items-start gap-6 lg:grid-cols-5">
          {/* FORMULAIRE DE GÉNÉRATION */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
            <div className="border-b border-slate-100 bg-[#14233B] px-6 py-5">
              <h2 className="font-bold text-white">
                Générer une nouvelle licence
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                Renseignez les informations nécessaires.
              </p>
            </div>

            <form onSubmit={genererLicence} className="space-y-7 p-5 md:p-7">
              <div>
                <label className="mb-3 block text-sm font-bold text-[#14233B]">
                  01. Type de client
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      id: "existant",
                      nom: "Client existant",
                      description: "Rechercher un propriétaire déjà inscrit.",
                      icone: "👥",
                    },
                    {
                      id: "nouveau",
                      nom: "Nouveau client",
                      description: "Préparer une licence avant son inscription.",
                      icone: "➕",
                    },
                    {
                      id: "sans_client",
                      nom: "Sans client",
                      description: "Créer une licence orpheline.",
                      icone: "📦",
                    },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => changerType(type.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        typeClient === type.id
                          ? "border-[#D8BD83] bg-[#D8BD83]/10 ring-1 ring-[#D8BD83]"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-2xl">{type.icone}</span>
                      <p className="mt-3 font-bold text-[#14233B]">
                        {type.nom}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {type.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {typeClient === "existant" && (
                <div>
                  <label className="mb-3 block text-sm font-bold text-[#14233B]">
                    02. Rechercher un propriétaire
                  </label>

                  <input
                    type="text"
                    value={recherche}
                    onChange={(e) => {
                      setRecherche(e.target.value);
                      setClientSelectionne(null);
                    }}
                    placeholder="Nom ou numéro de téléphone..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/20"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Saisissez au moins 3 caractères.
                  </p>

                  {rechercheLoading && (
                    <p className="mt-3 text-sm text-slate-500">
                      Recherche en cours...
                    </p>
                  )}

                  {clients.length > 0 && !clientSelectionne && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                      {clients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setClientSelectionne(client);
                            setClients([]);
                            setRecherche("");
                          }}
                          className="w-full border-b border-slate-100 p-4 text-left last:border-0 hover:bg-slate-50"
                        >
                          <p className="font-semibold text-[#14233B]">
                            {client.nom}
                          </p>
                          <p className="text-sm text-slate-500">
                            {client.telephone || "Téléphone non renseigné"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {!rechercheLoading &&
                    recherche.trim().length >= 3 &&
                    clients.length === 0 &&
                    !clientSelectionne && (
                      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                        Aucun propriétaire actif trouvé.
                      </p>
                    )}

                  {clientSelectionne && (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-green-800">
                          ✓ Propriétaire sélectionné
                        </p>
                        <button
                          type="button"
                          onClick={() => setClientSelectionne(null)}
                          className="text-xs font-semibold underline"
                        >
                          Changer
                        </button>
                      </div>
                      <p className="mt-2 font-bold text-slate-800">
                        {clientSelectionne.nom}
                      </p>
                      <p className="text-sm text-slate-600">
                        {clientSelectionne.telephone || "Téléphone non renseigné"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {typeClient === "nouveau" && (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-[#14233B]">
                    02. Informations du nouveau client
                  </label>
                  <input
                    type="text"
                    value={clientNom}
                    onChange={(e) => setClientNom(e.target.value)}
                    placeholder="Nom du client ou de l'entreprise"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                  />
                  <input
                    type="tel"
                    value={clientTelephone}
                    onChange={(e) => setClientTelephone(e.target.value)}
                    placeholder="Téléphone WhatsApp"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                  />
                  <p className="rounded-lg bg-[#14233B]/5 p-3 text-xs text-slate-600">
                    Cette licence sera préparée sans propriétaire associé.
                    Le rattachement pourra être effectué ultérieurement.
                  </p>
                </div>
              )}

              {typeClient === "sans_client" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-bold text-amber-900">
                    📦 Génération sans propriétaire
                  </p>
                  <p className="mt-2 text-sm text-amber-800">
                    Cette licence sera créée sans nom, sans téléphone et sans
                    propriétaire associé. Elle pourra être rattachée à un client
                    ultérieurement.
                  </p>
                </div>
              )}

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
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                          selectionne
                            ? "border-[#D8BD83] bg-[#D8BD83]/10"
                            : "border-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectionne}
                          onChange={() => toggleModule(module.id)}
                          className="mt-1 accent-[#14233B]"
                        />
                        <span className="text-2xl">{module.icone}</span>
                        <span>
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
              </div>

              <div>
                <label className="mb-3 block text-sm font-bold text-[#14233B]">
                  04. Durée de validité
                </label>
                <select
                  value={duree}
                  onChange={(e) => setDuree(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                >
                  {dureesDisponibles.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {erreur && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  <p className="font-semibold">Une erreur est survenue</p>
                  <p className="mt-1">{erreur}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-5 py-4 text-sm font-extrabold text-[#14233B] hover:bg-[#E6CE98] disabled:opacity-60"
              >
                {loading ? "Génération en cours..." : "＋ Générer la licence"}
              </button>
            </form>
          </section>

          {/* RÉSULTAT DE GÉNÉRATION */}
          <section className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="font-bold text-[#14233B]">
                  Résultat de génération
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Informations de votre licence.
                </p>
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
                    <p className="mt-2 text-sm text-slate-500">
                      Le code d'activation apparaîtra ici après la génération.
                    </p>
                  </div>
                )}

                {licence && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="font-bold text-green-800">
                        ✓ Licence générée avec succès
                      </p>
                      <p className="mt-2 text-xs text-green-700">
                        Statut initial : Disponible
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-slate-500">
                        Code d'activation
                      </label>
                      <div className="mt-2 break-all rounded-xl bg-[#14233B] p-5 text-center font-mono text-base font-bold text-[#D8BD83]">
                        {licence.code}
                      </div>
                      <button
                        type="button"
                        onClick={copierCode}
                        className="mt-3 w-full rounded-xl border border-[#14233B] px-4 py-3 text-sm font-bold text-[#14233B] hover:bg-[#14233B] hover:text-white"
                      >
                        {copie ? "✓ Code copié !" : "Copier le code d'activation"}
                      </button>
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        Conservez ce code et transmettez-le au client de manière
                        sécurisée.
                      </p>
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                      <h3 className="mb-4 text-sm font-bold text-[#14233B]">
                        Détails de la licence
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Client</span>
                          <span className="text-right font-semibold">
                            {licence.licence.client_nom || "Sans client"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Téléphone</span>
                          <span className="text-right font-semibold">
                            {licence.licence.client_telephone || "Non renseigné"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Rattachement</span>
                          <span className="text-right font-semibold">
                            {licence.licence.proprietaire_id
                              ? "Client associé"
                              : licence.licence.client_nom
                                ? "Compte à rattacher"
                                : "Licence orpheline"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Modules</span>
                          <span className="text-right font-semibold">
                            {licence.licence.modules.join(" + ")}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Durée</span>
                          <span className="font-semibold">
                            {licence.licence.duree_jours} jours
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold text-[#14233B]">
                Informations importantes
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-500">
                <li>• Chaque code d'activation est généré de manière sécurisée.</li>
                <li>• Une licence peut contenir plusieurs modules.</li>
                <li>• La durée commence selon les règles d'activation de la licence.</li>
                <li>• Une licence orpheline peut être rattachée ultérieurement.</li>
                <li>• Une licence révoquée ne peut plus être utilisée.</li>
              </ul>
            </div>
          </section>
        </div>

        {/* HISTORIQUE DES LICENCES */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-[#14233B] px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-white">Historique des licences</h2>
              <p className="mt-1 text-xs text-slate-300">
                Consultez, partagez, rattachez ou désactivez les licences.
              </p>
            </div>
            <button
              type="button"
              onClick={chargerHistorique}
              disabled={historiqueLoading}
              className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              {historiqueLoading ? "Actualisation..." : "↻ Actualiser"}
            </button>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="text"
                value={rechercheHistorique}
                onChange={(e) => setRechercheHistorique(e.target.value)}
                placeholder="Rechercher un client, un code..."
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
              />

              <select
                value={filtreStatut}
                onChange={(e) => setFiltreStatut(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
              >
                <option value="tous">Tous les statuts</option>
                <option value="disponible">Disponible</option>
                <option value="active">Activée</option>
                <option value="activee">Activée</option>
                <option value="expiree">Expirée</option>
                <option value="revoquee">Révoquée</option>
              </select>

              <select
                value={filtreClient}
                onChange={(e) => setFiltreClient(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
              >
                <option value="tous">Toutes les licences</option>
                <option value="associees">Avec client associé</option>
                <option value="orphelines">Licences orphelines</option>
              </select>
            </div>

            {historiqueErreur && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {historiqueErreur}
              </div>
            )}

            {historiqueLoading && historique.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Chargement de l'historique...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#14233B]">
                    {historiqueFiltre.length} licence(s) affichée(s)
                  </p>
                  <p className="text-xs text-slate-400">
                    Maximum : 500 dernières licences
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-4">Client</th>
                        <th className="px-4 py-4">Code d'activation</th>
                        <th className="px-4 py-4">Modules</th>
                        <th className="px-4 py-4">Durée</th>
                        <th className="px-4 py-4">Génération</th>
                        <th className="px-4 py-4">Date d'expiration</th>
                        <th className="px-4 py-4">Statut</th>
                        <th className="px-4 py-4">Échéance</th>
                        <th className="px-4 py-4">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {historiqueFiltre.map((item) => {
                        const statut = String(item.statut || "").toLowerCase();
                        const peutDesactiver =
                          statut === "disponible" || statut === "active";

                        const indicateur = obtenirIndicateurExpiration(
                          item.date_creation,
                          item.duree_jours
                        );

                        return (
                          <tr
                            key={item.id}
                            className="align-top hover:bg-slate-50"
                          >
                            <td className="px-4 py-4">
                              <p className="font-semibold text-[#14233B]">
                                {item.client_affichage || "Sans client"}
                              </p>
                              {item.client_telephone && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.client_telephone}
                                </p>
                              )}
                              {item.est_orpheline && (
                                <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                                  ORPHELINE
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              {item.code ? (
                                <div className="max-w-[240px]">
                                  <p className="break-all font-mono text-xs font-bold text-[#14233B]">
                                    {codesVisibles[item.id]
                                      ? item.code
                                      : "••••••••••••••••••••••"}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCodesVisibles((previous) => ({
                                        ...previous,
                                        [item.id]: !previous[item.id],
                                      }))
                                    }
                                    className="mt-2 text-xs font-semibold text-slate-500 underline"
                                  >
                                    {codesVisibles[item.id]
                                      ? "Masquer"
                                      : "Afficher"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Code non récupérable
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1">
                                {(item.modules || []).map((module) => (
                                  <span
                                    key={module}
                                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                                  >
                                    {module === "kiosque"
                                      ? "Kiosque"
                                      : module === "lavage"
                                        ? "Lavage"
                                        : module}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="px-4 py-4 font-medium text-slate-700">
                              {item.duree_jours} jours
                            </td>

                            <td className="px-4 py-4 text-slate-600">
                              {afficherDate(item.date_creation)}
                            </td>

                            <td className="px-4 py-4 text-slate-600">
                              {calculerDateExpiration(
                                item.date_creation,
                                item.duree_jours
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                                  statut === "revoquee" ||
                                  statut === "révoquée"
                                    ? "bg-red-100 text-red-700"
                                    : statut === "active"
                                      ? "bg-green-100 text-green-700"
                                      : statut === "expiree" ||
                                          statut === "expirée"
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {libelleStatut(item.statut)}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              {statut === "revoquee" ||
                              statut === "révoquée" ? (
                                <span className="font-semibold text-red-600">
                                  Licence révoquée
                                </span>
                              ) : (
                                <span className={indicateur.classe}>
                                  {indicateur.texte}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex min-w-[145px] flex-col gap-2">
                                {item.code && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copierCodeHistorique(item.code)
                                      }
                                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#14233B] hover:bg-slate-100"
                                    >
                                      Copier
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => partagerLicence(item)}
                                      className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"
                                    >
                                      Partager
                                    </button>
                                  </>
                                )}

                                {item.est_orpheline && (
                                  <button
                                    type="button"
                                    onClick={() => ouvrirRattachement(item)}
                                    className="rounded-lg border border-[#D8BD83] bg-[#D8BD83]/10 px-3 py-2 text-xs font-bold text-[#14233B] hover:bg-[#D8BD83]/30"
                                  >
                                    Rattacher à un client
                                  </button>
                                )}

                                {peutDesactiver && (
                                  <button
                                    type="button"
                                    onClick={() => desactiverLicence(item)}
                                    disabled={
                                      licenceDesactivationId === item.id
                                    }
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {licenceDesactivationId === item.id
                                      ? "Désactivation..."
                                      : "Désactiver"}
                                  </button>
                                )}

                                {!item.code &&
                                  !item.est_orpheline &&
                                  !peutDesactiver && (
                                    <span className="text-xs text-slate-400">
                                      Aucune action disponible
                                    </span>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {historiqueFiltre.length === 0 && (
                    <div className="p-10 text-center text-sm text-slate-500">
                      Aucune licence ne correspond à ta recherche.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* FENÊTRE DE RATTACHEMENT */}
        {licenceARattacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14233B]/70 p-4">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between bg-[#14233B] px-6 py-5">
                <div>
                  <h2 className="font-bold text-white">
                    Rattacher une licence
                  </h2>
                  <p className="mt-1 text-xs text-slate-300">
                    Associer cette licence à un client existant.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLicenceARattacher(null)}
                  className="text-2xl text-white hover:text-[#D8BD83]"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase text-amber-800">
                    Licence orpheline sélectionnée
                  </p>
                  <p className="mt-2 font-semibold text-[#14233B]">
                    {licenceARattacher.modules?.join(" + ")}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Durée : {licenceARattacher.duree_jours} jours
                  </p>
                  <p className="mt-2 text-xs text-amber-800">
                    Le code d'activation sera conservé sans modification.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#14233B]">
                    Rechercher le client destinataire
                  </label>
                  <input
                    type="text"
                    value={rechercheRattachement}
                    onChange={(e) =>
                      rechercherClientRattachement(e.target.value)
                    }
                    placeholder="Nom ou numéro de téléphone..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Saisis au moins 3 caractères.
                  </p>
                </div>

                {rechercheRattachementLoading && (
                  <p className="text-sm text-slate-500">
                    Recherche des clients...
                  </p>
                )}

                {clientsRattachement.length > 0 && !clientRattachement && (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                    {clientsRattachement.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setClientRattachement(client);
                          setClientsRattachement([]);
                        }}
                        className="w-full border-b border-slate-100 p-4 text-left last:border-0 hover:bg-slate-50"
                      >
                        <p className="font-semibold text-[#14233B]">
                          {client.nom}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {client.telephone || "Téléphone non renseigné"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {clientRattachement && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-green-800">
                        ✓ Client sélectionné
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setClientRattachement(null);
                          setRechercheRattachement("");
                        }}
                        className="text-xs font-semibold underline"
                      >
                        Changer
                      </button>
                    </div>
                    <p className="mt-2 font-bold text-[#14233B]">
                      {clientRattachement.nom}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {clientRattachement.telephone || "Téléphone non renseigné"}
                    </p>
                  </div>
                )}

                {erreurRattachement && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {erreurRattachement}
                  </div>
                )}

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    En confirmant, cette licence sera associée au client
                    sélectionné. Son code, ses modules, sa durée et son statut
                    seront conservés.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setLicenceARattacher(null)}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={confirmerRattachement}
                    disabled={!clientRattachement || rattachementLoading}
                    className="rounded-xl bg-[#14233B] px-5 py-3 text-sm font-bold text-white hover:bg-[#203958] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rattachementLoading
                      ? "Rattachement en cours..."
                      : "Confirmer le rattachement"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}