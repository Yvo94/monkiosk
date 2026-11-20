
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const PAYMENT_MODES = [
  "especes",
  "wave",
  "orange_money",
  "mtn_money",
  "moov_money",
  "carte",
  "virement",
  "autre",
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_GROUPES = 200;
const MAX_QUANTITE_PAR_GROUPE = 50;
const MAX_VEHICULES_LOT = 200;

// --------------------------------------------------
// RÉPONSES
// --------------------------------------------------

function jsonError(message, status = 400, code = null) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(code ? { code } : {}),
    },
    { status }
  );
}

function reponseLicenceRequise() {
  return NextResponse.json(
    {
      success: false,
      error: "Votre licence Lavage est absente, expirée ou révoquée.",
      code: "LICENCE_REQUIRED",
      redirect: "/activation-licence",
    },
    { status: 403 }
  );
}

// --------------------------------------------------
// CLIENT SUPABASE
// --------------------------------------------------

async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Les cookies peuvent être en lecture seule.
          }
        },
      },
    }
  );
}

// --------------------------------------------------
// AUTHENTIFICATION
// --------------------------------------------------

async function getAuthenticatedUser(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function getUserProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("users")
    .select("id, role, actif, lavage_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Impossible de récupérer le profil : ${error.message}`
    );
  }

  if (!data || data.actif !== true) {
    throw new Error("Compte utilisateur inactif ou introuvable.");
  }

  return data;
}

// --------------------------------------------------
// STATIONS AUTORISÉES
// --------------------------------------------------

async function getOwnedStations(supabase, userId) {
  const profile = await getUserProfile(supabase, userId);

  let query = supabase
    .from("lavages")
    .select("id, nom, devise, actif, owner_id")
    .eq("actif", true);

  if (profile.role === "admin") {
    query = query.eq("owner_id", userId);
  } else if (
    profile.role === "gerant" ||
    profile.role === "caissier"
  ) {
    if (!profile.lavage_id) {
      return [];
    }

    query = query.eq("id", profile.lavage_id);
  } else {
    return [];
  }

  const { data, error } = await query.order("nom");

  if (error) {
    throw new Error(
      `Impossible de charger les stations : ${error.message}`
    );
  }

  return data || [];
}

// --------------------------------------------------
// VÉRIFICATION DE LICENCE
// --------------------------------------------------

async function verifierLicenceLavage(proprietaireId) {
  if (!proprietaireId) {
    return { valide: false, erreur: false };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[LICENCE LAVAGE] Configuration Supabase manquante."
    );

    return { valide: false, erreur: true };
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const maintenant = new Date().toISOString();

  const { data: licences, error } = await supabaseAdmin
    .from("licenses")
    .select("id, modules, date_activation, date_expiration, statut")
    .eq("proprietaire_id", proprietaireId)
    .eq("statut", "active")
    .not("date_activation", "is", null)
    .lte("date_activation", maintenant)
    .gt("date_expiration", maintenant)
    .order("date_expiration", { ascending: false });

  if (error) {
    console.error("[LICENCE LAVAGE] Erreur :", error);

    return { valide: false, erreur: true };
  }

  const valide = (licences || []).some(
    (licence) =>
      Array.isArray(licence.modules) &&
      licence.modules.includes("lavage")
  );

  return { valide, erreur: false };
}

// --------------------------------------------------
// VALIDATION DE LA DATE
// --------------------------------------------------

function validerDateService(dateService) {
  if (
    typeof dateService !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateService)
  ) {
    return false;
  }

  const [annee, mois, jour] = dateService
    .split("-")
    .map(Number);

  const date = new Date(Date.UTC(annee, mois - 1, jour));

  return (
    date.getUTCFullYear() === annee &&
    date.getUTCMonth() === mois - 1 &&
    date.getUTCDate() === jour
  );
}

// --------------------------------------------------
// VALIDATION DU LOT
// --------------------------------------------------

function validatePayload(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return "Les données du lot sont invalides.";
  }

  // Clé d'idempotence obligatoire.
  if (
    typeof payload.idempotency_key !== "string" ||
    !UUID_REGEX.test(payload.idempotency_key)
  ) {
    return "La clé de synchronisation est invalide ou absente.";
  }

  // Date obligatoire.
  if (!validerDateService(payload.date_service)) {
    return "La date de la prestation est invalide.";
  }

  // Prestation de lavage sélectionnée une seule fois.
  if (
    typeof payload.prestation_id !== "string" ||
    !UUID_REGEX.test(payload.prestation_id)
  ) {
    return "Le type de lavage sélectionné est invalide.";
  }

  // Liste des groupes.
  if (
    !Array.isArray(payload.operations) ||
    payload.operations.length === 0
  ) {
    return "Le lot doit contenir au moins un groupe d'opérations.";
  }

  if (payload.operations.length > MAX_GROUPES) {
    return `Le lot ne peut pas dépasser ${MAX_GROUPES} groupes.`;
  }

  let totalVehicules = 0;

  for (let index = 0; index < payload.operations.length; index++) {
    const groupe = payload.operations[index];
    const numero = index + 1;

    if (
      !groupe ||
      typeof groupe !== "object" ||
      Array.isArray(groupe)
    ) {
      return `Le groupe ${numero} est invalide.`;
    }

    // Laveur.
    if (
      typeof groupe.laveur_id !== "string" ||
      !UUID_REGEX.test(groupe.laveur_id)
    ) {
      return `Le laveur du groupe ${numero} est invalide.`;
    }

    // Type de véhicule.
    if (
      typeof groupe.type_vehicule_id !== "string" ||
      !UUID_REGEX.test(groupe.type_vehicule_id)
    ) {
      return `Le type de véhicule du groupe ${numero} est invalide.`;
    }

    // Quantité.
    const quantite = Number(groupe.quantite);

    if (
      !Number.isInteger(quantite) ||
      quantite < 1 ||
      quantite > MAX_QUANTITE_PAR_GROUPE
    ) {
      return (
        `La quantité du groupe ${numero} doit être comprise ` +
        `entre 1 et ${MAX_QUANTITE_PAR_GROUPE}.`
      );
    }

    totalVehicules += quantite;

    if (totalVehicules > MAX_VEHICULES_LOT) {
      return (
        `Un lot ne peut pas dépasser ${MAX_VEHICULES_LOT} véhicules.`
      );
    }

    // Mode de paiement.
    const modePaiement = groupe.mode_paiement || "especes";

    if (!PAYMENT_MODES.includes(modePaiement)) {
      return `Le mode de paiement du groupe ${numero} est invalide.`;
    }

    // Référence de paiement facultative.
    if (
      groupe.reference_paiement !== undefined &&
      groupe.reference_paiement !== null &&
      typeof groupe.reference_paiement !== "string"
    ) {
      return `La référence de paiement du groupe ${numero} est invalide.`;
    }

    // Notes facultatives.
    if (
      groupe.notes !== undefined &&
      groupe.notes !== null &&
      typeof groupe.notes !== "string"
    ) {
      return `Les notes du groupe ${numero} sont invalides.`;
    }
  }

  return null;
}

// --------------------------------------------------
// POST /api/lavage/services/groupees
// --------------------------------------------------

export async function POST(request) {
  try {
    // 1. Authentification.
    const supabase = await createSupabaseServerClient();

    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return jsonError("Authentification requise.", 401);
    }

    // 2. Lecture du corps JSON.
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Le corps de la requête doit être un JSON valide."
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonError("Les données transmises sont invalides.");
    }

    const lavageId =
      typeof body.lavage_id === "string"
        ? body.lavage_id.trim()
        : "";

    const payload =
      body.payload &&
      typeof body.payload === "object" &&
      !Array.isArray(body.payload)
        ? body.payload
        : null;

    if (!lavageId || !UUID_REGEX.test(lavageId)) {
      return jsonError("L'identifiant de la station est invalide.");
    }

    if (!payload) {
      return jsonError("Le contenu du lot est absent ou invalide.");
    }

    // 3. Validation des données du lot.
    const validationError = validatePayload(payload);

    if (validationError) {
      return jsonError(validationError, 400);
    }

    // 4. Vérification du profil.
    const profile = await getUserProfile(supabase, user.id);

    if (
      !["admin", "gerant", "caissier"].includes(profile.role)
    ) {
      return jsonError(
        "Votre rôle ne permet pas d'enregistrer des prestations.",
        403
      );
    }

    // 5. Vérification de l'accès à la station.
    const stations = await getOwnedStations(supabase, user.id);

    const station = stations.find(
      (item) => item.id === lavageId
    );

    if (!station) {
      return jsonError(
        "Station introuvable, inactive ou accès non autorisé.",
        403
      );
    }

    // 6. Vérification de la licence.
    const controleLicence = await verifierLicenceLavage(
      station.owner_id
    );

    if (controleLicence.erreur) {
      return jsonError(
        "Impossible de vérifier la licence de cette station.",
        500
      );
    }

    if (!controleLicence.valide) {
      return reponseLicenceRequise();
    }

    // 7. Normalisation des données.
    // Le mode de paiement par défaut est l'espèce.
    const payloadNormalise = {
      ...payload,
      idempotency_key: payload.idempotency_key,
      date_service: payload.date_service,
      operations: payload.operations.map((groupe) => ({
        ...groupe,
        quantite: Number(groupe.quantite),
        mode_paiement: groupe.mode_paiement || "especes",
        reference_paiement:
          groupe.reference_paiement?.trim() || null,
        notes: groupe.notes?.trim() || null,
      })),
    };

    // 8. Appel de la fonction PostgreSQL.
    const { data, error } = await supabase.rpc(
      "lavage_enregistrer_prestations_groupees",
      {
        p_lavage_id: station.id,
        p_payload: payloadNormalise,
      }
    );

    if (error) {
      console.error(
        "[RPC lavage_enregistrer_prestations_groupees]",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );

      const status =
        error.code === "42501"
          ? 403
          : error.code === "23505"
            ? 409
            : error.code === "22003"
              ? 422
              : 400;

      return jsonError(
        error.message ||
          "Impossible d'enregistrer le lot de prestations.",
        status,
        error.code
      );
    }

    // 9. Vérification du résultat SQL.
    if (!data?.success) {
      return jsonError(
        data?.message ||
          "L'enregistrement du lot n'a pas été confirmé.",
        400
      );
    }

    // 10. Réponse.
    return NextResponse.json(
      {
        success: true,
        message:
          data.message ||
          "Les prestations ont été enregistrées et encaissées.",
        station: {
          id: station.id,
          nom: station.nom,
          devise: station.devise,
        },
        resultat: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "[POST /api/lavage/services/groupees]",
      error
    );

    return jsonError(
      error.message ||
        "Une erreur interne est survenue pendant l'enregistrement du lot.",
      500
    );
  }
}
