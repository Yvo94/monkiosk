
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function normalizePhone(value) {
  const input = String(value || "")
    .trim()
    .replace(/[\s().-]/g, "");

  if (input.startsWith("+")) return input;
  if (input.startsWith("225")) return `+${input}`;
  if (/^\d{10}$/.test(input)) return `+225${input}`;

  return input;
}

function validPhone(value) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
          // Certains contextes ne permettent pas la modification des cookies.
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
 * Vérifie la session, le rôle de l'administrateur
 * et sa station de lavage.
 *
 * La station est identifiée par lavages.owner_id.
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
    console.error("Vérification du profil :", profileError.message);
    return {
      error: jsonError("Impossible de vérifier le profil.", 500),
    };
  }

  if (!profile || profile.role !== "admin" || !profile.actif) {
    return {
      error: jsonError(
        "Accès réservé aux administrateurs actifs.",
        403
      ),
    };
  }

  const { data: lavage, error: lavageError } = await admin
    .from("lavages")
    .select("id, owner_id, actif")
    .eq("owner_id", user.id)
    .eq("actif", true)
    .maybeSingle();

  if (lavageError) {
    console.error("Recherche de la station :", lavageError.message);
    return {
      error: jsonError("Impossible de vérifier la station de lavage.", 500),
    };
  }

  if (!lavage) {
    return {
      error: jsonError(
        "Aucune station de lavage active n'est associée à cet administrateur.",
        403
      ),
    };
  }

  if (lavage.owner_id !== user.id) {
    return {
      error: jsonError(
        "Le compte administrateur n'est pas correctement associé à sa station.",
        403
      ),
    };
  }

  return {
    admin,
    currentUser: profile,
    lavage,
  };
}

/**
 * Vérifie si un autre utilisateur utilise déjà
 * le téléphone ou l'adresse e-mail.
 */
async function checkDuplicates(admin, telephone, email, excludeId = null) {
  let phoneQuery = admin
    .from("users")
    .select("id")
    .eq("telephone", telephone);

  let emailQuery = admin
    .from("users")
    .select("id")
    .eq("auth_email", email);

  if (excludeId) {
    phoneQuery = phoneQuery.neq("id", excludeId);
    emailQuery = emailQuery.neq("id", excludeId);
  }

  const [
    { data: phoneMatch, error: phoneError },
    { data: emailMatch, error: emailError },
  ] = await Promise.all([
    phoneQuery.limit(1),
    emailQuery.limit(1),
  ]);

  if (phoneError || emailError) {
    console.error("Vérification des doublons :", {
      phoneError: phoneError?.message,
      emailError: emailError?.message,
    });

    return {
      error: jsonError("Impossible de vérifier les doublons.", 500),
    };
  }

  if (phoneMatch?.length || emailMatch?.length) {
    return {
      error: jsonError(
        "Ce téléphone ou cet e-mail est déjà utilisé.",
        409
      ),
    };
  }

  return { ok: true };
}

// =====================================================
// GET : liste les utilisateurs de la station connectée
// =====================================================

export async function GET() {
  try {
    const result = await requireAdmin();
    if (result.error) return result.error;

    const { admin, lavage } = result;

    const { data, error } = await admin
      .from("users")
      .select(
        "id, nom, telephone, email, auth_email, role, actif, lavage_id, created_at, updated_at"
      )
      .eq("lavage_id", lavage.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Chargement des utilisateurs :", error.message);
      return jsonError("Impossible de charger les utilisateurs.", 500);
    }

    return NextResponse.json({
      users: data || [],
      lavage: {
        id: lavage.id,
      },
    });
  } catch (error) {
    console.error("GET /api/lavage/utilisateurs :", error);
    return jsonError("Erreur serveur.", 500);
  }
}

// =====================================================
// POST : crée un gérant ou un caissier
// =====================================================

export async function POST(request) {
  let admin;
  let authUserId;

  try {
    const result = await requireAdmin();
    if (result.error) return result.error;

    admin = result.admin;

    const { lavage } = result;
    const body = await request.json();

    const nom = String(body.nom || "").trim();
    const telephone = normalizePhone(body.telephone);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "caissier");

    if (!nom || !validPhone(telephone) || !email || !password) {
      return jsonError(
        "Nom, téléphone valide, e-mail et mot de passe sont obligatoires."
      );
    }

    if (!validEmail(email)) {
      return jsonError("Adresse e-mail invalide.");
    }

    if (password.length < 8) {
      return jsonError(
        "Le mot de passe doit contenir au moins 8 caractères."
      );
    }

    if (!["gerant", "caissier"].includes(role)) {
      return jsonError(
        "Tu peux uniquement créer un gérant ou un caissier.",
        403
      );
    }

    const duplicateCheck = await checkDuplicates(
      admin,
      telephone,
      email
    );

    if (duplicateCheck.error) return duplicateCheck.error;

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nom,
          telephone,
        },
      });

    if (createError) {
      console.error("Création Auth :", createError.message);
      return jsonError(
        createError.message || "Impossible de créer le compte.",
        400
      );
    }

    authUserId = created.user.id;

    const { data: profile, error: insertError } = await admin
      .from("users")
      .insert({
        id: authUserId,
        nom,
        telephone,
        email,
        auth_email: email,
        role,
        actif: true,
        lavage_id: lavage.id,
      })
      .select(
        "id, nom, telephone, email, auth_email, role, actif, lavage_id, created_at, updated_at"
      )
      .single();

    if (insertError) {
      await admin.auth.admin.deleteUser(authUserId);
      authUserId = null;

      console.error("Création du profil :", insertError.message);

      if (insertError.code === "23505") {
        return jsonError(
          "Ce téléphone ou cet e-mail est déjà utilisé.",
          409
        );
      }

      return jsonError(
        "Impossible de créer le profil utilisateur.",
        500
      );
    }

    return NextResponse.json(
      { user: profile },
      { status: 201 }
    );
  } catch (error) {
    if (admin && authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }

    console.error("POST /api/lavage/utilisateurs :", error);
    return jsonError(
      "Erreur serveur pendant la création.",
      500
    );
  }
}

// =====================================================
// PATCH : modifie un gérant ou un caissier
// =====================================================

export async function PATCH(request) {
  try {
    const result = await requireAdmin();
    if (result.error) return result.error;

    const { admin, lavage } = result;
    const body = await request.json();

    const id = String(body.id || "").trim();
    const nom = String(body.nom || "").trim();
    const telephone = normalizePhone(body.telephone);
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "");
    const actif = body.actif;

    if (!id || !nom || !validPhone(telephone) || !email) {
      return jsonError("Les informations du profil sont incomplètes.");
    }

    if (!validEmail(email)) {
      return jsonError("Adresse e-mail invalide.");
    }

    if (!["gerant", "caissier"].includes(role)) {
      return jsonError(
        "Un administrateur ne peut attribuer que les rôles gérant et caissier.",
        403
      );
    }

    if (typeof actif !== "boolean") {
      return jsonError("Le statut du compte est invalide.");
    }

    // Vérifier que l'utilisateur appartient à cette station.
    const { data: target, error: targetError } = await admin
      .from("users")
      .select("id, auth_email, role, actif, lavage_id")
      .eq("id", id)
      .eq("lavage_id", lavage.id)
      .maybeSingle();

    if (targetError) {
      console.error("Recherche utilisateur :", targetError.message);
      return jsonError("Impossible de vérifier cet utilisateur.", 500);
    }

    if (!target) {
      return jsonError(
        "Utilisateur introuvable dans cette station de lavage.",
        404
      );
    }

    if (target.role === "admin") {
      return jsonError(
        "Tu ne peux pas modifier un compte administrateur.",
        403
      );
    }

    const duplicateCheck = await checkDuplicates(
      admin,
      telephone,
      email,
      id
    );

    if (duplicateCheck.error) return duplicateCheck.error;

    // Synchroniser le compte Supabase Auth.
    const { error: authUpdateError } =
      await admin.auth.admin.updateUserById(id, {
        email,
        email_confirm: true,
        user_metadata: {
          nom,
          telephone,
        },
      });

    if (authUpdateError) {
      console.error("Modification Auth :", authUpdateError.message);
      return jsonError(
        "Impossible de modifier le compte d'authentification.",
        400
      );
    }

    const { data: updated, error: updateError } = await admin
      .from("users")
      .update({
        nom,
        telephone,
        email,
        auth_email: email,
        role,
        actif,
      })
      .eq("id", id)
      .eq("lavage_id", lavage.id)
      .select(
        "id, nom, telephone, email, auth_email, role, actif, lavage_id, created_at, updated_at"
      )
      .maybeSingle();

    if (updateError) {
      console.error("Modification du profil :", updateError.message);
      return jsonError(
        "Impossible de modifier le profil utilisateur.",
        500
      );
    }

    if (!updated) {
      return jsonError(
        "Utilisateur introuvable dans cette station de lavage.",
        404
      );
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PATCH /api/lavage/utilisateurs :", error);
    return jsonError(
      "Erreur serveur pendant la modification.",
      500
    );
  }
}
