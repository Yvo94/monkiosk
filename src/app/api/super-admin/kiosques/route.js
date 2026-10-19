
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("Configuration Supabase incomplète.");
  }

  return {
    authClient: createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    adminClient: createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function verifierSuperAdmin(request, clients) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Session manquante ou expirée." },
        { status: 401 }
      ),
    };
  }

  const { data, error } = await clients.authClient.auth.getUser(token);

  if (error || !data?.user) {
    return {
      error: NextResponse.json(
        { error: "Session invalide. Reconnecte-toi." },
        { status: 401 }
      ),
    };
  }

  const { data: role, error: roleError } = await clients.adminClient
    .from("monkiosk_user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError) {
    console.error("Vérification du rôle impossible :", roleError);
    return {
      error: NextResponse.json(
        { error: "Impossible de vérifier les autorisations." },
        { status: 500 }
      ),
    };
  }

  if (!role) {
    return {
      error: NextResponse.json(
        { error: "Accès réservé au super-administrateur." },
        { status: 403 }
      ),
    };
  }

  return { user: data.user, adminClient: clients.adminClient };
}

async function obtenirStatistiques(adminClient, kiosqueId) {
  const { data, error } = await adminClient.rpc(
    "superadmin_kiosque_stats",
    { p_kiosque_id: kiosqueId }
  );

  if (error) {
    console.error("Erreur statistiques kiosque :", error);
    throw new Error(
      "Impossible de calculer les statistiques. Vérifie la fonction SQL superadmin_kiosque_stats."
    );
  }

  const lignes = data || [];

  return {
    totalEnregistrements: lignes.reduce(
      (total, ligne) => total + Number(ligne.record_count || 0),
      0
    ),
    tailleEstimeeOctets: lignes.reduce(
      (total, ligne) => total + Number(ligne.estimated_bytes || 0),
      0
    ),
    details: lignes.map((ligne) => ({
      table: ligne.table_name,
      enregistrements: Number(ligne.record_count || 0),
      octets: Number(ligne.estimated_bytes || 0),
    })),
  };
}

function formaterProprietaire(profil, authUser) {
  const metadata = authUser?.user_metadata || {};

  return {
    id: profil?.id || authUser?.id || null,
    nom: profil?.nom || metadata.full_name || "",
    whatsapp:
      profil?.telephone ||
      metadata.whatsapp ||
      authUser?.phone ||
      "",
    email: profil?.email || profil?.auth_email || authUser?.email || "",
  };
}

export async function GET(request) {
  try {
    const clients = getClients();
    const verification = await verifierSuperAdmin(request, clients);

    if (verification.error) return verification.error;

    const { adminClient } = verification;

    const { data: kiosques, error } = await adminClient
      .from("kiosques")
      .select("id, nom, owner_id, actif, devise")
      .order("nom", { ascending: true });

    if (error) throw error;

    const resultat = await Promise.all(
      (kiosques || []).map(async (kiosque) => {
        let profil = null;
        let authUser = null;

        if (kiosque.owner_id) {
          const [profilResult, authResult] = await Promise.all([
            adminClient
              .from("users")
              .select("id, nom, email, auth_email, telephone")
              .eq("id", kiosque.owner_id)
              .maybeSingle(),
            adminClient.auth.admin.getUserById(kiosque.owner_id),
          ]);

          if (profilResult.error) throw profilResult.error;
          profil = profilResult.data;
          authUser = authResult.data?.user || null;
        }

        let statistiques;

        try {
          statistiques = await obtenirStatistiques(adminClient, kiosque.id);
        } catch (err) {
          // Ne pas présenter une statistique indisponible comme un zéro.
          statistiques = {
            totalEnregistrements: null,
            tailleEstimeeOctets: null,
            details: [],
            erreur: err.message,
          };
        }

        return {
          ...kiosque,
          proprietaire: formaterProprietaire(profil, authUser),
          statistiques,
        };
      })
    );

    return NextResponse.json({ kiosques: resultat });
  } catch (error) {
    console.error("GET /api/super-admin/kiosques :", error);

    return NextResponse.json(
      { error: error.message || "Impossible de charger les structures." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let clients;
  let nouvelUtilisateurId = null;
  let nouveauKiosqueId = null;

  try {
    clients = getClients();

    const verification = await verifierSuperAdmin(request, clients);
    if (verification.error) return verification.error;

    const { adminClient } = verification;
    const body = await request.json();

    const nomKiosque = String(body.nomKiosque || "").trim();
    const nomProprietaire = String(body.nomProprietaire || "").trim();
    const whatsappSaisi = String(body.whatsapp || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const motDePasse = String(body.motDePasse || "");
    const devise = String(body.devise || "FCFA").trim();

    if (!nomKiosque || !nomProprietaire || !whatsappSaisi || !motDePasse) {
      return NextResponse.json(
        { error: "Renseigne le nom de la structure, le propriétaire, WhatsApp et le mot de passe." },
        { status: 400 }
      );
    }

    if (motDePasse.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères." },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "L'adresse e-mail est invalide." },
        { status: 400 }
      );
    }

    let whatsapp = whatsappSaisi.replace(/[\s().-]/g, "");

    if (/^0[157]\d{8}$/.test(whatsapp)) {
      whatsapp = `+225${whatsapp}`;
    } else if (/^2250[157]\d{8}$/.test(whatsapp)) {
      whatsapp = `+${whatsapp}`;
    } else if (/^225[157]\d{7}$/.test(whatsapp)) {
      whatsapp = `+${whatsapp}`;
    } else if (/^\+[1-9]\d{7,14}$/.test(whatsapp)) {
      // Numéro international déjà normalisé.
    } else {
      return NextResponse.json(
        {
          error:
            "Numéro WhatsApp invalide. Utilise un numéro ivoirien à 10 chiffres ou un numéro international.",
        },
        { status: 400 }
      );
    }

    if (devise !== "FCFA") {
      return NextResponse.json(
        { error: "La devise actuellement prise en charge est FCFA." },
        { status: 400 }
      );
    }

    // Une structure correspond à un seul compte propriétaire.
    // Le numéro de téléphone sert d'identifiant de connexion.
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        phone: whatsapp,
        password: motDePasse,
        phone_confirm: true,
        ...(email ? { email, email_confirm: true } : {}),
        user_metadata: {
          full_name: nomProprietaire,
          whatsapp,
          ...(email ? { email } : {}),
        },
      });

    if (createError) throw createError;
    nouvelUtilisateurId = created.user.id;

    const { error: profileError } = await adminClient.from("users").insert({
      id: nouvelUtilisateurId,
      nom: nomProprietaire,
      email: email || null,
      auth_email: email || null,
      role: "admin",
      actif: true,
      telephone: whatsapp,
    });

    if (profileError) throw profileError;

    const { error: roleError } = await adminClient
      .from("monkiosk_user_roles")
      .insert({
        user_id: nouvelUtilisateurId,
        role: "owner",
      });

    if (roleError) throw roleError;

    const { data: kiosque, error: kioskError } = await adminClient
      .from("kiosques")
      .insert({
        nom: nomKiosque,
        owner_id: nouvelUtilisateurId,
        actif: true,
        devise: "FCFA",
      })
      .select("id, nom, owner_id, actif, devise")
      .single();

    if (kioskError) throw kioskError;
    nouveauKiosqueId = kiosque.id;

    const { error: associationError } = await adminClient
      .from("users")
      .update({ kiosque_id: kiosque.id })
      .eq("id", nouvelUtilisateurId);

    if (associationError) throw associationError;

    return NextResponse.json(
      {
        message: "Structure créée avec succès.",
        kiosque: {
          ...kiosque,
          proprietaire: {
            id: nouvelUtilisateurId,
            nom: nomProprietaire,
            whatsapp,
            email,
          },
          statistiques: {
            totalEnregistrements: 0,
            tailleEstimeeOctets: 0,
            details: [],
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/super-admin/kiosques :", error);

    // Compensation en cas d'échec afin de ne pas laisser un compte
    // partiellement créé. Les suppressions restent limitées aux objets
    // créés par cette requête.
    if (clients && nouvelUtilisateurId) {
      if (nouveauKiosqueId) {
        await clients.adminClient
          .from("kiosques")
          .delete()
          .eq("id", nouveauKiosqueId);
      }

      await clients.adminClient
        .from("monkiosk_user_roles")
        .delete()
        .eq("user_id", nouvelUtilisateurId)
        .eq("role", "owner");

      await clients.adminClient.from("users").delete().eq("id", nouvelUtilisateurId);

      await clients.adminClient.auth.admin.deleteUser(nouvelUtilisateurId);
    }

    const message = error.message || "Impossible de créer la structure.";
    const status =
      /already registered|already exists|duplicate key/i.test(message)
        ? 409
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
