import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getClients() {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Configuration Supabase serveur incomplète.");
  }

  return {
    authClient: createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
    adminClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
  };
}

async function verifierSuperAdmin(request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return { error: "Connexion requise.", status: 401 };
  }

  const { authClient, adminClient } = getClients();

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    return { error: "Session invalide.", status: 401 };
  }

  const { data: role, error: roleError } = await adminClient
    .from("monkiosk_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) {
    console.error("Vérification du rôle :", roleError);
    return { error: "Impossible de vérifier les droits.", status: 500 };
  }

  if (role?.role !== "super_admin") {
    return { error: "Accès réservé au super-utilisateur.", status: 403 };
  }

  return { user, adminClient };
}

export async function GET(request) {
  try {
    const result = await verifierSuperAdmin(request);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { adminClient } = result;

    const { data: kiosques, error } = await adminClient
      .from("kiosques")
      .select("id, nom, owner_id, actif, devise")
      .order("nom", { ascending: true });

    if (error) throw error;

    const proprietaires = await Promise.all(
      (kiosques || []).map(async (kiosque) => {
        const { data } = await adminClient.auth.admin.getUserById(
          kiosque.owner_id
        );

        const proprietaire = data?.user;

        return {
          ...kiosque,
          proprietaire: proprietaire
            ? {
                nom:
                  proprietaire.user_metadata?.full_name ||
                  proprietaire.phone ||
                  proprietaire.email ||
                  "Propriétaire",
                whatsapp:
                  proprietaire.user_metadata?.whatsapp ||
                  proprietaire.phone ||
                  "",
                email: proprietaire.email || "",
              }
            : null,
        };
      })
    );

    return NextResponse.json({ kiosques: proprietaires });
  } catch (error) {
    console.error("Liste des kiosques :", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let adminClient;
  let nouvelUtilisateurId = null;

  try {
    const result = await verifierSuperAdmin(request);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    adminClient = result.adminClient;

    const body = await request.json();
    const nomKiosque = String(body.nomKiosque || "").trim();
    const nomProprietaire = String(body.nomProprietaire || "").trim();
    const whatsappSaisi = String(body.whatsapp || "").trim();
    const emailSaisi = String(body.email || "").trim();
    const email = emailSaisi ? emailSaisi.toLowerCase() : null;

    let whatsapp = whatsappSaisi.replace(/[\s().-]/g, "");

    // Accepter les numéros ivoiriens locaux à 10 chiffres.
    if (/^0\d{9}$/.test(whatsapp)) {
      whatsapp = `+225${whatsapp}`;
    }

    // Accepter aussi les numéros ivoiriens saisis avec 225 sans le signe +.
    if (/^225\d{10}$/.test(whatsapp)) {
      whatsapp = `+${whatsapp}`;
    }
    const devise = String(body.devise || "FCFA").trim();
    const motDePasse = String(body.motDePasse || "");

    if (
      !nomKiosque ||
      !nomProprietaire ||
      !whatsapp ||
      !email ||
      !motDePasse
    ) {
      return NextResponse.json(
        { error: "Tous les champs obligatoires doivent être renseignés." },
        { status: 400 }
      );
    }

    if (motDePasse.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères." },
        { status: 400 }
      );
    }

    if (!/^\+[1-9]\d{7,14}$/.test(whatsapp)) {
      return NextResponse.json(
        {
          error:
            "Numéro invalide. Saisis un numéro ivoirien à 10 chiffres ou un numéro international, par exemple 0700000000 ou +2250700000000.",
        },
        { status: 400 }
      );
    }

    if (!["FCFA"].includes(devise)) {
      return NextResponse.json(
        { error: "Devise non prise en charge." },
        { status: 400 }
      );
    }

    // Créer le compte propriétaire dans Supabase Auth.
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        phone: whatsapp,
        password: motDePasse,
        phone_confirm: true,
        ...(email ? { email } : {}),
        email_confirm: true,
        user_metadata: {
          full_name: nomProprietaire,
          whatsapp,
          email,
        },
      });

    if (authError) throw authError;

    
  nouvelUtilisateurId = authData.user.id;

  // 1. Créer le profil utilisateur dans public.users
  const { error: utilisateurError } = await adminClient
    .from("users")
    .insert({
      id: nouvelUtilisateurId,
      nom: nomProprietaire,
      email: email,
      role: "admin",
      actif: true,
      telephone: whatsapp,
      auth_email: email,
    });

  if (utilisateurError) {
    console.error("Erreur création public.users :", utilisateurError);
    throw utilisateurError;
  }

  // 2. Enregistrer le rôle de propriétaire MonKiosk
  const { error: roleError } = await adminClient
    .from("monkiosk_user_roles")
    .insert({
      user_id: nouvelUtilisateurId,
      role: "owner",
    });

  if (roleError) throw roleError;


    // Créer le kiosque.
    const { data: kiosque, error: kioskError } = await adminClient
      .from("kiosques")
      .insert({
        nom: nomKiosque,
        owner_id: nouvelUtilisateurId,
        actif: true,
        devise,
      })
      .select("id, nom, owner_id, actif, devise")
      .single();

    if (kioskError) throw kioskError;

    return NextResponse.json(
      {
        message: "Kiosque et propriétaire créés avec succès.",
        kiosque,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Création kiosque :", error);

    // Éviter de laisser un compte orphelin si une étape échoue.
    
    if (adminClient && nouvelUtilisateurId) {
      await adminClient
        .from("kiosques")
        .delete()
        .eq("owner_id", nouvelUtilisateurId);

      await adminClient
        .from("monkiosk_user_roles")
        .delete()
        .eq("user_id", nouvelUtilisateurId);

      await adminClient
        .from("users")
        .delete()
        .eq("id", nouvelUtilisateurId);

      await adminClient.auth.admin.deleteUser(nouvelUtilisateurId);
    }


    return NextResponse.json(
      {
        error:
          error.message ||
          "Impossible de créer le kiosque et son propriétaire.",
      },
      { status: 400 }
    );
  }
}
