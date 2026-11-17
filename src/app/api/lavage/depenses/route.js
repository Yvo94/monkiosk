
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

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

function jsonError(message, status = 400, details = undefined) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

async function getAuthenticatedUser(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return user;
}

async function verifierLicenceLavage(userId) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
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
    .eq("proprietaire_id", userId)
    .eq("statut", "active")
    .not("date_activation", "is", null)
    .lte("date_activation", maintenant)
    .gt("date_expiration", maintenant)
    .order("date_expiration", { ascending: false });

  if (error) {
    console.error("[Vérification licence Lavage]", error);

    return {
      valide: false,
      erreur: true,
    };
  }

  const valide = (licences || []).some(
    (licence) =>
      Array.isArray(licence.modules) &&
      licence.modules.includes("lavage")
  );

  return {
    valide,
    erreur: false,
  };
}

/*async function getOwnedStations(supabase, userId) {
  const { data, error } = await supabase
    .from("lavages")
    .select("id, nom, devise, actif")
    .eq("owner_id", userId)
    .eq("actif", true)
    .order("nom");

  if (error) {
    throw new Error(
      `Impossible de charger les stations : ${error.message}`
    );
  }

  return data || [];
}*/


async function getOwnedStations(supabase, userId) {
  // Récupérer le profil de l'utilisateur connecté
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, role, actif, lavage_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Impossible de charger le profil utilisateur : ${profileError.message}`
    );
  }

  if (!profile || profile.actif !== true) {
    return [];
  }

  // Construire la requête des stations accessibles
  let query = supabase
    .from("lavages")
    .select("id, nom, devise, actif, owner_id")
    .eq("actif", true);

  // Administrateur : ses propres stations
  if (profile.role === "admin") {
    query = query.eq("owner_id", userId);
  }

  // Gérant et caissier : leur station de rattachement
  else if (
    profile.role === "gerant" ||
    profile.role === "caissier"
  ) {
    if (!profile.lavage_id) {
      return [];
    }

    query = query.eq("id", profile.lavage_id);
  }

  // Refuser les autres rôles
  else {
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


async function getStationCaisses(supabase, lavageId) {
  const { data, error } = await supabase
    .from("lavage_caisses")
    .select("id, nom, code, solde_actuel")
    .eq("lavage_id", lavageId)
    .eq("actif", true)
    .order("nom");

  if (error) {
    throw new Error(
      `Impossible de charger les caisses : ${error.message}`
    );
  }

  return data || [];
}

async function getDepenses(supabase, lavageId) {
  const { data, error } = await supabase
    .from("lavage_depenses")
    .select(`
      id,
      lavage_id,
      caisse_id,
      libelle,
      categorie,
      montant,
      date_depense,
      mode_paiement,
      statut,
      notes,
      created_at,
      caisse:lavage_caisses (
        id,
        nom,
        code
      )
    `)
    .eq("lavage_id", lavageId)
    .order("date_depense", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[Lavage dépenses] Chargement :", error);
    throw new Error(
      `Impossible de charger les dépenses : ${error.message}`
    );
  }

  return data || [];
}

function validateDepense(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Les données de la dépense sont invalides.";
  }

  const libelle = String(body.libelle ?? "").trim();

  if (!libelle) {
    return "Le libellé de la dépense est obligatoire.";
  }

  if (libelle.length > 200) {
    return "Le libellé ne doit pas dépasser 200 caractères.";
  }

  const montant = Number(body.montant);

  if (!Number.isFinite(montant) || montant <= 0) {
    return "Le montant doit être supérieur à zéro.";
  }

  if (montant > 999999999999) {
    return "Le montant indiqué est trop élevé.";
  }

  const modesPaiement = [
    "especes",
    "wave",
    "orange_money",
    "mtn_money",
    "moov_money",
    "carte",
    "virement",
    "autre",
  ];

  if (!modesPaiement.includes(body.mode_paiement)) {
    return "Le mode de paiement est invalide.";
  }

  if (!["payee", "en_attente"].includes(body.statut)) {
    return "Le statut de la dépense est invalide.";
  }

  const date = new Date(body.date_depense);

  if (
    typeof body.date_depense !== "string" ||
    !body.date_depense ||
    Number.isNaN(date.getTime())
  ) {
    return "La date de la dépense est invalide.";
  }

  if (
    body.caisse_id !== undefined &&
    body.caisse_id !== null &&
    typeof body.caisse_id !== "string"
  ) {
    return "La caisse sélectionnée est invalide.";
  }

  if (
    body.notes !== undefined &&
    body.notes !== null &&
    typeof body.notes !== "string"
  ) {
    return "Les notes sont invalides.";
  }

  return null;
}

// GET /api/lavage/depenses
// Sans lavage_id : retourne les stations accessibles.
// Avec lavage_id : retourne les dépenses et les caisses de la station.
export async function GET(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return jsonError("Session expirée.", 401);
    }

    /*
    const controleLicence = await verifierLicenceLavage(user.id);

    if (controleLicence.erreur) {
      return jsonError(
        "Impossible de vérifier votre licence.",
        500
      );
    }
    

    if (!controleLicence.valide) {
      return jsonError(
        "Votre licence Lavage est absente, expirée ou révoquée. Veuillez activer une licence valide.",
        403,
        { code: "LICENCE_REQUIRED", redirect: "/activation-licence" }
      );
    }
    */

    const stations = await getOwnedStations(supabase, user.id);
    const { searchParams } = new URL(request.url);
    const lavageId = searchParams.get("lavage_id");

    if (!lavageId) {
      return NextResponse.json({
        success: true,
        stations,
        station: stations.length === 1 ? stations[0] : null,
        depenses: [],
        caisses: [],
      });
    }

    const station = stations.find(
      (item) => item.id === lavageId
    );

    if (!station) {
      return jsonError(
        "Station introuvable, inactive ou accès non autorisé.",
        403
      );
    }

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
      return jsonError(
        "Votre licence Lavage est absente, expirée ou révoquée. Veuillez activer une licence valide.",
        403,
        {
          code: "LICENCE_REQUIRED",
          redirect: "/activation-licence",
        }
      );
    }

    const [depenses, caisses] = await Promise.all([
      getDepenses(supabase, station.id),
      getStationCaisses(supabase, station.id),
    ]);

    return NextResponse.json({
      success: true,
      stations,
      station,
      devise: station.devise || "FCFA",
      depenses,
      caisses,
    });
  } catch (error) {
    console.error("[GET /api/lavage/depenses]", error);

    return jsonError(
      error.message || "Impossible de charger les dépenses.",
      500
    );
  }
}

// POST /api/lavage/depenses
// Enregistre une nouvelle dépense.
export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return jsonError("Session expirée.", 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Le corps de la requête doit être un JSON valide.");
    }

    const lavageId =
      typeof body?.lavage_id === "string"
        ? body.lavage_id.trim()
        : "";

    if (!lavageId) {
      return jsonError("La station de lavage est obligatoire.");
    }

    const validationError = validateDepense(body);

    if (validationError) {
      return jsonError(validationError);
    }

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
      return jsonError(
        "Votre licence Lavage est absente, expirée ou révoquée. Veuillez activer une licence valide.",
        403,
        {
          code: "LICENCE_REQUIRED",
          redirect: "/activation-licence",
        }
      );
    }

    const { data, error } = await supabase.rpc(
      "lavage_enregistrer_depense",
      {
        p_lavage_id: station.id,
        p_libelle: String(body.libelle).trim(),
        p_categorie: String(body.categorie || "Autre").trim(),
        p_montant: Number(body.montant),
        p_date_depense: new Date(body.date_depense).toISOString(),
        p_mode_paiement: body.mode_paiement,
        p_statut: body.statut,
        p_caisse_id: body.caisse_id || null,
        p_notes: String(body.notes || "").trim() || null,
      }
    );

    if (error) {
      console.error("[RPC lavage_enregistrer_depense]", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      const status =
        error.code === "42501"
          ? 403
          : error.code === "23505"
            ? 409
            : 400;

      return jsonError(
        error.message || "Impossible d'enregistrer la dépense.",
        status,
        error.code ? { code: error.code } : undefined
      );
    }

    if (!data?.success) {
      return jsonError(
        data?.message || data?.error ||
          "L'enregistrement de la dépense n'a pas été confirmé.",
        400
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Dépense enregistrée avec succès.",
        station: {
          id: station.id,
          nom: station.nom,
          devise: station.devise || "FCFA",
        },
        depense: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/lavage/depenses]", error);

    return jsonError(
      error.message || "Une erreur interne est survenue.",
      500
    );
  }
}

// DELETE /api/lavage/depenses
// Annule une dépense payée ou en attente.
// Le remboursement éventuel de la caisse est effectué par la fonction SQL.
export async function DELETE(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return jsonError("Session expirée.", 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Le corps de la requête doit être un JSON valide.");
    }

    const lavageId =
      typeof body?.lavage_id === "string"
        ? body.lavage_id.trim()
        : "";

    const depenseId =
      typeof body?.depense_id === "string"
        ? body.depense_id.trim()
        : "";

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(lavageId)) {
      return jsonError("L'identifiant de la station est invalide.");
    }

    if (!uuidRegex.test(depenseId)) {
      return jsonError("L'identifiant de la dépense est invalide.");
    }

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
      return jsonError(
        "Votre licence Lavage est absente, expirée ou révoquée. Veuillez activer une licence valide.",
        403,
        {
          code: "LICENCE_REQUIRED",
          redirect: "/activation-licence",
        }
      );
    }

    const { data, error } = await supabase.rpc(
      "lavage_annuler_depense",
      {
        p_lavage_id: station.id,
        p_depense_id: depenseId,
      }
    );

    if (error) {
      console.error("[RPC lavage_annuler_depense]", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      const message = error.message || "";

      const status =
        error.code === "42501"
          ? 403
          : error.code === "23505"
            ? 409
            : message.toLowerCase().includes("déjà annulée")
              ? 409
              : message.toLowerCase().includes("introuvable")
                ? 404
                : 400;

      return jsonError(
        message || "Impossible d'annuler cette dépense.",
        status,
        error.code ? { code: error.code } : undefined
      );
    }

    if (!data?.success) {
      return jsonError(
        data?.message || data?.error ||
          "L'annulation de la dépense n'a pas été confirmée.",
        400
      );
    }

    return NextResponse.json({
      success: true,
      message: data.caisse_recreditee
        ? "Dépense annulée. La caisse d'origine a été recréditée."
        : "Dépense annulée avec succès.",
      station: {
        id: station.id,
        nom: station.nom,
        devise: station.devise || "FCFA",
      },
      depense: data,
    });
  } catch (error) {
    console.error("[DELETE /api/lavage/depenses]", error);

    return jsonError(
      error.message || "Une erreur interne est survenue.",
      500
    );
  }
}
