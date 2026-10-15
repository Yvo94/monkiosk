
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
 * Vérifie la session, le rôle et le kiosque du propriétaire.
 *
 * Hypothèse : kiosques.owner_id contient l'ID Auth
 * de l'administrateur propriétaire du kiosque.
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
    console.error("Vérification du profil :", profileError.message);
    return { error: jsonError("Impossible de vérifier le profil.", 500) };
  }

  if (!profile || profile.role !== "admin" || !profile.actif) {
    return {
      error: jsonError(
        "Accès réservé aux administrateurs actifs.",
        403
      ),
    };
  }

  const { data: kiosque, error: kiosqueError } = await admin
    .from("kiosques")
    .select("id, owner_id, actif")
    .eq("owner_id", user.id)
    .eq("actif", true)
    .maybeSingle();

  if (kiosqueError) {
    console.error("Recherche du kiosque :", kiosqueError.message);
    return {
      error: jsonError("Impossible de vérifier le kiosque.", 500),
    };
  }

  if (!kiosque) {
    return {
      error: jsonError(
        "Aucun kiosque actif n'est associé à cet administrateur.",
        403
      ),
    };
  }

  if (
    !profile.kiosque_id ||
    profile.kiosque_id !== kiosque.id ||
    kiosque.owner_id !== user.id
    ) {
    console.error("Incohérence du rattachement administrateur/kiosque.", {
        userId: user.id,
        profileKiosqueId: profile.kiosque_id,
        kioskId: kiosque.id,
        ownerId: kiosque.owner_id,
    });

    return {
        error: jsonError(
        "Le compte administrateur n'est pas correctement associé à son kiosque.",
        403
        ),
    };
    }

  return {
    admin,
    currentUser: profile,
    kiosque,
  };
}

// GET : liste uniquement les utilisateurs du kiosque connecté.

export async function GET(request) {
  try {
    const { sessionClient, admin } = await getClients();
    const { searchParams } = new URL(request.url);

    // Le dashboard demande le kiosque de l'utilisateur connecté.
    if (searchParams.get("action") === "kiosk") {
      const {
        data: { user },
        error: authError,
      } = await sessionClient.auth.getUser();

      if (authError || !user) {
        return jsonError("Connexion requise.", 401);
      }

      // Récupérer le profil du compte connecté.
      const { data: profile, error: profileError } = await admin
        .from("users")
        .select("id, nom, role, actif, kiosque_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profil dashboard :", profileError.message);
        return jsonError("Impossible de récupérer le profil.", 500);
      }

      if (!profile || !profile.actif) {
        return jsonError("Compte utilisateur inactif ou introuvable.", 403);
      }

      if (!profile.kiosque_id) {
        return jsonError(
          "Aucun kiosque n'est associé à cet utilisateur. Vérifie le champ kiosque_id dans public.users.",
          403
        );
      }

      // Lire le kiosque par son identifiant, et non par owner_id.
      const { data: kiosk, error: kioskError } = await admin
        .from("kiosques")
        .select("id, nom, devise, actif")
        .eq("id", profile.kiosque_id)
        .eq("actif", true)
        .maybeSingle();

      if (kioskError) {
        console.error("Kiosque dashboard :", kioskError.message);
        return jsonError("Impossible de récupérer le kiosque.", 500);
      }

      if (!kiosk) {
        return jsonError(
          "Le kiosque associé à cet utilisateur n'existe pas ou est inactif.",
          404
        );
      }

      return NextResponse.json({
        kiosk: {
          id: kiosk.id,
          nom: kiosk.nom,
          devise: kiosk.devise,
        },
        user: {
          id: profile.id,
          nom: profile.nom,
          role: profile.role,
        },
      });
    }

    // Le reste de cette route demeure réservé aux administrateurs.
    const result = await requireAdmin();
    if (result.error) return result.error;

    const { kiosque } = result;

    const { data, error } = await admin
      .from("users")
      .select(
        "id, nom, telephone, email, auth_email, role, actif, kiosque_id, created_at, updated_at"
      )
      .eq("kiosque_id", kiosque.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Chargement utilisateurs :", error.message);
      return jsonError("Impossible de charger les utilisateurs.", 500);
    }

    return NextResponse.json({
      users: data || [],
      kiosque: { id: kiosque.id },
    });
  } catch (error) {
    console.error("GET /api/admin/users :", error);
    return jsonError("Erreur serveur.", 500);
  }
}


// POST : crée un gérant ou un caissier dans le kiosque connecté.
export async function POST(request) {
  let admin;
  let authUserId;

  try {
    const result = await requireAdmin();
    if (result.error) return result.error;

    admin = result.admin;

    const { kiosque } = result;
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

    // Un administrateur de kiosque ne peut pas créer d'autres admins.
    if (!["gerant", "caissier"].includes(role)) {
      return jsonError(
        "Tu peux uniquement créer un gérant ou un caissier.",
        403
      );
    }

    // Vérification des doublons à l'échelle de la plateforme.
    const { data: existing, error: lookupError } = await admin
      .from("users")
      .select("id")
      .or(`telephone.eq.${telephone},auth_email.eq.${email}`)
      .limit(1);

    if (lookupError) {
      console.error("Recherche doublon :", lookupError.message);
      return jsonError("Impossible de vérifier les doublons.", 500);
    }

    if (existing?.length) {
      return jsonError(
        "Ce téléphone ou cet e-mail est déjà utilisé.",
        409
      );
    }

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
        kiosque_id: kiosque.id,
      })
      .select(
        "id, nom, telephone, email, auth_email, role, actif, kiosque_id, created_at, updated_at"
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

    return NextResponse.json({ user: profile }, { status: 201 });
  } catch (error) {
    if (admin && authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }

    console.error("POST /api/admin/users :", error);
    return jsonError("Erreur serveur pendant la création.", 500);
  }
}

// PATCH : modifie uniquement un gérant ou un caissier du même kiosque.
export async function PATCH(request) {
  try {
    const result = await requireAdmin();
    if (result.error) return result.error;

    const { admin, kiosque } = result;
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
        "Un administrateur de kiosque ne peut attribuer que les rôles gérant et caissier.",
        403
      );
    }

    if (typeof actif !== "boolean") {
      return jsonError("Le statut du compte est invalide.");
    }

    // IMPORTANT : vérifier l'appartenance au kiosque avant toute modification.
    const { data: target, error: targetError } = await admin
      .from("users")
      .select("id, auth_email, role, actif, kiosque_id")
      .eq("id", id)
      .eq("kiosque_id", kiosque.id)
      .maybeSingle();

    if (targetError) {
      console.error("Recherche utilisateur :", targetError.message);
      return jsonError("Impossible de vérifier cet utilisateur.", 500);
    }

    if (!target) {
      return jsonError(
        "Utilisateur introuvable dans ton kiosque.",
        404
      );
    }

    // Ne pas permettre à un admin de modifier un autre compte admin.
    if (target.role === "admin") {
      return jsonError(
        "Tu ne peux pas modifier un compte administrateur.",
        403
      );
    }

    const { data: duplicates, error: duplicateError } = await admin
      .from("users")
      .select("id")
      .neq("id", id)
      .or(`telephone.eq.${telephone},auth_email.eq.${email}`)
      .limit(1);

    if (duplicateError) {
      console.error("Recherche doublon :", duplicateError.message);
      return jsonError("Impossible de vérifier les doublons.", 500);
    }

    if (duplicates?.length) {
      return jsonError(
        "Ce téléphone ou cet e-mail est déjà utilisé.",
        409
      );
    }

    // Synchroniser le compte Auth.
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
      .eq("kiosque_id", kiosque.id)
      .select(
        "id, nom, telephone, email, auth_email, role, actif, kiosque_id, created_at, updated_at"
      )
      .maybeSingle();

    if (updateError) {
      console.error("Modification du profil :", updateError.message);
      return jsonError("Impossible de modifier le profil utilisateur.", 500);
    }

    if (!updated) {
      return jsonError(
        "Utilisateur introuvable dans ton kiosque.",
        404
      );
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PATCH /api/admin/users :", error);
    return jsonError("Erreur serveur pendant la modification.", 500);
  }
}
