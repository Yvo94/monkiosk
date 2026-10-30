
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

function jsonError(message, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
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

/*
async function getOwnedStations(supabase, userId) {
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
}
*/
async function getOwnedStations(supabase, userId) {
  // 1. Récupérer le profil de l'utilisateur connecté
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

  // 2. Construire la requête des stations actives
  let query = supabase
    .from("lavages")
    .select("id, nom, devise, actif, owner_id")
    .eq("actif", true);

  // 3. Administrateur : récupérer ses propres stations
  if (profile.role === "admin") {
    query = query.eq("owner_id", userId);
  }

  // 4. Gérant ou caissier : récupérer uniquement
  // la station associée à leur compte
  else if (
    profile.role === "gerant" ||
    profile.role === "caissier"
  ) {
    if (!profile.lavage_id) {
      return [];
    }

    query = query.eq("id", profile.lavage_id);
  }

  // 5. Les autres rôles ne sont pas autorisés
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

async function fetchRows(query, label) {
  const { data, error } = await query;

  
  if (error) {
    console.error(`[Lavage services] ${label}`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    throw new Error(
      `${label} : ${error.message}` +
      (error.code ? ` (code ${error.code})` : "")
    );
  }

  return data || [];
}


async function fetchRowsInBatches(
  supabase,
  table,
  columns,
  stationId,
  foreignKey,
  ids,
  label
) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const rows = [];

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batchIds = uniqueIds.slice(i, i + 100);

    const batch = await fetchRows(
      supabase
        .from(table)
        .select(columns)
        .eq("lavage_id", stationId)
        .in(foreignKey, batchIds),
      label
    );

    rows.push(...batch);
  }

  return rows;
}


async function getOperations(supabase, lavageId) {
  const services = await fetchRows(
    supabase
      .from("lavage_services")
      .select(`
        id,
        lavage_id,
        vehicule_id,
        client_id,
        laveur_id,
        caisse_id,
        prestation_id,
        date_service,
        created_at,
        montant_total,
        statut,
        notes,
        commission_laveur
      `)
      .eq("lavage_id", lavageId)
      .order("date_service", { ascending: false })
      .limit(1000),
    "Impossible de charger les opérations"
  );

  if (services.length === 0) return [];

  const uniqueIds = (values) =>
    [...new Set(values.filter(Boolean))];

  const vehiculeIds = uniqueIds(
    services.map((s) => s.vehicule_id)
  );
  const clientIds = uniqueIds(
    services.map((s) => s.client_id)
  );
  const laveurIds = uniqueIds(
    services.map((s) => s.laveur_id)
  );
  const prestationIds = uniqueIds(
    services.map((s) => s.prestation_id)
  );
  const serviceIds = uniqueIds(
    services.map((s) => s.id)
  );

  const [
    vehicules,
    clients,
    laveurs,
    prestations,
    encaissements,
  ] = await Promise.all([
    vehiculeIds.length
      ? fetchRowsInBatches(
          supabase,
          "lavage_vehicules",
          "id, immatriculation, marque, modele, couleur, type_vehicule_id",
          lavageId,
          "id",
          vehiculeIds,
          "Impossible de charger les véhicules"
        )
      : [],
    clientIds.length
      ? fetchRows(
          supabase
            .from("lavage_clients")
            .select("id, nom, telephone, email")
            .eq("lavage_id", lavageId)
            .in("id", clientIds),
          "Impossible de charger les clients"
        )
      : [],
    laveurIds.length
      ? fetchRows(
          supabase
            .from("lavage_laveurs")
            .select("id, nom, telephone")
            .eq("lavage_id", lavageId)
            .in("id", laveurIds),
          "Impossible de charger les laveurs"
        )
      : [],
    prestationIds.length
      ? fetchRows(
          supabase
            .from("lavage_prestations")
            .select("id, nom")
            .eq("lavage_id", lavageId)
            .in("id", prestationIds),
          "Impossible de charger les prestations"
        )
      : [],
    
    serviceIds.length
      ? fetchRowsInBatches(
          supabase,
          "lavage_encaissements",
          "id, service_id, montant, mode_paiement, reference_paiement, date_encaissement",
          lavageId,
          "service_id",
          serviceIds,
          "Impossible de charger les encaissements"
        ).then((rows) =>
          rows.sort(
            (a, b) =>
              new Date(b.date_encaissement).getTime() -
              new Date(a.date_encaissement).getTime()
          )
        )
      : [],
  ]);

  const toMap = (rows) =>
    new Map(rows.map((row) => [row.id, row]));

  const vehiculeMap = toMap(vehicules);
  const clientMap = toMap(clients);
  const laveurMap = toMap(laveurs);
  const prestationMap = toMap(prestations);

  // Plusieurs encaissements peuvent être associés à un service.
  // On conserve ici le plus récent pour l'affichage.
  const encaissementMap = new Map();

  for (const encaissement of encaissements) {
    if (!encaissementMap.has(encaissement.service_id)) {
      encaissementMap.set(
        encaissement.service_id,
        encaissement
      );
    }
  }

  return services.map((service) => ({
    ...service,
    vehicule: vehiculeMap.get(service.vehicule_id) || null,
    client: clientMap.get(service.client_id) || null,
    laveur: laveurMap.get(service.laveur_id) || null,
    prestation:
      prestationMap.get(service.prestation_id) || null,
    encaissement:
      encaissementMap.get(service.id) || null,
  }));
}


function validatePayload(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return "Les données de l'opération sont invalides.";
  }

  // Accepte YYYY-MM-DDTHH:mm et YYYY-MM-DDTHH:mm:ss
  if (
    typeof payload.date_service !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(
      payload.date_service
    )
  ) {
    return "La date et l'heure de l'opération sont obligatoires.";
  }

  // Normalisation des secondes pour l'analyse de la date.
  const dateServiceNormalisee =
    payload.date_service.length === 16
      ? `${payload.date_service}:00`
      : payload.date_service;

  // Vérifie la cohérence réelle de la date et de l'heure.
  const correspondance = dateServiceNormalisee.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/
  );

  if (!correspondance) {
    return "La date et l'heure de l'opération sont invalides.";
  }

  const [, annee, mois, jour, heure, minute, seconde] =
    correspondance.map((value, index) =>
      index === 0 ? value : Number(value)
    );

  const dateVerifiee = new Date(
    Date.UTC(annee, mois - 1, jour, heure, minute, seconde)
  );

  if (
    dateVerifiee.getUTCFullYear() !== annee ||
    dateVerifiee.getUTCMonth() !== mois - 1 ||
    dateVerifiee.getUTCDate() !== jour ||
    dateVerifiee.getUTCHours() !== heure ||
    dateVerifiee.getUTCMinutes() !== minute ||
    dateVerifiee.getUTCSeconds() !== seconde
  ) {
    return "La date et l'heure de l'opération sont invalides.";
  }

  if (!payload.caisse_id) {
    return "La caisse est obligatoire.";
  }

  if (!payload.laveur_id) {
    return "Le laveur est obligatoire.";
  }

  if (!payload.type_vehicule_id) {
    return "Le type de véhicule est obligatoire.";
  }

  const paymentModes = [
    "especes",
    "wave",
    "orange_money",
    "mtn_money",
    "moov_money",
    "carte",
    "virement",
    "autre",
  ];

  if (!paymentModes.includes(payload.mode_paiement)) {
    return "Le mode de paiement est invalide.";
  }

  const quantity = Number(payload.quantite_operations ?? 1);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 50
  ) {
    return "La quantité doit être un nombre entier compris entre 1 et 50.";
  }

  if (
    !Array.isArray(payload.details) ||
    payload.details.length !== 1 ||
    !payload.details[0]?.prestation_id ||
    Number(payload.details[0]?.quantite ?? 1) !== 1
  ) {
    return (
      "Une opération doit contenir exactement un type de lavage, " +
      "en quantité 1."
    );
  }

  if (
    payload.client?.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      String(payload.client.email).trim()
    )
  ) {
    return "L'adresse e-mail du client n'est pas valide.";
  }

  return null;
}


// GET /api/lavage/services
// Sans lavage_id : retourne les stations.
// Avec lavage_id : retourne les stations et les opérations autorisées.
export async function GET(request) {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return jsonError("Authentification requise.", 401);
    }

    const stations = await getOwnedStations(supabase, user.id);
    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get("lavage_id");

    if (!requestedId) {
      return NextResponse.json({
        success: true,
        stations,
        operations: [],
      });
    }

    const station = stations.find(
      (item) => item.id === requestedId
    );

    if (!station) {
      return jsonError(
        "Station introuvable, inactive ou accès non autorisé.",
        403
      );
    }

    const operations = await getOperations(
      supabase,
      station.id
    );

    return NextResponse.json({
      success: true,
      stations,
      station,
      operations,
    });
  } catch (error) {
    console.error("[GET /api/lavage/services]", error);

    return jsonError(
      error.message || "Erreur lors du chargement des opérations.",
      500
    );
  }
}

// POST /api/lavage/services
// L'enregistrement reste géré par la fonction PostgreSQL existante.
export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return jsonError("Authentification requise.", 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Le corps de la requête doit être un JSON valide.");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Données de l'opération invalides.");
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
        : Object.fromEntries(
            Object.entries(body).filter(
              ([key]) => key !== "lavage_id"
            )
          );

    const validationError = validatePayload(payload);

    if (validationError) {
      return jsonError(validationError, 400);
    }

    const stations = await getOwnedStations(supabase, user.id);

    let station;

    if (lavageId) {
      station = stations.find((item) => item.id === lavageId);
    } else if (stations.length === 1) {
      station = stations[0];
    } else if (stations.length > 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Plusieurs stations sont disponibles. Précisez lavage_id.",
          stations,
        },
        { status: 400 }
      );
    }

    if (!station) {
      return jsonError(
        "Aucune station active accessible pour cet utilisateur.",
        403
      );
    }

    
    const idempotencyKey = payload?.idempotency_key;

    if (
      typeof idempotencyKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idempotencyKey
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Clé de synchronisation invalide ou absente.",
        },
        { status: 400 }
      );
    }


      
      // Capturer une seule fois l'heure de référence de l'API.
      // La Côte d'Ivoire est en UTC+0.
      const dateDiagnostic = new Date();
      const heureApiReference = dateDiagnostic.toISOString();

      console.log("[DEBUG DATE LAVAGE]", {
        date_service: payload.date_service,
        date_recue: heureApiReference,
        heure_abidjan: new Intl.DateTimeFormat("fr-FR", {
          timeZone: "Africa/Abidjan",
          dateStyle: "short",
          timeStyle: "medium",
        }).format(dateDiagnostic),
      });

      console.log("[DIAGNOSTIC AVANT RPC]", {
        date_service: payload.date_service,
        heure_api_iso: heureApiReference,
        heure_api_ms: dateDiagnostic.getTime(),
      });

      const { data, error } = await supabase.rpc(
        "lavage_enregistrer_prestation",
        {
          p_lavage_id: station.id,
          p_payload: {
            ...payload,
            idempotency_key: idempotencyKey,
            quantite_operations: Number(payload.quantite_operations),
            heure_api: heureApiReference,
          },
        }
      );



    if (error) {
      console.error("[RPC lavage_enregistrer_prestation]", {
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

      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            "Impossible d'enregistrer les opérations.",
          ...(error.code ? { code: error.code } : {}),
        },
        { status }
      );
    }

    if (!data?.success) {
      return jsonError(
        data?.message || "L'enregistrement n'a pas été confirmé.",
        400
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          data.message ||
          "Opérations enregistrées et encaissées.",
        station: {
          id: station.id,
          nom: station.nom,
          devise: station.devise,
        },
        prestation: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/lavage/services]", error);

    return jsonError(
      error.message || "Une erreur interne est survenue.",
      500
    );
  }
}


export async function DELETE(request) {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return jsonError("Authentification requise.", 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Le corps de la requête doit être un JSON valide.",
        400
      );
    }

    const lavageId =
      typeof body?.lavage_id === "string"
        ? body.lavage_id.trim()
        : "";

    const serviceId =
      typeof body?.service_id === "string"
        ? body.service_id.trim()
        : "";

    const motif =
      typeof body?.motif === "string"
        ? body.motif.trim()
        : "";

    if (!lavageId || !serviceId) {
      return jsonError(
        "La station et l'opération sont obligatoires.",
        400
      );
    }

    if (motif.length < 3) {
      return jsonError(
        "Le motif de suppression doit contenir au moins 3 caractères.",
        400
      );
    }

    // Vérification préalable de l'accès à la station.
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

    // L'archivage, la régularisation de caisse et la suppression
    // sont exécutés ensemble par la fonction PostgreSQL.
    const { data, error } = await supabase.rpc(
      "lavage_supprimer_service",
      {
        p_lavage_id: lavageId,
        p_service_id: serviceId,
        p_motif: motif,
      }
    );

    if (error) {
      console.error("[RPC lavage_supprimer_service]", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      const message =
        error.message ||
        "Impossible de supprimer cette opération.";

      const status =
        error.code === "42501"
          ? 403
          : error.code === "23505"
            ? 409
            : 400;

      return NextResponse.json(
        {
          success: false,
          error: message,
          ...(error.code ? { code: error.code } : {}),
        },
        { status }
      );
    }

    if (!data?.success) {
      return jsonError(
        data?.message ||
          "La suppression n'a pas été confirmée.",
        400
      );
    }

    return NextResponse.json({
      success: true,
      message:
        data.message ||
        "Opération archivée et supprimée avec succès.",
      resultat: data,
    });
  } catch (error) {
    console.error("[DELETE /api/lavage/services]", error);

    return jsonError(
      error.message ||
        "Une erreur interne est survenue pendant la suppression.",
      500
    );
  }
}

