
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const MODULES = [
  "dashboard",
  "prestations",
  "laveurs",
  "vehicules",
  "types_lavage",
  "tarifs",
  "depenses",
  "previsions",
  "synthese_financiere",
  "statistiques",
  "caisses",
  "utilisateurs",
  "parametres",
];

const ACTIONS = ["consulter", "creer", "modifier", "supprimer"];

const PAYMENT_METHODS = [
  "especes",
  "wave",
  "orange_money",
  "mtn_money",
  "moov_money",
  "carte",
  "virement",
  "autre",
];

const CURRENCIES = ["XOF", "FCFA", "EUR", "USD"];
const MAX_CONFIG_SIZE = 20000;

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || !serviceKey) {
    throw new Error("Configuration Supabase incomplète.");
  }

  const cookieStore = await cookies();

  const sessionClient = createServerClient(url, key, {
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
          // Cookies éventuellement en lecture seule.
        }
      },
    },
  });

  const admin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { sessionClient, admin };
}

/**
 * Réserve l'API à l'administrateur actif propriétaire
 * d'une station de lavage active.
 */
async function requireAdmin() {
  const { sessionClient, admin } = await getClients();

  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser();

  if (authError || !user) {
    return { error: jsonError("Connexion requise.", 401) };
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, nom, role, actif")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profil settings Lavage :", profileError.message);
    return {
      error: jsonError("Impossible de vérifier le profil.", 500),
    };
  }

  if (!profile || profile.role !== "admin" || profile.actif !== true) {
    return {
      error: jsonError(
        "Accès réservé aux administrateurs actifs.",
        403
      ),
    };
  }

  // La station est identifiée par son propriétaire.
  const { data: lavage, error: lavageError } = await admin
    .from("lavages")
    .select("id, owner_id, nom, devise, actif")
    .eq("owner_id", user.id)
    .eq("actif", true)
    .maybeSingle();

  if (lavageError) {
    console.error("Station settings :", lavageError.message);
    return {
      error: jsonError("Impossible de vérifier la station.", 500),
    };
  }

  if (!lavage) {
    return {
      error: jsonError(
        "Aucune station active n'est associée à cet administrateur.",
        403
      ),
    };
  }

  return { admin, profile, lavage };
}

/**
 * Vérifie et nettoie la configuration avant enregistrement.
 */
function sanitizeConfiguration(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new Error("La configuration fournie est invalide.");
  }

  const { structure, permissions, prestations, caisse } = input;

  for (const [value, label] of [
    [structure, "Les informations de la station"],
    [permissions, "Les permissions"],
    [prestations, "Les paramètres des prestations"],
    [caisse, "Les paramètres de caisse"],
  ]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} sont invalides.`);
    }
  }

  const textField = (value, label, maxLength) => {
    if (typeof value !== "string") {
      throw new Error(`Le champ "${label}" doit être du texte.`);
    }

    const result = value.trim();

    if (result.length > maxLength) {
      throw new Error(
        `Le champ "${label}" dépasse ${maxLength} caractères.`
      );
    }

    return result;
  };

  const booleanField = (value, label) => {
    if (typeof value !== "boolean") {
      throw new Error(`Le paramètre "${label}" doit être booléen.`);
    }

    return value;
  };

  const nom = textField(structure.nom, "nom", 150);
  const telephone = textField(structure.telephone, "téléphone", 30);
  const adresse = textField(structure.adresse, "adresse", 250);
  const email = textField(structure.email, "e-mail", 254);
  const devise = textField(structure.devise, "devise", 4);

  if (!nom) {
    throw new Error("Le nom de la station est obligatoire.");
  }

  if (!CURRENCIES.includes(devise)) {
    throw new Error("La devise sélectionnée n'est pas autorisée.");
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("L'adresse e-mail de la station est invalide.");
  }

  // Permissions des profils gérant et caissier.
  const cleanPermissions = {};

  for (const role of ["gerant", "caissier"]) {
    const rolePermissions = permissions[role];

    if (
      !rolePermissions ||
      typeof rolePermissions !== "object" ||
      Array.isArray(rolePermissions)
    ) {
      throw new Error(`Les permissions du profil ${role} sont invalides.`);
    }

    cleanPermissions[role] = {};

    for (const moduleId of MODULES) {
      const modulePermissions = rolePermissions[moduleId];

      if (
        !modulePermissions ||
        typeof modulePermissions !== "object" ||
        Array.isArray(modulePermissions)
      ) {
        throw new Error(
          `Permissions manquantes pour ${role} / ${moduleId}.`
        );
      }

      cleanPermissions[role][moduleId] = {};

      for (const action of ACTIONS) {
        cleanPermissions[role][moduleId][action] = booleanField(
          modulePermissions[action],
          `${role}.${moduleId}.${action}`
        );
      }
    }
  }

  const cleanPrestations = {
    afficherNomStation: booleanField(
      prestations.afficherNomStation,
      "afficherNomStation"
    ),
    afficherTelephone: booleanField(
      prestations.afficherTelephone,
      "afficherTelephone"
    ),
    afficherAdresse: booleanField(
      prestations.afficherAdresse,
      "afficherAdresse"
    ),
    messageRecu: textField(
      prestations.messageRecu,
      "messageRecu",
      250
    ),
  };

  const cleanCaisse = {};

  for (const method of PAYMENT_METHODS) {
    cleanCaisse[method] = booleanField(
      caisse[method],
      `caisse.${method}`
    );
  }

  if (!Object.values(cleanCaisse).some(Boolean)) {
    throw new Error("Active au moins un moyen de paiement.");
  }

  return {
    structure: {
      nom,
      telephone,
      adresse,
      email,
      devise,
    },
    permissions: cleanPermissions,
    prestations: cleanPrestations,
    caisse: cleanCaisse,
  };
}

// GET : lire les paramètres de la station.
export async function GET() {
  try {
    const result = await requireAdmin();

    if (result.error) return result.error;

    const { admin, profile, lavage } = result;

    const { data: row, error } = await admin
      .from("lavage_parametres")
      .select("configuration, updated_at")
      .eq("lavage_id", lavage.id)
      .maybeSingle();

    if (error) {
      console.error("Lecture paramètres Lavage :", error.message);
      return jsonError(
        "Impossible de charger les paramètres de la station.",
        500
      );
    }

    return NextResponse.json({
      configuration: row?.configuration || {},
      updated_at: row?.updated_at || null,
      lavage: {
        id: lavage.id,
        nom: lavage.nom,
        devise: lavage.devise,
      },
      user: {
        id: profile.id,
        nom: profile.nom,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error("GET /api/lavage/settings :", error);
    return jsonError("Erreur serveur.", 500);
  }
}

// PATCH : enregistrer les paramètres de la station.
export async function PATCH(request) {
  try {
    const result = await requireAdmin();

    if (result.error) return result.error;

    const { admin, lavage } = result;
    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      !body.configuration
    ) {
      return jsonError("La configuration est obligatoire.");
    }

    const serialized = JSON.stringify(body.configuration);

    if (serialized.length > MAX_CONFIG_SIZE) {
      return jsonError("La configuration est trop volumineuse.", 413);
    }

    let configuration;

    try {
      configuration = sanitizeConfiguration(body.configuration);
    } catch (error) {
      return jsonError(error.message, 400);
    }

    // Mise à jour du nom et de la devise de la station.
    const { data: updatedLavage, error: lavageUpdateError } = await admin
      .from("lavages")
      .update({
        nom: configuration.structure.nom,
        devise: configuration.structure.devise,
      })
      .eq("id", lavage.id)
      .eq("owner_id", lavage.owner_id)
      .eq("actif", true)
      .select("id, nom, devise")
      .maybeSingle();

    if (lavageUpdateError) {
      console.error(
        "Mise à jour station Lavage :",
        lavageUpdateError.message
      );

      return jsonError(
        "Impossible d'enregistrer le nom ou la devise de la station.",
        500
      );
    }

    if (!updatedLavage) {
      return jsonError("La station n'est plus accessible.", 403);
    }

    // Enregistrement de la configuration.
    const { data: saved, error: saveError } = await admin
      .from("lavage_parametres")
      .upsert(
        {
          lavage_id: lavage.id,
          configuration,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lavage_id" }
      )
      .select("configuration, updated_at")
      .single();

    if (saveError) {
      console.error(
        "Enregistrement configuration Lavage :",
        saveError.message
      );

      return jsonError(
        "La station a été mise à jour, mais la configuration n'a pas pu être enregistrée. Recharge les paramètres avant de réessayer.",
        500
      );
    }

    return NextResponse.json({
      message: "Paramètres enregistrés avec succès.",
      configuration: saved.configuration,
      updated_at: saved.updated_at,
      lavage: updatedLavage,
    });
  } catch (error) {
    console.error("PATCH /api/lavage/settings :", error);

    if (error instanceof SyntaxError) {
      return jsonError("Le corps de la requête JSON est invalide.");
    }

    return jsonError("Erreur serveur.", 500);
  }
}
