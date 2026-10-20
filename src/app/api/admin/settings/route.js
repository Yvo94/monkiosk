import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const MODULES = [
  "dashboard",
  "produits",
  "categories",
  "ventes",
  "achats",
  "stock",
  "caisses",
  "depenses",
  "statistiques",
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
          // Les cookies peuvent être en lecture seule selon le contexte.
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
 * d'un kiosque actif.
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
    .select("id, nom, role, actif, kiosque_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profil settings :", profileError.message);
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

  if (!profile.kiosque_id) {
    return {
      error: jsonError(
        "Aucun kiosque n'est associé à cet administrateur.",
        403
      ),
    };
  }

  // Vérifier simultanément le propriétaire et le kiosque actif.
  const { data: kiosque, error: kiosqueError } = await admin
    .from("kiosques")
    .select("id, owner_id, nom, devise, actif")
    .eq("id", profile.kiosque_id)
    .eq("owner_id", user.id)
    .eq("actif", true)
    .maybeSingle();

  if (kiosqueError) {
    console.error("Kiosque settings :", kiosqueError.message);
    return {
      error: jsonError("Impossible de vérifier le kiosque.", 500),
    };
  }

  if (!kiosque) {
    return {
      error: jsonError(
        "Le kiosque est introuvable, inactif ou mal rattaché.",
        403
      ),
    };
  }

  return { admin, profile, kiosque };
}

/**
 * Ne conserve que les paramètres autorisés.
 * Les propriétés inattendues sont ignorées.
 */
function sanitizeConfiguration(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new Error("La configuration fournie est invalide.");
  }

  const structure = input.structure;
  const permissions = input.permissions;
  const ventes = input.ventes;
  const caisse = input.caisse;

  if (
    !structure ||
    typeof structure !== "object" ||
    Array.isArray(structure)
  ) {
    throw new Error("Les informations de la structure sont invalides.");
  }

  if (
    !permissions ||
    typeof permissions !== "object" ||
    Array.isArray(permissions)
  ) {
    throw new Error("Les permissions sont invalides.");
  }

  if (
    !ventes ||
    typeof ventes !== "object" ||
    Array.isArray(ventes)
  ) {
    throw new Error("Les paramètres de vente sont invalides.");
  }

  if (
    !caisse ||
    typeof caisse !== "object" ||
    Array.isArray(caisse)
  ) {
    throw new Error("Les paramètres de caisse sont invalides.");
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

  const nom = textField(
    structure.nom,
    "nom",
    150
  );

  const telephone = textField(
    structure.telephone,
    "téléphone",
    30
  );

  const adresse = textField(
    structure.adresse,
    "adresse",
    250
  );

  const email = textField(
    structure.email,
    "e-mail",
    254
  );

  const devise = textField(
    structure.devise,
    "devise",
    4
  );

  if (!nom) {
    throw new Error("Le nom de l'établissement est obligatoire.");
  }

  if (!CURRENCIES.includes(devise)) {
    throw new Error("La devise sélectionnée n'est pas autorisée.");
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("L'adresse e-mail de l'établissement est invalide.");
  }

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
        cleanPermissions[role][moduleId][action] =
          booleanField(
            modulePermissions[action],
            `${role}.${moduleId}.${action}`
          );
      }
    }
  }

  const cleanVentes = {
    afficherNomKiosque: booleanField(
      ventes.afficherNomKiosque,
      "afficherNomKiosque"
    ),
    afficherTelephone: booleanField(
      ventes.afficherTelephone,
      "afficherTelephone"
    ),
    afficherAdresse: booleanField(
      ventes.afficherAdresse,
      "afficherAdresse"
    ),
    afficherLogo: booleanField(
      ventes.afficherLogo,
      "afficherLogo"
    ),
    messageTicket: textField(
      ventes.messageTicket,
      "messageTicket",
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
    throw new Error(
      "Active au moins un moyen de paiement."
    );
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
    ventes: cleanVentes,
    caisse: cleanCaisse,
  };
}

// GET : lire les paramètres du kiosque connecté.
export async function GET() {
  try {
    const result = await requireAdmin();

    if (result.error) return result.error;

    const { admin, profile, kiosque } = result;

    const { data: row, error } = await admin
      .from("kiosque_parametres")
      .select("configuration, updated_at")
      .eq("kiosque_id", kiosque.id)
      .maybeSingle();

    if (error) {
      console.error("Lecture des paramètres :", error.message);
      return jsonError(
        "Impossible de charger les paramètres du kiosque.",
        500
      );
    }

    return NextResponse.json({
      configuration: row?.configuration || {},
      updated_at: row?.updated_at || null,
      kiosque: {
        id: kiosque.id,
        nom: kiosque.nom,
        devise: kiosque.devise,
      },
      user: {
        id: profile.id,
        nom: profile.nom,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/settings :", error);
    return jsonError("Erreur serveur.", 500);
  }
}

// PATCH : enregistrer les paramètres du kiosque connecté.
export async function PATCH(request) {
  try {
    const result = await requireAdmin();

    if (result.error) return result.error;

    const { admin, kiosque } = result;

    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      !body.configuration
    ) {
      return jsonError("La configuration est obligatoire.");
    }

    // Limiter la taille du document transmis.
    const serialized = JSON.stringify(body.configuration);

    if (serialized.length > MAX_CONFIG_SIZE) {
      return jsonError(
        "La configuration est trop volumineuse.",
        413
      );
    }

    let configuration;

    try {
      configuration = sanitizeConfiguration(body.configuration);
    } catch (error) {
      return jsonError(error.message, 400);
    }

    // Enregistrer le nom et la devise dans leur table existante.
    const { data: updatedKiosk, error: kioskUpdateError } = await admin
      .from("kiosques")
      .update({
        nom: configuration.structure.nom,
        devise: configuration.structure.devise,
      })
      .eq("id", kiosque.id)
      .eq("owner_id", kiosque.owner_id)
      .eq("actif", true)
      .select("id, nom, devise")
      .maybeSingle();

    if (kioskUpdateError) {
      console.error(
        "Mise à jour du kiosque :",
        kioskUpdateError.message
      );

      return jsonError(
        "Impossible d'enregistrer le nom ou la devise du kiosque.",
        500
      );
    }

    if (!updatedKiosk) {
      return jsonError(
        "Le kiosque n'est plus accessible.",
        403
      );
    }

    // Sauvegarder les autres réglages dans la table dédiée.
    const { data: saved, error: saveError } = await admin
      .from("kiosque_parametres")
      .upsert(
        {
          kiosque_id: kiosque.id,
          configuration,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "kiosque_id" }
      )
      .select("configuration, updated_at")
      .single();

    if (saveError) {
      console.error(
        "Enregistrement de la configuration :",
        saveError.message
      );

      return jsonError(
        "Le kiosque a été mis à jour, mais la configuration n'a pas pu être enregistrée. Recharge les paramètres avant de réessayer.",
        500
      );
    }

    return NextResponse.json({
      message: "Paramètres enregistrés avec succès.",
      configuration: saved.configuration,
      updated_at: saved.updated_at,
      kiosque: updatedKiosk,
    });
  } catch (error) {
    console.error("PATCH /api/admin/settings :", error);

    if (error instanceof SyntaxError) {
      return jsonError("Le corps de la requête JSON est invalide.");
    }

    return jsonError("Erreur serveur.", 500);
  }
}
