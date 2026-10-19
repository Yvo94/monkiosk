
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  Store,
  Users,
  Plus,
  RefreshCw,
  LoaderCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  LogOut,
  Search,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  Database,
  HardDrive,
  Save,
  X,
  UserRound,
  Phone,
  Mail,
} from "lucide-react";

const champ =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";

const boutonSecondaire =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function formaterOctets(octets) {
  if (octets === null || octets === undefined || !Number.isFinite(Number(octets))) {
    return "Indisponible";
  }

  const valeur = Number(octets);

  if (valeur < 1024) return `${valeur} octets`;

  const unites = ["Ko", "Mo", "Go", "To"];
  let taille = valeur / 1024;
  let index = 0;

  while (taille >= 1024 && index < unites.length - 1) {
    taille /= 1024;
    index += 1;
  }

  return `${taille.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} ${unites[index]}`;
}

function formaterNombre(valeur) {
  if (valeur === null || valeur === undefined) return "Indisponible";
  return Number(valeur).toLocaleString("fr-FR");
}

export default function SuperAdminPage() {
  const router = useRouter();

  const [kiosques, setKiosques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recherche, setRecherche] = useState("");
  const [detailsOuverts, setDetailsOuverts] = useState({});
  const [editionId, setEditionId] = useState("");

  const [nomKiosque, setNomKiosque] = useState("");
  const [nomProprietaire, setNomProprietaire] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [devise, setDevise] = useState("FCFA");

  const [formEdition, setFormEdition] = useState({
    nom: "",
    nomProprietaire: "",
    whatsapp: "",
    email: "",
  });

  const requeteApi = useCallback(
    async (url, options = {}) => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        router.replace("/login");
        throw new Error("Session expirée. Connecte-toi à nouveau.");
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        cache: "no-store",
      });

      const texte = await response.text();
      let result = {};

      try {
        result = texte ? JSON.parse(texte) : {};
      } catch {
        throw new Error("Le serveur a renvoyé une réponse invalide.");
      }

      if (response.status === 401) {
        await supabase.auth.signOut();
        router.replace("/login");
        throw new Error("Session expirée. Connecte-toi à nouveau.");
      }

      if (!response.ok) {
        throw new Error(result.error || "Une erreur est survenue.");
      }

      return result;
    },
    [router]
  );

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) throw logoutError;

      router.replace("/login");
      router.refresh();
    } catch (err) {
      console.error("Erreur de déconnexion :", err);
      setError("La déconnexion a échoué. Veuillez réessayer.");
      setLoggingOut(false);
    }
  }

  const chargerKiosques = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await requeteApi("/api/super-admin/kiosques", {
        method: "GET",
      });

      setKiosques(result.kiosques || []);
    } catch (err) {
      console.error("Erreur chargement structures :", err);
      setError(err.message || "Impossible de charger les structures.");
    } finally {
      setLoading(false);
    }
  }, [requeteApi]);

  useEffect(() => {
    chargerKiosques();
  }, [chargerKiosques]);

  async function creerKiosque(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await requeteApi("/api/super-admin/kiosques", {
        method: "POST",
        body: JSON.stringify({
          nomKiosque,
          nomProprietaire,
          whatsapp,
          email,
          motDePasse,
          devise,
        }),
      });

      setSuccess(
        `La structure « ${result.kiosque.nom} » et son propriétaire ont été créés.`
      );

      setNomKiosque("");
      setNomProprietaire("");
      setWhatsapp("");
      setEmail("");
      setMotDePasse("");
      setDevise("FCFA");

      await chargerKiosques();
    } catch (err) {
      console.error("Erreur création structure :", err);
      setError(err.message || "Impossible de créer la structure.");
    } finally {
      setSaving(false);
    }
  }

  function ouvrirEdition(kiosque) {
    setEditionId(kiosque.id);
    setError("");
    setSuccess("");

    setFormEdition({
      nom: kiosque.nom || "",
      nomProprietaire: kiosque.proprietaire?.nom || "",
      whatsapp: kiosque.proprietaire?.whatsapp || "",
      email: kiosque.proprietaire?.email || "",
    });
  }

  async function enregistrerEdition(e, kiosque) {
    e.preventDefault();
    setActionId(kiosque.id);
    setError("");
    setSuccess("");

    try {
      await requeteApi(
        `/api/super-admin/kiosques/${encodeURIComponent(kiosque.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(formEdition),
        }
      );

      setSuccess(`La structure « ${formEdition.nom} » a été modifiée.`);
      setEditionId("");
      await chargerKiosques();
    } catch (err) {
      console.error("Erreur modification :", err);
      setError(err.message || "Impossible de modifier la structure.");
    } finally {
      setActionId("");
    }
  }

  async function changerStatut(kiosque) {
    const nouveauStatut = !kiosque.actif;
    const action = nouveauStatut ? "activer" : "désactiver";

    if (
      !window.confirm(
        `Veux-tu vraiment ${action} la structure « ${kiosque.nom} » ?`
      )
    ) {
      return;
    }

    setActionId(kiosque.id);
    setError("");
    setSuccess("");

    try {
      await requeteApi(
        `/api/super-admin/kiosques/${encodeURIComponent(kiosque.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ actif: nouveauStatut }),
        }
      );

      setSuccess(
        `La structure « ${kiosque.nom} » est maintenant ${
          nouveauStatut ? "active" : "inactive"
        }. Ses données ont été conservées.`
      );

      await chargerKiosques();
    } catch (err) {
      console.error("Erreur changement statut :", err);
      setError(err.message || "Impossible de modifier le statut.");
    } finally {
      setActionId("");
    }
  }

  async function supprimerKiosque(kiosque) {
    if (
      !window.confirm(
        `Suppression définitive de « ${kiosque.nom} » ?\n\nCette action n'est autorisée que si la structure ne contient aucune donnée métier.`
      )
    ) {
      return;
    }

    setActionId(kiosque.id);
    setError("");
    setSuccess("");

    try {
      const result = await requeteApi(
        `/api/super-admin/kiosques/${encodeURIComponent(kiosque.id)}`,
        { method: "DELETE" }
      );

      setSuccess(result.message || "Structure supprimée.");
      await chargerKiosques();
    } catch (err) {
      console.error("Erreur suppression :", err);
      setError(err.message || "Impossible de supprimer la structure.");
    } finally {
      setActionId("");
    }
  }

  function basculerDetails(id) {
    setDetailsOuverts((precedent) => ({
      ...precedent,
      [id]: !precedent[id],
    }));
  }

  const actifs = kiosques.filter((k) => k.actif).length;
  const proprietaires = new Set(kiosques.map((k) => k.owner_id).filter(Boolean))
    .size;

  const totalEnregistrements = kiosques.reduce((total, kiosque) => {
    const valeur = kiosque.statistiques?.totalEnregistrements;
    return valeur === null || valeur === undefined ? total : total + valeur;
  }, 0);

  const tailleEstimee = kiosques.reduce((total, kiosque) => {
    const valeur = kiosque.statistiques?.tailleEstimeeOctets;
    return valeur === null || valeur === undefined ? total : total + valeur;
  }, 0);

  const nombreStatistiquesIndisponibles = kiosques.filter(
    (k) => k.statistiques?.totalEnregistrements == null
  ).length;

  const kiosquesFiltres = kiosques.filter((kiosque) => {
    const texte = recherche.trim().toLowerCase();

    if (!texte) return true;

    return [
      kiosque.nom,
      kiosque.proprietaire?.nom,
      kiosque.proprietaire?.whatsapp,
      kiosque.proprietaire?.email,
    ].some((valeur) => String(valeur || "").toLowerCase().includes(texte));
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <ShieldCheck className="h-4 w-4" />
              Administration sécurisée
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#14233B]">
              Super-administration
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Gère les structures, leurs propriétaires et leurs données.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={chargerKiosques}
              disabled={loading || loggingOut}
              className={boutonSecondaire}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Actualiser
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {loggingOut ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {loggingOut ? "Déconnexion..." : "Déconnexion"}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
            <button
              type="button"
              className="ml-3 font-bold underline"
              onClick={() => setError("")}
            >
              Fermer
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {success}
            <button
              type="button"
              className="ml-3 font-bold underline"
              onClick={() => setSuccess("")}
            >
              Fermer
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicateur
            titre="Total structures"
            valeur={loading ? "—" : kiosques.length}
            icone={<Store className="h-5 w-5 text-amber-600" />}
          />
          <Indicateur
            titre="Structures actives"
            valeur={loading ? "—" : actifs}
            icone={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          />
          <Indicateur
            titre="Propriétaires"
            valeur={loading ? "—" : proprietaires}
            icone={<Users className="h-5 w-5 text-blue-600" />}
          />
          <Indicateur
            titre="Enregistrements estimés"
            valeur={loading ? "—" : formaterNombre(totalEnregistrements)}
            icone={<Database className="h-5 w-5 text-violet-600" />}
            sousTitre={
              nombreStatistiquesIndisponibles
                ? `${nombreStatistiquesIndisponibles} structure(s) sans statistiques`
                : formaterOctets(tailleEstimee)
            }
          />
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form
            onSubmit={creerKiosque}
            className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
          >
            <div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Plus className="h-5 w-5" />
              </div>

              <h2 className="text-xl font-bold text-[#14233B]">
                Créer une structure
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Le compte propriétaire est créé en même temps.
              </p>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              Nom de la structure *
              <input
                className={champ}
                value={nomKiosque}
                onChange={(e) => setNomKiosque(e.target.value)}
                placeholder="Ex. : Kiosque à café du Plateau"
                autoComplete="organization"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Nom complet du propriétaire *
              <input
                className={champ}
                value={nomProprietaire}
                onChange={(e) => setNomProprietaire(e.target.value)}
                placeholder="Nom et prénoms"
                autoComplete="name"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              WhatsApp *
              <input
                className={champ}
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="0700000000 ou +2250700000000"
                autoComplete="tel"
                required
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Le numéro sert également d'identifiant de connexion.
              </span>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Adresse e-mail
              <input
                className={champ}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="proprietaire@exemple.com"
                autoComplete="email"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Facultative.
              </span>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Mot de passe initial *
              <input
                className={champ}
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                placeholder="8 caractères minimum"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Devise
              <select
                className={champ}
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
              >
                <option value="FCFA">FCFA</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={saving || loggingOut}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14233B] px-4 font-semibold text-white transition hover:bg-[#203653] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Créer la structure
                </>
              )}
            </button>
          </form>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="space-y-4 border-b border-slate-100 p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-bold text-[#14233B]">
                  Structures enregistrées
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Consulte, modifie et gère les accès des propriétaires.
                </p>
              </div>

              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${champ} pl-10`}
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher une structure, un propriétaire..."
                  aria-label="Rechercher une structure"
                />
              </label>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Chargement des structures...
              </div>
            ) : kiosquesFiltres.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {recherche
                  ? "Aucune structure ne correspond à cette recherche."
                  : "Aucune structure enregistrée."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {kiosquesFiltres.map((kiosque) => {
                  const statistiques = kiosque.statistiques;
                  const editionEnCours = editionId === kiosque.id;
                  const detailsVisibles = Boolean(detailsOuverts[kiosque.id]);
                  const actionEnCours = actionId === kiosque.id;

                  return (
                    <article key={kiosque.id} className="space-y-4 p-5">
                      {editionEnCours ? (
                        <form
                          onSubmit={(e) => enregistrerEdition(e, kiosque)}
                          className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-bold text-[#14233B]">
                              Modifier la structure
                            </h3>
                            <button
                              type="button"
                              onClick={() => setEditionId("")}
                              className="rounded-lg p-2 text-slate-500 hover:bg-white"
                              aria-label="Annuler la modification"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <label className="block text-sm font-semibold text-slate-700">
                            Nom de la structure
                            <input
                              className={champ}
                              value={formEdition.nom}
                              onChange={(e) =>
                                setFormEdition((p) => ({
                                  ...p,
                                  nom: e.target.value,
                                }))
                              }
                              required
                            />
                          </label>

                          <label className="block text-sm font-semibold text-slate-700">
                            Nom du propriétaire
                            <input
                              className={champ}
                              value={formEdition.nomProprietaire}
                              onChange={(e) =>
                                setFormEdition((p) => ({
                                  ...p,
                                  nomProprietaire: e.target.value,
                                }))
                              }
                              required
                            />
                          </label>

                          <label className="block text-sm font-semibold text-slate-700">
                            WhatsApp / identifiant de connexion
                            <input
                              className={champ}
                              type="tel"
                              value={formEdition.whatsapp}
                              onChange={(e) =>
                                setFormEdition((p) => ({
                                  ...p,
                                  whatsapp: e.target.value,
                                }))
                              }
                              required
                            />
                          </label>

                          <label className="block text-sm font-semibold text-slate-700">
                            E-mail
                            <input
                              className={champ}
                              type="email"
                              value={formEdition.email}
                              onChange={(e) =>
                                setFormEdition((p) => ({
                                  ...p,
                                  email: e.target.value,
                                }))
                              }
                            />
                          </label>

                          <button
                            type="submit"
                            disabled={actionEnCours}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14233B] px-4 py-3 text-sm font-semibold text-white hover:bg-[#203653] disabled:opacity-50"
                          >
                            {actionEnCours ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Enregistrer les modifications
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="break-words font-bold text-[#14233B]">
                                {kiosque.nom}
                              </h3>

                              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                                <UserRound className="h-4 w-4 shrink-0" />
                                <span className="break-words">
                                  {kiosque.proprietaire?.nom ||
                                    "Propriétaire non disponible"}
                                </span>
                              </p>

                              {kiosque.proprietaire?.whatsapp && (
                                <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                  <Phone className="h-3.5 w-3.5 shrink-0" />
                                  {kiosque.proprietaire.whatsapp}
                                </p>
                              )}

                              {kiosque.proprietaire?.email && (
                                <p className="mt-1 flex items-center gap-2 break-all text-xs text-slate-500">
                                  <Mail className="h-3.5 w-3.5 shrink-0" />
                                  {kiosque.proprietaire.email}
                                </p>
                              )}
                            </div>

                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                kiosque.actif
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {kiosque.actif ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              {kiosque.actif ? "Actif" : "Inactif"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Database className="h-4 w-4" />
                                Enregistrements
                              </div>
                              <p className="mt-2 text-lg font-bold text-[#14233B]">
                                {formaterNombre(
                                  statistiques?.totalEnregistrements
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <HardDrive className="h-4 w-4" />
                                Taille estimée
                              </div>
                              <p className="mt-2 text-lg font-bold text-[#14233B]">
                                {formaterOctets(
                                  statistiques?.tailleEstimeeOctets
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => basculerDetails(kiosque.id)}
                              className={boutonSecondaire}
                            >
                              {detailsVisibles ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              {detailsVisibles
                                ? "Masquer les détails"
                                : "Voir les détails"}
                            </button>

                            <button
                              type="button"
                              onClick={() => ouvrirEdition(kiosque)}
                              className={boutonSecondaire}
                            >
                              <Pencil className="h-4 w-4" />
                              Modifier
                            </button>

                            <button
                              type="button"
                              onClick={() => changerStatut(kiosque)}
                              disabled={actionEnCours}
                              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                                kiosque.actif
                                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              }`}
                            >
                              {actionEnCours ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : kiosque.actif ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              {kiosque.actif ? "Désactiver" : "Activer"}
                            </button>

                            <button
                              type="button"
                              onClick={() => supprimerKiosque(kiosque)}
                              disabled={actionEnCours}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </button>
                          </div>

                          {detailsVisibles && (
                            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                              <div>
                                <p className="text-sm font-bold text-[#14233B]">
                                  Détails de la structure
                                </p>
                                <p className="mt-1 break-all text-xs text-slate-500">
                                  Identifiant : {kiosque.id}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Devise : {kiosque.devise || "FCFA"}
                                </p>
                              </div>

                              {statistiques?.erreur && (
                                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                                  Statistiques indisponibles :{" "}
                                  {statistiques.erreur}
                                </p>
                              )}

                              {statistiques?.details?.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[360px] text-left text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-500">
                                        <th className="py-2 pr-3 font-semibold">
                                          Table
                                        </th>
                                        <th className="py-2 pr-3 text-right font-semibold">
                                          Lignes
                                        </th>
                                        <th className="py-2 text-right font-semibold">
                                          Taille estimée
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {statistiques.details.map((ligne) => (
                                        <tr
                                          key={ligne.table}
                                          className="border-b border-slate-100 last:border-0"
                                        >
                                          <td className="break-all py-2 pr-3 text-slate-700">
                                            {ligne.table}
                                          </td>
                                          <td className="py-2 pr-3 text-right text-slate-700">
                                            {formaterNombre(
                                              ligne.enregistrements
                                            )}
                                          </td>
                                          <td className="py-2 text-right text-slate-700">
                                            {formaterOctets(ligne.octets)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : !statistiques?.erreur ? (
                                <p className="text-xs text-slate-500">
                                  Aucune ligne trouvée dans les tables métier
                                  prises en compte par les statistiques.
                                </p>
                              ) : null}

                              <p className="text-xs text-slate-400">
                                La taille est une estimation des lignes et
                                n'inclut pas nécessairement les index, les
                                sauvegardes ou les fichiers externes.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
                        <span>Devise : {kiosque.devise || "FCFA"}</span>
                        <span>
                          ID : {String(kiosque.id).slice(0, 8)}…
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function Indicateur({ titre, valeur, icone, sousTitre }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500">{titre}</span>
        {icone}
      </div>
      <p className="mt-3 break-words text-3xl font-bold text-[#14233B]">
        {valeur}
      </p>
      {sousTitre && (
        <p className="mt-1 text-xs text-slate-500">{sousTitre}</p>
      )}
    </div>
  );
}
