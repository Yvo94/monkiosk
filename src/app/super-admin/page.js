"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Users,
  Plus,
  RefreshCw,
  LoaderCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const champ =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";

export default function SuperAdminPage() {
  const router = useRouter();

  const [kiosques, setKiosques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [nomKiosque, setNomKiosque] = useState("");
  const [nomProprietaire, setNomProprietaire] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [devise, setDevise] = useState("FCFA");

  
const chargerKiosques = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session) {
      router.replace("/login");
      return;
    }

    const response = await fetch("/api/super-admin/kiosques", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    // Lire le corps de la réponse une seule fois.
    const contenu = await response.text();

    let result;

    try {
      result = contenu ? JSON.parse(contenu) : {};
    } catch {
      console.error("Réponse non JSON de l'API :", contenu);
      throw new Error(
        "Le serveur a renvoyé une réponse invalide. Vérifie le terminal Next.js."
      );
    }

    if (response.status === 401) {
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    if (response.status === 403) {
      throw new Error(
        result.error || "Accès réservé au super-utilisateur."
      );
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Impossible de charger les kiosques."
      );
    }

    setKiosques(result.kiosques || []);
  } catch (err) {
    console.error("Erreur chargement kiosques :", err);
    setError(err.message || "Impossible de charger les kiosques.");
  } finally {
    setLoading(false);
  }
}, [router]);


  useEffect(() => {
    chargerKiosques();
  }, [chargerKiosques]);

  async function creerKiosque(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) throw new Error("Connecte-toi à nouveau.");

      const response = await fetch("/api/super-admin/kiosques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nomKiosque,
          nomProprietaire,
          whatsapp,
          email,
          motDePasse,
          devise,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Création impossible.");
      }

      setSuccess(
        `Le kiosque « ${result.kiosque.nom} » et son propriétaire ont été créés.`
      );

      setNomKiosque("");
      setNomProprietaire("");
      setWhatsapp("");
      setEmail("");
      setMotDePasse("");
      setDevise("FCFA");

      await chargerKiosques();
    } catch (err) {
      setError(err.message || "Impossible de créer le kiosque.");
    } finally {
      setSaving(false);
    }
  }

  const actifs = kiosques.filter((k) => k.actif).length;

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
              Gère les kiosques et les comptes de leurs propriétaires.
            </p>
          </div>

          <button
            type="button"
            onClick={chargerKiosques}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {success}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Total kiosques</span>
              <Store className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-[#14233B]">
              {loading ? "—" : kiosques.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Kiosques actifs</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-[#14233B]">
              {loading ? "—" : actifs}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Propriétaires</span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-[#14233B]">
              {loading
                ? "—"
                : new Set(kiosques.map((k) => k.owner_id)).size}
            </p>
          </div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
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
                Le compte propriétaire sera créé en même temps.
              </p>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              Nom de la structure *
              <input
                className={champ}
                value={nomKiosque}
                onChange={(e) => setNomKiosque(e.target.value)}
                placeholder="Ex. : Kiosque à café du Plateau"
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
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              WhatsApp au format international *
              <input
                className={champ}
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="0700000000 ou +2250700000000"
                title="Exemple : +2250700000000"
                required
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Numéro ivoirien à 10 chiffres ou numéro international avec indicatif.
              </span>
            </label>

            
            <label className="block text-sm font-semibold text-slate-700">
              Adresse e-mail du propriétaire
              <input
                className={champ}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="proprietaire@exemple.com"
                autoComplete="email"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Facultatif. Cette adresse sera associée au compte du propriétaire.
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
              disabled={saving}
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

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <h2 className="text-xl font-bold text-[#14233B]">
                Kiosques enregistrés
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Liste des kiosques et de leurs propriétaires.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Chargement...
              </div>
            ) : kiosques.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Aucun kiosque trouvé.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {kiosques.map((kiosque) => (
                  <article key={kiosque.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-bold text-[#14233B]">
                          {kiosque.nom}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {kiosque.proprietaire?.nom ||
                            "Propriétaire non disponible"}
                        </p>
                        {kiosque.proprietaire?.whatsapp && (
                          <p className="mt-1 text-xs text-slate-500">
                            {kiosque.proprietaire.whatsapp}
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

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Devise : {kiosque.devise || "FCFA"}</span>
                      <span>{kiosque.id.slice(0, 8)}…</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
