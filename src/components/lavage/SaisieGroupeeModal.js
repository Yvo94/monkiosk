
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Users,
  CarFront,
  Wallet,
  Receipt,
  CalendarDays,
  RefreshCw,
  ClipboardList,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

const MODES_PAIEMENT = [
  ["especes", "Espèces"],
  ["wave", "Wave"],
  ["orange_money", "Orange Money"],
  ["mtn_money", "MTN Money"],
  ["moov_money", "Moov Money"],
  ["carte", "Carte bancaire"],
  ["virement", "Virement bancaire"],
  ["autre", "Autre"],
];

function obtenirDateAbidjan() {
  const maintenant = new Date();

  const parties = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(maintenant);

  const valeurs = Object.fromEntries(
    parties.map((partie) => [partie.type, partie.value])
  );

  return `${valeurs.year}-${valeurs.month}-${valeurs.day}`;
}

function normaliser(texte = "") {
  return String(texte)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]/g, "");
}

function correspondreTypeVehicule(libelle, types) {
  const recherche = normaliser(libelle);

  if (!recherche) return null;

  return (
    types.find((type) => normaliser(type.nom) === recherche) ||
    types.find((type) => {
      const nom = normaliser(type.nom);
      return (
        nom.replace(/s$/, "") === recherche.replace(/s$/, "")
      );
    }) ||
    null
  );
}

/*function analyserLigne(ligne, index, laveurs, typesVehicules) {
  const texte = ligne.trim();

  if (!texte) return null;

  const separateur = texte.indexOf(":");

  if (separateur === -1) {
    return {
      index,
      ligne: texte,
      erreur: "Format attendu : Nom du laveur : quantité véhicule.",
      operations: [],
    };
  }

  const nomLaveur = texte.slice(0, separateur).trim();
  const contenu = texte.slice(separateur + 1).trim();

  if (!nomLaveur || !contenu) {
    return {
      index,
      ligne: texte,
      erreur: "Nom du laveur ou liste des véhicules manquant.",
      operations: [],
    };
  }

  const laveur = laveurs.find(
    (item) => normaliser(item.nom) === normaliser(nomLaveur)
  );

  if (!laveur) {
    return {
      index,
      nomLaveur,
      ligne: texte,
      erreur: `Laveur « ${nomLaveur} » introuvable dans la station.`,
      operations: [],
    };
  }

  const expression =
    /(\d+)\s*([a-zA-ZÀ-ÿ0-9×xX -]+?)(?=\s*(?:,|et)\s*\d+\s*|\.?$)/gi;

  const operations = [];
  let correspondance;
  let dernierIndex = 0;

  while ((correspondance = expression.exec(contenu)) !== null) {
    const quantite = Number(correspondance[1]);
    const libelle = correspondance[2]
      .trim()
      .replace(/[.,]+$/, "");

    dernierIndex = expression.lastIndex;

    if (!Number.isInteger(quantite) || quantite < 1 || quantite > 50) {
      return {
        index,
        nomLaveur,
        laveur,
        ligne: texte,
        erreur: `Quantité invalide pour « ${libelle} ». Elle doit être comprise entre 1 et 50.`,
        operations: [],
      };
    }

    const typeVehicule = correspondreTypeVehicule(
      libelle,
      typesVehicules
    );

    if (!typeVehicule) {
      return {
        index,
        nomLaveur,
        laveur,
        ligne: texte,
        erreur: `Type de véhicule « ${libelle} » non reconnu.`,
        operations: [],
      };
    }

    operations.push({
      laveur_id: laveur.id,
      laveur_nom: laveur.nom,
      type_vehicule_id: typeVehicule.id,
      type_vehicule_nom: typeVehicule.nom,
      quantite,
    });
  }

  if (operations.length === 0) {
    return {
      index,
      nomLaveur,
      laveur,
      ligne: texte,
      erreur: "Aucun véhicule reconnu dans cette ligne.",
      operations: [],
    };
  }

  const totalVehicules = operations.reduce(
    (total, operation) => total + operation.quantite,
    0
  );

  if (totalVehicules > 200) {
    return {
      index,
      nomLaveur,
      laveur,
      ligne: texte,
      erreur: "Un groupe ne peut pas dépasser 200 véhicules.",
      operations: [],
    };
  }

  return {
    index,
    nomLaveur,
    laveur,
    ligne: texte,
    operations,
    totalVehicules,
    erreur: null,
  };
}*/


function echapperRegex(texte = "") {
  return String(texte).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function analyserLigne(ligne, index, laveurs, typesVehicules) {
  const texte = ligne.trim();

  if (!texte) return null;

  let nomLaveur = "";
  let contenu = "";

  // 1. Format classique : Hamedo : 5 motos
  const separateur = texte.indexOf(":");

  if (separateur !== -1) {
    nomLaveur = texte.slice(0, separateur).trim();
    contenu = texte.slice(separateur + 1).trim();
  } else {
    // 2. Format : Hamedo 5 motos
    const laveurDebut = [...laveurs]
      .sort((a, b) => b.nom.length - a.nom.length)
      .find((item) => {
        const expression = new RegExp(
          `^${echapperRegex(item.nom)}(?:\\s+|$)`,
          "i"
        );

        return expression.test(texte);
      });

    if (laveurDebut) {
      nomLaveur = laveurDebut.nom;

      contenu = texte
        .replace(
          new RegExp(
            `^${echapperRegex(laveurDebut.nom)}\\s*`,
            "i"
          ),
          ""
        )
        .trim();
    } else {
      // 3. Format : 5 motos pour Hamedo
      // 4. Format : 5 motos pour le laveur Hamedo
      const laveurFin = [...laveurs]
        .sort((a, b) => b.nom.length - a.nom.length)
        .find((item) => {
          const expression = new RegExp(
            `\\s+(?:pour\\s+)?(?:le\\s+laveur\\s+)?${echapperRegex(item.nom)}\\s*[.!]?$`,
            "i"
          );

          return expression.test(texte);
        });

      if (laveurFin) {
        nomLaveur = laveurFin.nom;

        const expression = new RegExp(
          `\\s+(?:pour\\s+)?(?:le\\s+laveur\\s+)?${echapperRegex(laveurFin.nom)}\\s*[.!]?$`,
          "i"
        );

        contenu = texte.replace(expression, "").trim();
      }
    }
  }

  if (!nomLaveur || !contenu) {
    return {
      index,
      ligne: texte,
      erreur:
        "Format non reconnu. Utilisez « Hamedo : 5 motos », « Hamedo 5 motos » ou « 5 motos pour Hamedo ».",
      operations: [],
    };
  }

  // Recherche du laveur dans le catalogue
  const laveur = laveurs.find(
    (item) => normaliser(item.nom) === normaliser(nomLaveur)
  );

  if (!laveur) {
    return {
      index,
      nomLaveur,
      ligne: texte,
      erreur: `Laveur « ${nomLaveur} » introuvable dans la station.`,
      operations: [],
    };
  }

  // Séparation des différents types de véhicules
  const segments = contenu
    .replace(/[.!]+$/, "")
    .split(/\s*(?:,|;|\bet\b)\s*/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const operations = [];

  for (const segment of segments) {
    const correspondance = segment.match(/^(\d+)\s*(.+)$/);

    if (!correspondance) {
      return {
        index,
        nomLaveur,
        laveur,
        ligne: texte,
        erreur: `Format incorrect pour « ${segment} ». Indiquez une quantité suivie du type de véhicule.`,
        operations: [],
      };
    }

    const quantite = Number(correspondance[1]);
    const libelle = correspondance[2].trim();

    if (
      !Number.isInteger(quantite) ||
      quantite < 1 ||
      quantite > 50
    ) {
      return {
        index,
        nomLaveur,
        laveur,
        ligne: texte,
        erreur: `Quantité invalide pour « ${libelle} ». Elle doit être comprise entre 1 et 50.`,
        operations: [],
      };
    }

    const typeVehicule = correspondreTypeVehicule(
      libelle,
      typesVehicules
    );

    if (!typeVehicule) {
      return {
        index,
        nomLaveur,
        laveur,
        ligne: texte,
        erreur: `Type de véhicule « ${libelle} » non reconnu.`,
        operations: [],
      };
    }

    operations.push({
      laveur_id: laveur.id,
      laveur_nom: laveur.nom,
      type_vehicule_id: typeVehicule.id,
      type_vehicule_nom: typeVehicule.nom,
      quantite,
    });
  }

  if (operations.length === 0) {
    return {
      index,
      nomLaveur,
      laveur,
      ligne: texte,
      erreur: "Aucun véhicule reconnu dans cette ligne.",
      operations: [],
    };
  }

  const totalVehicules = operations.reduce(
    (total, operation) => total + operation.quantite,
    0
  );

  if (totalVehicules > 200) {
    return {
      index,
      nomLaveur,
      laveur,
      ligne: texte,
      erreur: "Un groupe ne peut pas dépasser 200 véhicules.",
      operations: [],
    };
  }

  return {
    index,
    nomLaveur,
    laveur,
    ligne: texte,
    operations,
    totalVehicules,
    erreur: null,
  };
}


function formaterMontant(montant, devise = "FCFA") {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Number(montant) || 0)} ${devise}`;
}

export default function SaisieGroupeeModal({
  open,
  onClose,
  onSuccess,
}) {
  const [chargement, setChargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  const [erreur, setErreur] = useState("");
  const [messageSucces, setMessageSucces] = useState("");

  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState("");

  const [prestations, setPrestations] = useState([]);
  const [typesVehicules, setTypesVehicules] = useState([]);
  const [laveurs, setLaveurs] = useState([]);
  const [tarifs, setTarifs] = useState([]);

  const [prestationId, setPrestationId] = useState("");
  const [dateService, setDateService] = useState(obtenirDateAbidjan());

  const [texteSaisie, setTexteSaisie] = useState("");

  const [modesPaiement, setModesPaiement] = useState({});

  const idempotencyKeyRef = useRef(null);

  const station = stations.find((item) => item.id === stationId);

  const devise = station?.devise || "FCFA";

  const reinitialiserCle = useCallback(() => {
    idempotencyKeyRef.current = null;
  }, []);

  const chargerCatalogue = useCallback(async (id) => {
    if (!id) return;

    setChargement(true);
    setErreur("");

    try {
      const [
        prestationsResultat,
        typesResultat,
        laveursResultat,
        tarifsResultat,
      ] = await Promise.all([
        supabase
          .from("lavage_prestations")
          .select("id, lavage_id, nom, description, actif")
          .eq("lavage_id", id)
          .eq("actif", true)
          .order("nom"),

        supabase
          .from("lavage_types_vehicule")
          .select("id, lavage_id, nom, description, actif")
          .eq("lavage_id", id)
          .eq("actif", true)
          .order("nom"),

        supabase
          .from("lavage_laveurs")
          .select("id, lavage_id, nom, telephone, actif")
          .eq("lavage_id", id)
          .eq("actif", true)
          .order("nom"),

        supabase
          .from("lavage_tarifs")
          .select(
            "id, lavage_id, type_vehicule_id, prestation_id, prix, commission_laveur, actif"
          )
          .eq("lavage_id", id)
          .eq("actif", true),
      ]);

      const resultats = [
        prestationsResultat,
        typesResultat,
        laveursResultat,
        tarifsResultat,
      ];

      const erreurCatalogue = resultats.find((resultat) => resultat.error);

      if (erreurCatalogue) {
        throw new Error(erreurCatalogue.error.message);
      }

      setPrestations(prestationsResultat.data || []);
      setTypesVehicules(typesResultat.data || []);
      setLaveurs(laveursResultat.data || []);
      setTarifs(tarifsResultat.data || []);

      setPrestationId("");
      setTexteSaisie("");
      setModesPaiement({});
      reinitialiserCle();
    } catch (error) {
      setErreur(
        error.message || "Impossible de charger le catalogue de la station."
      );
    } finally {
      setChargement(false);
    }
  }, [reinitialiserCle]);

  useEffect(() => {
    if (!open) return;

    let actif = true;

    async function initialiser() {
      setChargement(true);
      setErreur("");
      setMessageSucces("");

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData?.user) {
          throw new Error("Vous devez être connecté.");
        }

        const reponse = await fetch("/api/lavage/services", {
          method: "GET",
          cache: "no-store",
        });

        const donnees = await reponse.json();

        if (!reponse.ok) {
          throw new Error(
            donnees.error || "Impossible de charger les stations."
          );
        }

        const listeStations =
          donnees.stations ||
          donnees.data?.stations ||
          [];

        if (!actif) return;

        setStations(listeStations);

        const stationPreferee =
          donnees.station?.id ||
          donnees.data?.station?.id ||
          listeStations.find((item) => item.actif)?.id ||
          listeStations[0]?.id ||
          "";

        setStationId(stationPreferee);

        if (stationPreferee) {
          await chargerCatalogue(stationPreferee);
        } else {
          setErreur("Aucune station de lavage disponible.");
        }
      } catch (error) {
        if (actif) {
          setErreur(error.message || "Une erreur est survenue.");
        }
      } finally {
        if (actif) setChargement(false);
      }
    }

    initialiser();

    return () => {
      actif = false;
    };
  }, [open, chargerCatalogue]);

  const groupes = useMemo(() => {
    if (!texteSaisie.trim()) return [];

    return texteSaisie
      .split(/\r?\n/)
      .map((ligne, index) =>
        analyserLigne(
          ligne,
          index,
          laveurs,
          typesVehicules
        )
      )
      .filter(Boolean);
  }, [texteSaisie, laveurs, typesVehicules]);

  const tarifsMap = useMemo(() => {
    const resultat = new Map();

    tarifs.forEach((tarif) => {
      resultat.set(
        `${tarif.prestation_id}_${tarif.type_vehicule_id}`,
        tarif
      );
    });

    return resultat;
  }, [tarifs]);

  const groupesAvecTarifs = useMemo(() => {
    return groupes.map((groupe) => {
      if (groupe.erreur) {
        return { ...groupe, operationsTarifees: [] };
      }

      const operationsTarifees = groupe.operations.map((operation) => {
        const tarif = tarifsMap.get(
          `${prestationId}_${operation.type_vehicule_id}`
        );

        return {
          ...operation,
          tarif,
          prix: Number(tarif?.prix || 0),
          commission: Number(tarif?.commission_laveur || 0),
          total: Number(tarif?.prix || 0) * operation.quantite,
          commissionTotale:
            Number(tarif?.commission_laveur || 0) *
            operation.quantite,
        };
      });

      const tarifManquant = operationsTarifees.some(
        (operation) => !operation.tarif
      );

      const total = operationsTarifees.reduce(
        (somme, operation) => somme + operation.total,
        0
      );

      const commission = operationsTarifees.reduce(
        (somme, operation) => somme + operation.commissionTotale,
        0
      );

      return {
        ...groupe,
        operationsTarifees,
        tarifManquant,
        total,
        commission,
        modePaiement: modesPaiement[groupe.index] || "especes",
      };
    });
  }, [groupes, tarifsMap, prestationId, modesPaiement]);

  const erreurs = groupesAvecTarifs.filter(
    (groupe) => groupe.erreur || groupe.tarifManquant
  );

  const groupesValides = groupesAvecTarifs.filter(
    (groupe) =>
      !groupe.erreur &&
      !groupe.tarifManquant &&
      groupe.operationsTarifees.length > 0
  );

  const nombreVehicules = groupesValides.reduce(
    (total, groupe) => total + groupe.totalVehicules,
    0
  );

  const montantTotal = groupesValides.reduce(
    (total, groupe) => total + groupe.total,
    0
  );

  const commissionTotale = groupesValides.reduce(
    (total, groupe) => total + groupe.commission,
    0
  );

  const prestationSelectionnee = prestations.find(
    (item) => item.id === prestationId
  );

  function modifierModePaiement(index, mode) {
    setModesPaiement((precedent) => ({
      ...precedent,
      [index]: mode,
    }));

    reinitialiserCle();
  }

  async function enregistrer() {
    setErreur("");
    setMessageSucces("");

    if (!stationId) {
      setErreur("Veuillez sélectionner une station.");
      return;
    }

    if (!prestationId) {
      setErreur("Veuillez sélectionner une prestation.");
      return;
    }

    if (!dateService) {
      setErreur("Veuillez sélectionner une date.");
      return;
    }

    if (groupes.length === 0) {
      setErreur("Veuillez saisir au moins un groupe.");
      return;
    }

    if (erreurs.length > 0) {
      setErreur(
        "Corrigez les erreurs de saisie et les tarifs manquants avant de continuer."
      );
      return;
    }

    if (nombreVehicules > 200) {
      setErreur("Un lot ne peut pas dépasser 200 véhicules.");
      return;
    }

    if (groupesValides.length !== groupes.length) {
      setErreur("Certaines lignes ne peuvent pas être enregistrées.");
      return;
    }

    try {
      setEnregistrement(true);

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }

      const operations = groupesValides.flatMap((groupe) =>
        groupe.operationsTarifees.map((operation) => ({
          laveur_id: operation.laveur_id,
          type_vehicule_id: operation.type_vehicule_id,
          quantite: operation.quantite,
          mode_paiement: groupe.modePaiement || "especes",
        }))
      );

      const payload = {
        idempotency_key: idempotencyKeyRef.current,
        prestation_id: prestationId,
        date_service: dateService,
        operations,
      };

      const { data, error: rpcError } = await supabase.rpc(
        "lavage_enregistrer_prestations_groupees",
        {
          p_lavage_id: stationId,
          p_payload: payload,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!data?.success) {
        throw new Error(
          data?.message || "L'enregistrement du lot a échoué."
        );
      }

      setMessageSucces(
        data.message || "Les prestations ont été enregistrées."
      );

      reinitialiserCle();

      if (onSuccess) {
        onSuccess(data);
      }
    } catch (error) {
      setErreur(
        error.message ||
          "Une erreur est survenue pendant l'enregistrement."
      );
    } finally {
      setEnregistrement(false);
    }
  }

  function fermer() {
    if (enregistrement) return;
    onClose?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#14233B]/70 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* EN-TÊTE */}
        <div className="flex items-center justify-between gap-4 bg-[#14233B] px-5 py-4 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D8BD83] text-[#14233B]">
              <Users size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold">
                Saisie groupée
              </h2>
              <p className="text-xs text-white/70">
                Enregistrer plusieurs prestations en une seule fois
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fermer}
            disabled={enregistrement}
            className="rounded-lg p-2 transition hover:bg-white/10 disabled:opacity-40"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {erreur && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <p>{erreur}</p>
            </div>
          )}

          {messageSucces && (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
              <p>{messageSucces}</p>
            </div>
          )}

          {chargement ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-500">
              <LoaderCircle
                size={32}
                className="animate-spin text-[#14233B]"
              />
              <p className="text-sm">Chargement du catalogue...</p>
            </div>
          ) : (
            <>
              {/* PARAMÈTRES DU LOT */}
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#14233B]">
                    1. Paramètres de la saisie
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Ces informations seront communes à tout le lot.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                      Station
                    </label>

                    <select
                      value={stationId}
                      onChange={(event) => {
                        const id = event.target.value;
                        setStationId(id);
                        setPrestationId("");
                        setTexteSaisie("");
                        setModesPaiement({});
                        reinitialiserCle();
                        chargerCatalogue(id);
                      }}
                      disabled={stations.length <= 1}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#D8BD83] disabled:bg-gray-100"
                    >
                      {stations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                      Prestation de lavage *
                    </label>

                    <select
                      value={prestationId}
                      onChange={(event) => {
                        setPrestationId(event.target.value);
                        reinitialiserCle();
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#D8BD83]"
                    >
                      <option value="">Choisir une prestation</option>
                      {prestations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                      <CalendarDays size={14} />
                      Date des prestations *
                    </label>

                    <input
                      type="date"
                      value={dateService}
                      onChange={(event) => {
                        setDateService(event.target.value);
                        reinitialiserCle();
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#D8BD83]"
                    />
                  </div>
                </div>
              </section>

              <div className="border-t border-gray-100" />

              {/* SAISIE TEXTE */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#14233B]">
                    2. Saisie des groupes
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Une ligne par laveur. Indique son nom, puis les quantités
                    et les types de véhicules.
                  </p>
                </div>

                <div className="rounded-xl border border-[#D8BD83]/60 bg-[#FBF8F1] p-3">
                  <p className="mb-2 text-xs font-bold text-[#14233B]">
                    Exemple de saisie
                  </p>

                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-gray-700">
{`Hamed : 5 motos, 1 berline, 2 SUV et 3 4X4.
Koffi : 2 motos, 3 berlines et 1 SUV.
Yao : 4 motos et 2 4X4.`}
                  </pre>
                </div>

                <textarea
                  value={texteSaisie}
                  onChange={(event) => {
                    setTexteSaisie(event.target.value);
                    reinitialiserCle();
                    setErreur("");
                  }}
                  rows={7}
                  placeholder={`Hamed : 5 motos, 1 berline, 2 SUV et 3 4X4.
Koffi : 2 motos, 3 berlines et 1 SUV.
Yao : 4 motos et 2 4X4.`}
                  className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm leading-7 outline-none transition placeholder:text-gray-400 focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/20"
                />

                <p className="text-xs text-gray-500">
                  Les noms des laveurs et les types de véhicules doivent
                  correspondre au catalogue de la station. Maximum 200
                  véhicules par lot.
                </p>
              </section>

              {/* APERÇU */}
              {groupes.length > 0 && (
                <>
                  <div className="border-t border-gray-100" />

                  <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#14233B]">
                          3. Vérification du lot
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          Vérifie les quantités, les tarifs et les modes de paiement.
                        </p>
                      </div>

                      <span className="rounded-full bg-[#14233B]/5 px-3 py-1.5 text-xs font-semibold text-[#14233B]">
                        {groupes.length} groupe(s)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {groupesAvecTarifs.map((groupe) => (
                        <div
                          key={groupe.index}
                          className={`overflow-hidden rounded-xl border ${
                            groupe.erreur || groupe.tarifManquant
                              ? "border-red-200"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Users
                                size={17}
                                className="text-[#14233B]"
                              />
                              <span className="text-sm font-bold text-[#14233B]">
                                {groupe.nomLaveur || `Ligne ${groupe.index + 1}`}
                              </span>
                            </div>

                            {!groupe.erreur && (
                              <span className="text-xs font-semibold text-gray-600">
                                {groupe.totalVehicules} véhicule(s)
                              </span>
                            )}
                          </div>

                          <div className="space-y-3 p-4">
                            {groupe.erreur ? (
                              <p className="flex items-start gap-2 text-xs text-red-600">
                                <AlertCircle size={15} className="shrink-0" />
                                {groupe.erreur}
                              </p>
                            ) : (
                              <>
                                <div className="space-y-2">
                                  {groupe.operationsTarifees.map(
                                    (operation, index) => (
                                      <div
                                        key={`${operation.type_vehicule_id}-${index}`}
                                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                      >
                                        <div className="flex items-center gap-2 text-gray-700">
                                          <CarFront
                                            size={16}
                                            className="text-gray-400"
                                          />
                                          <span>
                                            {operation.quantite} ×{" "}
                                            {operation.type_vehicule_nom}
                                          </span>
                                        </div>

                                        {operation.tarif ? (
                                          <div className="text-right">
                                            <span className="font-semibold text-[#14233B]">
                                              {formaterMontant(
                                                operation.total,
                                                devise
                                              )}
                                            </span>
                                            <p className="text-[11px] text-gray-400">
                                              {formaterMontant(
                                                operation.prix,
                                                devise
                                              )}{" "}
                                              / véhicule
                                            </p>
                                          </div>
                                        ) : (
                                          <span className="text-xs font-semibold text-red-600">
                                            Tarif manquant
                                          </span>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>

                                {groupe.tarifManquant && (
                                  <p className="flex items-center gap-2 text-xs text-red-600">
                                    <AlertCircle size={14} />
                                    Un ou plusieurs tarifs sont absents pour
                                    cette prestation.
                                  </p>
                                )}

                                <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
                                  <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                                      Mode de paiement
                                    </label>

                                    <select
                                      value={groupe.modePaiement || "especes"}
                                      onChange={(event) =>
                                        modifierModePaiement(
                                          groupe.index,
                                          event.target.value
                                        )
                                      }
                                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#D8BD83]"
                                    >
                                      {MODES_PAIEMENT.map(([code, label]) => (
                                        <option key={code} value={code}>
                                          {label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex flex-col justify-center sm:items-end">
                                    <p className="text-xs text-gray-500">
                                      Commission du laveur
                                    </p>
                                    <p className="text-sm font-bold text-emerald-700">
                                      {formaterMontant(
                                        groupe.commission,
                                        devise
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* RÉCAPITULATIF */}
                  <section className="rounded-2xl bg-[#14233B] p-4 text-white sm:p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <ClipboardList size={18} className="text-[#D8BD83]" />
                      <h3 className="text-sm font-bold">
                        Récapitulatif du lot
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-white/60">Véhicules</p>
                        <p className="mt-1 text-xl font-bold">
                          {nombreVehicules}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/60">Groupes valides</p>
                        <p className="mt-1 text-xl font-bold">
                          {groupesValides.length}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/60">Chiffre d'affaires</p>
                        <p className="mt-1 text-lg font-bold text-[#D8BD83]">
                          {formaterMontant(montantTotal, devise)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/60">Commissions</p>
                        <p className="mt-1 text-lg font-bold text-emerald-300">
                          {formaterMontant(commissionTotale, devise)}
                        </p>
                      </div>
                    </div>

                    {prestationSelectionnee && (
                      <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/70">
                        Prestation : {prestationSelectionnee.nom}
                      </p>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>

        {/* PIED DE MODALE */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={fermer}
            disabled={enregistrement}
            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={enregistrer}
            disabled={
              chargement ||
              enregistrement ||
              !prestationId ||
              groupes.length === 0 ||
              erreurs.length > 0 ||
              groupesValides.length !== groupes.length ||
              nombreVehicules === 0 ||
              nombreVehicules > 200
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-6 py-3 text-sm font-bold text-[#14233B] shadow-sm transition hover:bg-[#e6ce98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enregistrement ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Receipt size={18} />
                Enregistrer les {nombreVehicules} prestations
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
