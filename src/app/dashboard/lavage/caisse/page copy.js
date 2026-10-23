
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  RefreshCw,
  Search,
  Wallet,
  AlertCircle,
  LoaderCircle,
  ReceiptText,
  Landmark,
  Plus,
  Pencil,
  Power,
  X,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const COULEUR_OR = "#D8BD83";
const COULEUR_BLEU = "#14233B";

const formatMontant = (valeur) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(valeur || 0));

const formatDate = (valeur) => {
  if (!valeur) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Abidjan",
  }).format(new Date(valeur));
};

const debutJour = () => {
  const maintenant = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);

  return `${date}T00:00:00.000Z`;
};

function typeNormalise(type) {
  return String(type || "").trim().toLowerCase();
}

function estEntree(type) {
  return ["entree", "entrée", "encaissement", "depot", "dépôt"].includes(
    typeNormalise(type)
  );
}

function libelleType(type) {
  const valeur = typeNormalise(type);

  if (estEntree(valeur)) return "Entrée";
  if (["sortie", "decaissement", "décaissement"].includes(valeur)) {
    return "Sortie";
  }

  return type || "Autre";
}

export default function CaisseLavagePage() {
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState("");
  const [stations, setStations] = useState([]);
  const [lavageId, setLavageId] = useState("");
  const [caisses, setCaisses] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [filtreCaisse, setFiltreCaisse] = useState("toutes");
  const [filtreType, setFiltreType] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [modalCaisse, setModalCaisse] = useState(false);
  const [caisseEnEdition, setCaisseEnEdition] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState("");

  const [formCaisse, setFormCaisse] = useState({
    nom: "",
    code: "",
    solde_initial: "0",
  }); 

  const chargerDonnees = useCallback(
    async ({ silencieux = false } = {}) => {
      if (silencieux) setActualisation(true);
      else setChargement(true);

      setErreur("");

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        if (!authData?.user) {
          throw new Error("Ta session a expiré. Connecte-toi à nouveau.");
        }

        // Les stations sont limitées au propriétaire par RLS.
        const { data: stationsData, error: stationsError } = await supabase
          .from("lavages")
          .select("id, nom, actif")
          .eq("owner_id", authData.user.id)
          .eq("actif", true)
          .order("nom");

        if (stationsError) throw stationsError;

        const listeStations = stationsData || [];
        setStations(listeStations);

        if (listeStations.length === 0) {
          setLavageId("");
          setCaisses([]);
          setMouvements([]);
          return;
        }

        let stationId = lavageId;

        if (!stationId || !listeStations.some((s) => s.id === stationId)) {
          if (listeStations.length === 1) {
            stationId = listeStations[0].id;
          } else {
            setCaisses([]);
            setMouvements([]);
            setLavageId("");
            return;
          }
        }

        setLavageId(stationId);

        const [{ data: caissesData, error: caissesError }, { data: mouvementsData, error: mouvementsError }] =
          await Promise.all([
            supabase
                .from("lavage_caisses")
                .select(
                    "id, lavage_id, code, nom, solde_initial, solde_actuel, actif, created_at"
                )
                .eq("lavage_id", stationId)
                .order("nom"),

            supabase
              .from("lavage_mouvements_caisse")
              .select(
                "id, lavage_id, caisse_id, service_id, encaissement_id, type_mouvement, motif, montant, date_mouvement, created_by, created_at"
              )
              .eq("lavage_id", stationId)
              .order("date_mouvement", { ascending: false })
              .limit(500),
          ]);

        if (caissesError) throw caissesError;
        if (mouvementsError) throw mouvementsError;

        setCaisses(caissesData || []);
        setMouvements(mouvementsData || []);
      } catch (e) {
        console.error("Erreur chargement caisse lavage :", e);
        setErreur(e?.message || "Impossible de charger les informations de caisse.");
      } finally {
        setChargement(false);
        setActualisation(false);
      }
    },
    [lavageId]
  );

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);
  
  
const ouvrirCreationCaisse = () => {
  setCaisseEnEdition(null);
  setFormCaisse({
    nom: "",
    code: "",
    solde_initial: "0",
  });
  setErreurFormulaire("");
  setModalCaisse(true);
};

const ouvrirEditionCaisse = (caisse) => {
  setCaisseEnEdition(caisse);
  setFormCaisse({
    nom: caisse.nom || "",
    code: caisse.code || "",
    solde_initial: String(caisse.solde_initial ?? 0),
  });
  setErreurFormulaire("");
  setModalCaisse(true);
};

const enregistrerCaisse = async (e) => {
  e.preventDefault();
  setErreurFormulaire("");

  if (!lavageId) {
    setErreurFormulaire("Sélectionne une station de lavage.");
    return;
  }

  const nom = formCaisse.nom.trim();
  const code = formCaisse.code.trim().toUpperCase();
  const soldeInitial = Number(formCaisse.solde_initial);

  if (!nom || !code) {
    setErreurFormulaire("Le nom et le code sont obligatoires.");
    return;
  }

  if (!Number.isFinite(soldeInitial) || soldeInitial < 0) {
    setErreurFormulaire("Le solde initial doit être un montant positif ou nul.");
    return;
  }

  setEnregistrement(true);

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;
    if (!authData?.user) {
      throw new Error("Ta session a expiré. Connecte-toi à nouveau.");
    }

    // Vérification complémentaire : la station appartient à l'utilisateur.
    const { data: station, error: stationError } = await supabase
      .from("lavages")
      .select("id")
      .eq("id", lavageId)
      .eq("owner_id", authData.user.id)
      .eq("actif", true)
      .maybeSingle();

    if (stationError) throw stationError;
    if (!station) {
      throw new Error("Cette station n'est pas accessible.");
    }

    // Vérification du code, sans tenir compte de la casse.
    let verification = supabase
      .from("lavage_caisses")
      .select("id")
      .eq("lavage_id", lavageId)
      .ilike("code", code);

    if (caisseEnEdition) {
      verification = verification.neq("id", caisseEnEdition.id);
    }

    const { data: doublon, error: doublonError } =
      await verification.limit(1).maybeSingle();

    if (doublonError) throw doublonError;

    if (doublon) {
      throw new Error("Ce code existe déjà dans cette station.");
    }

    if (caisseEnEdition) {
      const { error: updateError } = await supabase
        .from("lavage_caisses")
        .update({
          nom,
          code,
        })
        .eq("id", caisseEnEdition.id)
        .eq("lavage_id", lavageId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("lavage_caisses")
        .insert({
          lavage_id: lavageId,
          nom,
          code,
          solde_initial: soldeInitial,
          solde_actuel: soldeInitial,
          actif: true,
        });

      if (insertError) throw insertError;
    }

    setModalCaisse(false);
    await chargerDonnees({ silencieux: true });
  } catch (error) {
    console.error("Erreur enregistrement caisse :", error);
    setErreurFormulaire(
      error?.code === "23505"
        ? "Ce code est déjà utilisé dans cette station."
        : error?.message || "Impossible d'enregistrer la caisse."
    );
  } finally {
    setEnregistrement(false);
  }
};

const changerStatutCaisse = async (caisse) => {
  const action = caisse.actif ? "désactiver" : "réactiver";

  if (
    !window.confirm(
      `Veux-tu vraiment ${action} la caisse « ${caisse.nom} » ?`
    )
  ) {
    return;
  }

  setErreur("");

  try {
    const { error: updateError } = await supabase
      .from("lavage_caisses")
      .update({ actif: !caisse.actif })
      .eq("id", caisse.id)
      .eq("lavage_id", lavageId);

    if (updateError) throw updateError;

    await chargerDonnees({ silencieux: true });
  } catch (error) {
    console.error("Erreur changement statut caisse :", error);
    setErreur(
      error?.message || "Impossible de modifier le statut de cette caisse."
    );
  }
};

  const caissesParId = useMemo(
    () => Object.fromEntries(caisses.map((caisse) => [caisse.id, caisse])),
    [caisses]
  );

  const caissesActives = useMemo(
    () => caisses.filter((caisse) => caisse.actif),
    [caisses]
  );

  const soldeTotal = useMemo(
    () =>
        caissesActives.reduce(
        (total, caisse) => total + Number(caisse.solde_actuel || 0),
        0
        ),
    [caissesActives]
  );

  const soldeInitialTotal = useMemo(
    () =>
        caissesActives.reduce(
        (total, caisse) => total + Number(caisse.solde_initial || 0),
        0
        ),
    [caissesActives]
  );

  const mouvementsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();

    return mouvements.filter((mouvement) => {
      if (
        filtreCaisse !== "toutes" &&
        mouvement.caisse_id !== filtreCaisse
      ) {
        return false;
      }

      const entree = estEntree(mouvement.type_mouvement);

      if (filtreType === "entree" && !entree) return false;
      if (
        filtreType === "sortie" &&
        (entree ||
          !["sortie", "decaissement", "décaissement"].includes(
            typeNormalise(mouvement.type_mouvement)
          ))
      ) {
        return false;
      }

      if (dateDebut) {
        const dateMouvement = new Date(mouvement.date_mouvement);
        const debut = new Date(`${dateDebut}T00:00:00`);
        if (dateMouvement < debut) return false;
      }

      if (dateFin) {
        const dateMouvement = new Date(mouvement.date_mouvement);
        const fin = new Date(`${dateFin}T23:59:59.999`);
        if (dateMouvement > fin) return false;
      }

      if (terme) {
        const texte = [
          mouvement.motif,
          mouvement.type_mouvement,
          caissesParId[mouvement.caisse_id]?.nom,
          caissesParId[mouvement.caisse_id]?.code,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!texte.includes(terme)) return false;
      }

      return true;
    });
  }, [
    mouvements,
    filtreCaisse,
    filtreType,
    recherche,
    dateDebut,
    dateFin,
    caissesParId,
  ]);

  const totalEntreesFiltrees = mouvementsFiltres.reduce(
    (total, mouvement) =>
      total +
      (estEntree(mouvement.type_mouvement) ? Number(mouvement.montant || 0) : 0),
    0
  );

  const totalSortiesFiltrees = mouvementsFiltres.reduce(
    (total, mouvement) =>
      total +
      (["sortie", "decaissement", "décaissement"].includes(
        typeNormalise(mouvement.type_mouvement)
      )
        ? Number(mouvement.montant || 0)
        : 0),
    0
  );

  const stationSelectionnee = stations.find((s) => s.id === lavageId);

  if (chargement) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          Chargement de la caisse...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard/lavage"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au module lavage
            </Link>

            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: COULEUR_BLEU }}
              >
                <Wallet className="h-6 w-6" style={{ color: COULEUR_OR }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Gestion de caisse
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Consultation des soldes et des mouvements financiers.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
            type="button"
            onClick={() => chargerDonnees({ silencieux: true })}
            disabled={actualisation}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${actualisation ? "animate-spin" : ""}`}
            />
            Actualiser
          </button>
          <button
            type="button"
            onClick={ouvrirCreationCaisse}
            disabled={!lavageId || actualisation}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
            style={{ backgroundColor: COULEUR_BLEU }}
            >
            <Plus className="h-4 w-4" />
            Nouvelle caisse
          </button>
        </div>
          
        </div>

        {erreur && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Erreur de chargement</p>
              <p className="mt-1">{erreur}</p>
            </div>
          </div>
        )}

        {stations.length > 1 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="station"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Station de lavage
            </label>
            <select
              id="station"
              value={lavageId}
              onChange={(e) => setLavageId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 sm:max-w-md"
            >
              <option value="">Sélectionner une station</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.nom}
                </option>
              ))}
            </select>
          </section>
        )}

        {stations.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Landmark className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h2 className="font-semibold text-slate-900">
              Aucune station active
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Crée ou active une station de lavage pour consulter sa caisse.
            </p>
          </section>
        ) : !lavageId ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Landmark className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h2 className="font-semibold text-slate-900">
              Sélectionne une station
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Choisis la station dont tu souhaites consulter les caisses.
            </p>
          </section>
        ) : (
          <>
            <div className="text-sm text-slate-500">
              Station sélectionnée :{" "}
              <span className="font-semibold text-slate-800">
                {stationSelectionnee?.nom || "—"}
              </span>
            </div>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div
                className="rounded-2xl p-5 text-white shadow-sm"
                style={{ backgroundColor: COULEUR_BLEU }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">Solde total actuel</p>
                  <Wallet className="h-5 w-5" style={{ color: COULEUR_OR }} />
                </div>
                <p className="mt-3 text-2xl font-bold sm:text-3xl">
                  {formatMontant(soldeTotal)}
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {caisses.length} caisse(s) active(s)
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Solde initial cumulé</p>
                  <Banknote className="h-5 w-5 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {formatMontant(soldeInitialTotal)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Montants initiaux des caisses actives
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Mouvements affichés</p>
                  <ReceiptText className="h-5 w-5 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {mouvementsFiltres.length}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Historique limité aux 500 derniers mouvements chargés
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {caisses.map((caisse) => (
                <article
                  key={caisse.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-amber-50 p-3">
                        <Banknote
                          className="h-5 w-5"
                          style={{ color: COULEUR_BLEU }}
                        />
                      </div>
                      <div>
                        <h2 className="font-bold text-slate-900">{caisse.nom}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Code : {caisse.code}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Solde initial</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {formatMontant(caisse.solde_initial)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-xs text-slate-500">Solde actuel</p>
                      <p className="mt-1 font-bold text-slate-900">
                        {formatMontant(caisse.solde_actuel)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}

              {caisses.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center lg:col-span-2">
                  <Wallet className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                  <p className="font-semibold text-slate-800">
                    Aucune caisse active
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Cette station ne possède pas encore de caisse active.
                  </p>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Historique des mouvements
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Entrées et sorties enregistrées dans la caisse.
                    </p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                    {mouvementsFiltres.length} résultat(s)
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="relative xl:col-span-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={recherche}
                      onChange={(e) => setRecherche(e.target.value)}
                      placeholder="Rechercher un motif, une caisse..."
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <select
                    value={filtreCaisse}
                    onChange={(e) => setFiltreCaisse(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                  >
                    <option value="toutes">Toutes les caisses</option>
                    {caisses.map((caisse) => (
                      <option key={caisse.id} value={caisse.id}>
                        {caisse.nom}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtreType}
                    onChange={(e) => setFiltreType(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                  >
                    <option value="tous">Tous les mouvements</option>
                    <option value="entree">Entrées</option>
                    <option value="sortie">Sorties</option>
                  </select>

                  <div className="flex items-center gap-2">
                    <CalendarDays className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                    <input
                      type="date"
                      aria-label="Date de début"
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                      className="min-w-0 w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm outline-none focus:border-amber-400"
                    />
                    <input
                      type="date"
                      aria-label="Date de fin"
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                      className="min-w-0 w-full rounded-xl border border-slate-200 px-2 py-2.5 text-sm outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3">
                    <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-xs text-emerald-700">Total des entrées filtrées</p>
                      <p className="font-bold text-emerald-800">
                        {formatMontant(totalEntreesFiltrees)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3">
                    <ArrowUpRight className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-xs text-red-700">Total des sorties filtrées</p>
                      <p className="font-bold text-red-800">
                        {formatMontant(totalSortiesFiltrees)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Caisse</th>
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Motif</th>
                      <th className="px-5 py-3 text-right font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mouvementsFiltres.map((mouvement) => {
                      const entree = estEntree(mouvement.type_mouvement);
                      const caisse = caissesParId[mouvement.caisse_id];

                      return (
                        <tr key={mouvement.id} className="transition hover:bg-slate-50">
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                            {formatDate(mouvement.date_mouvement)}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-800">
                              {caisse?.nom || "Caisse"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {caisse?.code || "—"}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                entree
                                  ? "bg-emerald-50 text-emerald-700"
                                  : typeNormalise(mouvement.type_mouvement) === "sortie"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {entree ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              )}
                              {libelleType(mouvement.type_mouvement)}
                            </span>
                          </td>
                          <td className="max-w-md px-5 py-4 text-slate-600">
                            {mouvement.motif}
                          </td>
                          <td
                            className={`whitespace-nowrap px-5 py-4 text-right font-bold ${
                              entree ? "text-emerald-700" : "text-slate-800"
                            }`}
                          >
                            {entree ? "+" : ""}
                            {formatMontant(mouvement.montant)}
                          </td>
                        </tr>
                      );
                    })}

                    {mouvementsFiltres.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center">
                          <ReceiptText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                          <p className="font-semibold text-slate-700">
                            Aucun mouvement trouvé
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Modifie les filtres ou consulte cette caisse plus tard.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
      
    {modalCaisse && (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        onMouseDown={(e) => {
        if (e.target === e.currentTarget && !enregistrement) {
            setModalCaisse(false);
        }
        }}
    >
        <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div
            className="flex items-center justify-between px-5 py-4"
            style={{ backgroundColor: COULEUR_BLEU }}
        >
            <div>
            <h2 className="text-lg font-bold text-white">
                {caisseEnEdition ? "Modifier la caisse" : "Nouvelle caisse"}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
                {caisseEnEdition
                ? "Modifie le nom ou le code."
                : "Crée une caisse pour cette station."}
            </p>
            </div>

            <button
            type="button"
            onClick={() => setModalCaisse(false)}
            disabled={enregistrement}
            className="rounded-lg p-2 text-white hover:bg-white/10"
            aria-label="Fermer"
            >
            <X className="h-5 w-5" />
            </button>
        </div>

        <form onSubmit={enregistrerCaisse} className="space-y-4 p-5">
            {erreurFormulaire && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {erreurFormulaire}
            </div>
            )}

            <div>
            <label
                htmlFor="nomCaisse"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
                Nom de la caisse
            </label>
            <input
                id="nomCaisse"
                required
                maxLength={100}
                value={formCaisse.nom}
                onChange={(e) =>
                setFormCaisse((ancien) => ({
                    ...ancien,
                    nom: e.target.value,
                }))
                }
                placeholder="Ex. Caisse principale"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            </div>

            <div>
            <label
                htmlFor="codeCaisse"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
                Code de la caisse
            </label>
            <input
                id="codeCaisse"
                required
                maxLength={50}
                value={formCaisse.code}
                onChange={(e) =>
                setFormCaisse((ancien) => ({
                    ...ancien,
                    code: e.target.value.toUpperCase(),
                }))
                }
                placeholder="Ex. PRINCIPALE"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm uppercase outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            </div>

            {!caisseEnEdition && (
            <div>
                <label
                htmlFor="soldeInitialCaisse"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                Solde initial (FCFA)
                </label>
                <input
                id="soldeInitialCaisse"
                type="number"
                min="0"
                step="1"
                required
                value={formCaisse.solde_initial}
                onChange={(e) =>
                    setFormCaisse((ancien) => ({
                    ...ancien,
                    solde_initial: e.target.value,
                    }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                Ce montant sera utilisé comme solde initial et solde actuel à la création.
                </p>
            </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
                type="button"
                disabled={enregistrement}
                onClick={() => setModalCaisse(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
                Annuler
            </button>

            <button
                type="submit"
                disabled={enregistrement}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: COULEUR_BLEU }}
            >
                {enregistrement ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                <CheckCircle2 className="h-4 w-4" />
                )}
                {enregistrement
                ? "Enregistrement..."
                : caisseEnEdition
                ? "Enregistrer les modifications"
                : "Créer la caisse"}
            </button>
            </div>
        </form>
        </div>
    </div>
    )}

    </main>
  );
}
