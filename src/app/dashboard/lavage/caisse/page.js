
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
  Trash2,
  X,
  CheckCircle2,
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const COULEUR_OR = "#D8BD83";
const COULEUR_BLEU = "#14233B";

const formatMontant = (montant) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(montant || 0));

const formatDate = (date) => {
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const typeNormalise = (type) =>
  String(type || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

const estEntree = (type) => {
  const valeur = typeNormalise(type);

  return (
    valeur.includes("entree") ||
    valeur.includes("encaissement") ||
    valeur.includes("versement") ||
    valeur.includes("approvisionnement") ||
    valeur.includes("depot")
  );
};

const libelleType = (type) => {
  const valeur = typeNormalise(type);

  const libelles = {
    entree: "Entrée",
    encaissement: "Encaissement",
    versement: "Versement",
    approvisionnement: "Approvisionnement",
    depot: "Dépôt",
    sortie: "Sortie",
    decaissement: "Décaissement",
    retrait: "Retrait",
    depense: "Dépense",
    ouverture: "Ouverture",
    solde_initial: "Solde initial",
    ajustement: "Ajustement",
  };

  return (
    libelles[valeur] ||
    String(type || "Mouvement").replaceAll("_", " ")
  );
};

const erreurSupabase = (erreur) => {
  if (!erreur) return "Une erreur inattendue est survenue.";

  if (erreur.code === "23505") {
    return "Ce code de caisse existe déjà pour cette station.";
  }

  if (erreur.code === "23503") {
    return "Cette caisse est référencée par d’autres données et ne peut pas être supprimée.";
  }

  if (erreur.code === "42501") {
    return "Vous n’avez pas les autorisations nécessaires pour effectuer cette opération.";
  }

  return erreur.message || "Une erreur est survenue.";
};

const boutonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function CaisseLavagePage() {
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState("");
  const [messageSucces, setMessageSucces] = useState("");

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
  const [caisseEnSuppression, setCaisseEnSuppression] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [actionCaisseId, setActionCaisseId] = useState(null);

  const [modalTransfert, setModalTransfert] = useState(false);
  const [transfertEnCours, setTransfertEnCours] = useState(false);
  const [erreurTransfert, setErreurTransfert] = useState("");

  const [formTransfert, setFormTransfert] = useState({
    caisse_source_id: "",
    caisse_destination_id: "",
    montant: "",
    motif: "",
  });

  const [formCaisse, setFormCaisse] = useState({
    nom: "",
    code: "",
    solde_initial: "0",
  });

  const stationSelectionnee = useMemo(
    () => stations.find((station) => station.id === lavageId) || null,
    [stations, lavageId]
  );

  const caissesActives = useMemo(
    () => caisses.filter((caisse) => caisse.actif),
    [caisses]
  );

  const caisseSourceTransfert = useMemo(
    () =>
        caissesActives.find(
        (caisse) => caisse.id === formTransfert.caisse_source_id
        ) || null,
    [caissesActives, formTransfert.caisse_source_id]
    );

  const caissesDestinationsTransfert = useMemo(
    () =>
        caissesActives.filter(
        (caisse) => caisse.id !== formTransfert.caisse_source_id
        ),
    [caissesActives, formTransfert.caisse_source_id]
    );

  const caissesParId = useMemo(() => {
    return caisses.reduce((acc, caisse) => {
      acc[caisse.id] = caisse;
      return acc;
    }, {});
  }, [caisses]);

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

      if (filtreType === "entrees" && !estEntree(mouvement.type_mouvement)) {
        return false;
      }

      if (filtreType === "sorties" && estEntree(mouvement.type_mouvement)) {
        return false;
      }

      const dateMouvement = mouvement.date_mouvement
        ? new Date(mouvement.date_mouvement)
        : null;

      if (dateDebut && dateMouvement) {
        const debut = new Date(`${dateDebut}T00:00:00`);
        if (dateMouvement < debut) return false;
      }

      if (dateFin && dateMouvement) {
        const fin = new Date(`${dateFin}T23:59:59.999`);
        if (dateMouvement > fin) return false;
      }

      if (terme) {
        const caisse = caissesParId[mouvement.caisse_id];

        const contenu = [
          mouvement.motif,
          mouvement.type_mouvement,
          caisse?.nom,
          caisse?.code,
          mouvement.montant,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!contenu.includes(terme)) return false;
      }

      return true;
    });
  }, [
    mouvements,
    filtreCaisse,
    filtreType,
    dateDebut,
    dateFin,
    recherche,
    caissesParId,
  ]);

  const totalEntrees = useMemo(
    () =>
      mouvementsFiltres
        .filter((mouvement) => estEntree(mouvement.type_mouvement))
        .reduce((total, mouvement) => total + Number(mouvement.montant || 0), 0),
    [mouvementsFiltres]
  );

  const totalSorties = useMemo(
    () =>
      mouvementsFiltres
        .filter((mouvement) => !estEntree(mouvement.type_mouvement))
        .reduce((total, mouvement) => total + Number(mouvement.montant || 0), 0),
    [mouvementsFiltres]
  );

  const chargerDonnees = useCallback(
    async (options = {}) => {
      const silencieux = options.silencieux === true;

      if (silencieux) {
        setActualisation(true);
      } else {
        setChargement(true);
      }

      setErreur("");

      try {
        const {
          data: { user },
          error: erreurAuth,
        } = await supabase.auth.getUser();

        if (erreurAuth) throw erreurAuth;

        if (!user) {
          throw new Error(
            "Votre session a expiré. Veuillez vous reconnecter."
          );
        }

        const { data: stationsData, error: erreurStations } = await supabase
          .from("lavages")
          .select("id, nom, actif")
          .eq("owner_id", user.id)
          .eq("actif", true)
          .order("nom", { ascending: true });

        if (erreurStations) throw erreurStations;

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
          stationId =
            listeStations.length === 1 ? listeStations[0].id : "";
          setLavageId(stationId);
        }

        if (!stationId) {
          setCaisses([]);
          setMouvements([]);
          return;
        }

        const stationExiste = listeStations.some(
          (station) => station.id === stationId
        );

        if (!stationExiste) {
          setCaisses([]);
          setMouvements([]);
          return;
        }

        const [
          { data: caissesData, error: erreurCaisses },
          { data: mouvementsData, error: erreurMouvements },
        ] = await Promise.all([
          supabase
            .from("lavage_caisses")
            .select(
              "id, lavage_id, code, nom, solde_initial, solde_actuel, actif, created_at"
            )
            .eq("lavage_id", stationId)
            .order("nom", { ascending: true }),

          supabase
            .from("lavage_mouvements_caisse")
            .select(
              "id, lavage_id, caisse_id, service_id, encaissement_id, type_mouvement, motif, montant, date_mouvement, created_by, created_at"
            )
            .eq("lavage_id", stationId)
            .order("date_mouvement", { ascending: false })
            .limit(500),
        ]);

        if (erreurCaisses) throw erreurCaisses;
        if (erreurMouvements) throw erreurMouvements;

        setCaisses(caissesData || []);
        setMouvements(mouvementsData || []);
      } catch (err) {
        console.error("Erreur de chargement des caisses :", err);
        setErreur(erreurSupabase(err));
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
    setMessageSucces("");
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
    setMessageSucces("");
    setModalCaisse(true);
  };

  const fermerModalCaisse = () => {
    if (enregistrement) return;

    setModalCaisse(false);
    setCaisseEnEdition(null);
    setErreurFormulaire("");
  };

  const enregistrerCaisse = async (event) => {
    event.preventDefault();
    setErreurFormulaire("");
    setMessageSucces("");

    if (!lavageId) {
      setErreurFormulaire("Sélectionnez une station de lavage.");
      return;
    }

    const nom = formCaisse.nom.trim();
    const code = formCaisse.code.trim();
    const soldeInitial = Number(formCaisse.solde_initial);

    if (!nom || !code) {
      setErreurFormulaire("Le nom et le code de la caisse sont obligatoires.");
      return;
    }

    if (
      !caisseEnEdition &&
      (formCaisse.solde_initial.trim() === "" ||
        !Number.isFinite(soldeInitial) ||
        soldeInitial < 0)
    ) {
      setErreurFormulaire(
        "Le solde initial doit être un nombre positif ou nul."
      );
      return;
    }

    setEnregistrement(true);

    try {
      const {
        data: { user },
        error: erreurAuth,
      } = await supabase.auth.getUser();

      if (erreurAuth) throw erreurAuth;

      if (!user) {
        throw new Error("Votre session a expiré. Veuillez vous reconnecter.");
      }

      const { data: station, error: erreurStation } = await supabase
        .from("lavages")
        .select("id")
        .eq("id", lavageId)
        .eq("owner_id", user.id)
        .eq("actif", true)
        .maybeSingle();

      if (erreurStation) throw erreurStation;

      if (!station) {
        throw new Error(
          "Station introuvable ou vous n’êtes pas autorisé à la gérer."
        );
      }

      let verificationCode = supabase
        .from("lavage_caisses")
        .select("id")
        .eq("lavage_id", lavageId)
        .ilike("code", code);

      if (caisseEnEdition) {
        verificationCode = verificationCode.neq("id", caisseEnEdition.id);
      }

      const { data: caisseExistante, error: erreurVerification } =
        await verificationCode.maybeSingle();

      if (erreurVerification) throw erreurVerification;

      if (caisseExistante) {
        throw new Error("Ce code de caisse est déjà utilisé dans cette station.");
      }

      if (caisseEnEdition) {
        const { error: erreurUpdate } = await supabase
          .from("lavage_caisses")
          .update({
            nom,
            code,
          })
          .eq("id", caisseEnEdition.id)
          .eq("lavage_id", lavageId);

        if (erreurUpdate) throw erreurUpdate;

        setMessageSucces("La caisse a été modifiée.");
      } else {
        const { error: erreurInsert } = await supabase
          .from("lavage_caisses")
          .insert({
            lavage_id: lavageId,
            nom,
            code,
            solde_initial: soldeInitial,
            solde_actuel: soldeInitial,
            actif: true,
          });

        if (erreurInsert) throw erreurInsert;

        setMessageSucces("La caisse a été créée.");
      }

      setModalCaisse(false);
      setCaisseEnEdition(null);

      await chargerDonnees({ silencieux: true });
    } catch (err) {
      console.error("Erreur d'enregistrement de caisse :", err);
      setErreurFormulaire(erreurSupabase(err));
    } finally {
      setEnregistrement(false);
    }
  };

  const changerStatutCaisse = async (caisse) => {
    const nouveauStatut = !caisse.actif;

    const confirmation = nouveauStatut
      ? `Voulez-vous réactiver la caisse « ${caisse.nom} » ?`
      : `Voulez-vous désactiver la caisse « ${caisse.nom} » ?\n\nSon historique sera conservé.`;

    if (!window.confirm(confirmation)) return;

    setActionCaisseId(caisse.id);
    setErreur("");
    setMessageSucces("");

    try {
      const { error: erreurUpdate } = await supabase
        .from("lavage_caisses")
        .update({ actif: nouveauStatut })
        .eq("id", caisse.id)
        .eq("lavage_id", caisse.lavage_id);

      if (erreurUpdate) throw erreurUpdate;

      setMessageSucces(
        nouveauStatut
          ? "La caisse a été réactivée."
          : "La caisse a été désactivée."
      );

      await chargerDonnees({ silencieux: true });
    } catch (err) {
      console.error("Erreur de changement de statut :", err);
      setErreur(erreurSupabase(err));
    } finally {
      setActionCaisseId(null);
    }
  };

  const supprimerCaisse = async () => {
    if (!caisseEnSuppression || !lavageId) return;

    const caisse = caisseEnSuppression;

    setSuppressionEnCours(true);
    setErreur("");
    setMessageSucces("");

    try {
      const {
        data: { user },
        error: erreurAuth,
      } = await supabase.auth.getUser();

      if (erreurAuth) throw erreurAuth;

      if (!user) {
        throw new Error("Votre session a expiré. Veuillez vous reconnecter.");
      }

      // Vérifier que la station appartient bien à l'utilisateur connecté.
      const { data: station, error: erreurStation } = await supabase
        .from("lavages")
        .select("id")
        .eq("id", lavageId)
        .eq("owner_id", user.id)
        .eq("actif", true)
        .maybeSingle();

      if (erreurStation) throw erreurStation;

      if (!station) {
        throw new Error(
          "Station introuvable ou vous n’êtes pas autorisé à la gérer."
        );
      }

      // Vérifier les mouvements associés à cette caisse.
      const { count, error: erreurMouvements } = await supabase
        .from("lavage_mouvements_caisse")
        .select("id", { count: "exact", head: true })
        .eq("lavage_id", lavageId)
        .eq("caisse_id", caisse.id);

      if (erreurMouvements) throw erreurMouvements;

      if ((count || 0) > 0) {
        throw new Error(
          "Cette caisse possède des mouvements financiers. Sa suppression est refusée pour préserver l’historique. Vous pouvez la désactiver."
        );
      }

      // La suppression n'est autorisée que si aucun mouvement n'existe.
      const { data: caisseSupprimee, error: erreurSuppression } =
        await supabase
          .from("lavage_caisses")
          .delete()
          .eq("id", caisse.id)
          .eq("lavage_id", lavageId)
          .select("id")
          .maybeSingle();

      if (erreurSuppression) throw erreurSuppression;

      if (!caisseSupprimee) {
        throw new Error(
          "La caisse n’a pas été supprimée. Vérifiez vos autorisations et réessayez."
        );
      }

      setCaisseEnSuppression(null);
      setMessageSucces(`La caisse « ${caisse.nom} » a été supprimée.`);

      await chargerDonnees({ silencieux: true });
    } catch (err) {
      console.error("Erreur de suppression de caisse :", err);
      setErreur(erreurSupabase(err));
    } finally {
      setSuppressionEnCours(false);
    }
  };

  const demanderSuppression = (caisse) => {
    setErreur("");
    setMessageSucces("");
    setCaisseEnSuppression(caisse);
  };

  if (chargement) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          <span>Chargement des caisses...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/dashboard/lavage"
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au module Lavage
            </Link>

            <h1
              className="text-2xl font-bold sm:text-3xl"
              style={{ color: COULEUR_BLEU }}
            >
              Gestion de caisse
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Gérez vos caisses et consultez leurs mouvements financiers.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={ouvrirCreationCaisse}
              disabled={!lavageId}
              className={boutonBase}
              style={{ backgroundColor: COULEUR_BLEU, color: "white" }}
            >
              <Plus className="h-4 w-4" />
              Nouvelle caisse
            </button>

            <button
              type="button"
              onClick={() => chargerDonnees({ silencieux: true })}
              disabled={actualisation}
              className={`${boutonBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`}
            >
              <RefreshCw
                className={`h-4 w-4 ${actualisation ? "animate-spin" : ""}`}
              />
              Actualiser
            </button>
          </div>
        </div>

        {erreur && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{erreur}</p>
          </div>
        )}

        {messageSucces && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{messageSucces}</p>
          </div>
        )}

        {stations.length > 1 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Station de lavage
            </label>
            <select
              value={lavageId}
              onChange={(event) => setLavageId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400 sm:max-w-md"
            >
              <option value="">Sélectionner une station</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.nom}
                </option>
              ))}
            </select>
          </div>
        )}

        {stations.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Landmark className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <h2 className="font-semibold text-slate-800">
              Aucune station de lavage active
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Créez ou activez une station de lavage pour gérer ses caisses.
            </p>
          </div>
        ) : !lavageId ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            Sélectionnez une station pour consulter ses caisses.
          </div>
        ) : (
          <>
            {stationSelectionnee && (
              <p className="text-sm text-slate-500">
                Station sélectionnée :{" "}
                <span className="font-semibold text-slate-800">
                  {stationSelectionnee.nom}
                </span>
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Solde actuel des caisses actives
                  </span>
                  <Wallet className="h-5 w-5 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {formatMontant(soldeTotal)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Soldes initiaux des caisses actives
                  </span>
                  <Banknote className="h-5 w-5 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {formatMontant(soldeInitialTotal)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Caisses actives
                  </span>
                  <Landmark className="h-5 w-5 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {caissesActives.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {caisses.length} caisse(s) au total
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Mouvements chargés
                  </span>
                  <ReceiptText className="h-5 w-5 text-slate-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {mouvements.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Maximum 500 mouvements récents
                </p>
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Mes caisses ({caisses.length})
                  </h2>
                  <p className="text-sm text-slate-500">
                    Créez plusieurs caisses et gérez leur état individuellement.
                  </p>
                </div>
              </div>

              {caisses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <Wallet className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                  <h3 className="font-semibold text-slate-800">
                    Aucune caisse enregistrée
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Créez votre première caisse pour cette station.
                  </p>
                  <button
                    type="button"
                    onClick={ouvrirCreationCaisse}
                    className={`${boutonBase} mt-4`}
                    style={{
                      backgroundColor: COULEUR_BLEU,
                      color: "white",
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Créer une caisse
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {caisses.map((caisse) => (
                    <article
                      key={caisse.id}
                      className={`rounded-2xl border bg-white p-5 shadow-sm ${
                        caisse.actif
                          ? "border-slate-200"
                          : "border-amber-200 opacity-90"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className="rounded-xl p-3"
                            style={{
                              backgroundColor: `${COULEUR_OR}35`,
                              color: COULEUR_BLEU,
                            }}
                          >
                            <Wallet className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="break-words font-bold text-slate-900">
                              {caisse.nom}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Code : {caisse.code}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            caisse.actif
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {caisse.actif ? "Active" : "Désactivée"}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            Solde initial
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {formatMontant(caisse.solde_initial)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            Solde actuel
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {formatMontant(caisse.solde_actuel)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => ouvrirEditionCaisse(caisse)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Modifier
                        </button>

                        <button
                          type="button"
                          onClick={() => changerStatutCaisse(caisse)}
                          disabled={actionCaisseId === caisse.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {actionCaisseId === caisse.id ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                          {caisse.actif ? "Désactiver" : "Réactiver"}
                        </button>

                        <button
                          type="button"
                          onClick={() => demanderSuppression(caisse)}
                          disabled={actionCaisseId === caisse.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Historique des mouvements
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Consultez les entrées et sorties enregistrées dans vos caisses.
                </p>
              </div>

              <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={recherche}
                    onChange={(event) => setRecherche(event.target.value)}
                    placeholder="Rechercher..."
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <select
                  value={filtreCaisse}
                  onChange={(event) => setFiltreCaisse(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="toutes">Toutes les caisses</option>
                  {caisses.map((caisse) => (
                    <option key={caisse.id} value={caisse.id}>
                      {caisse.nom}
                      {!caisse.actif ? " (désactivée)" : ""}
                    </option>
                  ))}
                </select>

                <select
                  value={filtreType}
                  onChange={(event) => setFiltreType(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="tous">Toutes les opérations</option>
                  <option value="entrees">Entrées</option>
                  <option value="sorties">Sorties</option>
                </select>

                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                    Du
                  </label>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(event) => setDateDebut(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                    Au
                  </label>
                  <input
                    type="date"
                    value={dateFin}
                    min={dateDebut || undefined}
                    onChange={(event) => setDateFin(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
                  <div className="rounded-lg bg-white p-2 text-emerald-700">
                    <ArrowDownLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700">
                      Total des entrées filtrées
                    </p>
                    <p className="mt-1 font-bold text-emerald-900">
                      {formatMontant(totalEntrees)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4">
                  <div className="rounded-lg bg-white p-2 text-red-700">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-red-700">
                      Total des sorties filtrées
                    </p>
                    <p className="mt-1 font-bold text-red-900">
                      {formatMontant(totalSorties)}
                    </p>
                  </div>
                </div>
              </div>

              {mouvementsFiltres.length === 0 ? (
                <div className="p-10 text-center">
                  <ReceiptText className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                  <p className="font-medium text-slate-700">
                    Aucun mouvement trouvé
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Modifiez les filtres ou attendez de nouveaux mouvements.
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {mouvementsFiltres.map((mouvement) => {
                      const entree = estEntree(mouvement.type_mouvement);
                      const caisse = caissesParId[mouvement.caisse_id];

                      return (
                        <div key={mouvement.id} className="space-y-2 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {mouvement.motif || "Mouvement de caisse"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(mouvement.date_mouvement)}
                              </p>
                            </div>

                            <p
                              className={`shrink-0 text-sm font-bold ${
                                entree ? "text-emerald-700" : "text-red-700"
                              }`}
                            >
                              {entree ? "+" : "−"}
                              {formatMontant(mouvement.montant)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">
                              {libelleType(mouvement.type_mouvement)}
                            </span>
                            <span>
                              Caisse : {caisse?.nom || "Caisse inconnue"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Date</th>
                          <th className="px-5 py-4 font-semibold">Caisse</th>
                          <th className="px-5 py-4 font-semibold">Type</th>
                          <th className="px-5 py-4 font-semibold">Motif</th>
                          <th className="px-5 py-4 text-right font-semibold">
                            Montant
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mouvementsFiltres.map((mouvement) => {
                          const entree = estEntree(mouvement.type_mouvement);
                          const caisse = caissesParId[mouvement.caisse_id];

                          return (
                            <tr
                              key={mouvement.id}
                              className="transition hover:bg-slate-50"
                            >
                              <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                                {formatDate(mouvement.date_mouvement)}
                              </td>
                              <td className="px-5 py-4">
                                <p className="font-medium text-slate-800">
                                  {caisse?.nom || "Caisse inconnue"}
                                </p>
                                {caisse?.code && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {caisse.code}
                                  </p>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    entree
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-red-50 text-red-700"
                                  }`}
                                >
                                  {libelleType(mouvement.type_mouvement)}
                                </span>
                              </td>
                              <td className="max-w-xs px-5 py-4 text-slate-600">
                                <span className="line-clamp-2">
                                  {mouvement.motif || "—"}
                                </span>
                              </td>
                              <td
                                className={`whitespace-nowrap px-5 py-4 text-right font-bold ${
                                  entree ? "text-emerald-700" : "text-red-700"
                                }`}
                              >
                                {entree ? "+" : "−"}
                                {formatMontant(mouvement.montant)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                {mouvementsFiltres.length} mouvement(s) affiché(s).
              </div>
            </section>
          </>
        )}
      </div>

      {modalCaisse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-modal-caisse"
            className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="titre-modal-caisse"
                  className="text-lg font-bold"
                  style={{ color: COULEUR_BLEU }}
                >
                  {caisseEnEdition ? "Modifier la caisse" : "Nouvelle caisse"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {caisseEnEdition
                    ? "Modifiez le nom et le code de la caisse."
                    : "Créez une caisse indépendante pour cette station."}
                </p>
              </div>

              <button
                type="button"
                onClick={fermerModalCaisse}
                disabled={enregistrement}
                aria-label="Fermer"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={enregistrerCaisse} className="space-y-4 p-5">
              {erreurFormulaire && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{erreurFormulaire}</p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Nom de la caisse *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formCaisse.nom}
                  onChange={(event) =>
                    setFormCaisse((ancien) => ({
                      ...ancien,
                      nom: event.target.value,
                    }))
                  }
                  placeholder="Ex. Caisse principale"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Code de la caisse *
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={formCaisse.code}
                  onChange={(event) =>
                    setFormCaisse((ancien) => ({
                      ...ancien,
                      code: event.target.value,
                    }))
                  }
                  placeholder="Ex. CAISSE-01"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm uppercase outline-none focus:border-slate-400"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Le code doit être unique au sein de cette station.
                </p>
              </div>

              {!caisseEnEdition && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Solde initial (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={formCaisse.solde_initial}
                    onChange={(event) =>
                      setFormCaisse((ancien) => ({
                        ...ancien,
                        solde_initial: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Le solde actuel sera initialisé à ce montant.
                  </p>
                </div>
              )}

              {caisseEnEdition && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  Le solde initial et le solde actuel ne sont pas modifiés par
                  ce formulaire.
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={fermerModalCaisse}
                  disabled={enregistrement}
                  className={`${boutonBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={enregistrement}
                  className={boutonBase}
                  style={{ backgroundColor: COULEUR_BLEU, color: "white" }}
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

      {caisseEnSuppression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-suppression-caisse"
            className="my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start gap-3 border-b border-slate-100 p-5">
              <div className="rounded-xl bg-red-50 p-3 text-red-700">
                <Trash2 className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <h2
                  id="titre-suppression-caisse"
                  className="font-bold text-slate-900"
                >
                  Supprimer cette caisse ?
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {caisseEnSuppression.nom} — code{" "}
                  {caisseEnSuppression.code}
                </p>
              </div>

              <button
                type="button"
                disabled={suppressionEnCours}
                onClick={() => setCaisseEnSuppression(null)}
                aria-label="Fermer"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <p className="text-sm leading-6 text-slate-600">
                La suppression sera possible uniquement si aucun mouvement
                financier n’est associé à cette caisse. Si elle possède déjà un
                historique, vous devrez la désactiver.
              </p>

              {erreur && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{erreur}</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={suppressionEnCours}
                  onClick={() => setCaisseEnSuppression(null)}
                  className={`${boutonBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  Annuler
                </button>

                <button
                  type="button"
                  disabled={suppressionEnCours}
                  onClick={supprimerCaisse}
                  className={`${boutonBase} bg-red-600 text-white hover:bg-red-700`}
                >
                  {suppressionEnCours ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {suppressionEnCours ? "Suppression..." : "Confirmer la suppression"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
