
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


async function verifierSuperAdmin(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || !serviceRoleKey) {
    return {
      error: NextResponse.json(
        {
          error: "Configuration Supabase serveur incomplète.",
        },
        { status: 500 }
      ),
    };
  }

  // Client utilisé uniquement pour vérifier le jeton de l'utilisateur.
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Client administrateur réservé au serveur.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 }
      ),
    };
  }

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token);

  if (authError || !authData?.user) {
    return {
      error: NextResponse.json(
        { error: "Session invalide ou expirée." },
        { status: 401 }
      ),
    };
  }

  const { data: role, error: roleError } = await adminClient
    .from("monkiosk_user_roles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError) {
    console.error("Vérification du rôle super-admin :", roleError);

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

  return { adminClient, user: authData.user };
}


async function lireId(context) {
  const params = await context.params;
  return String(params?.id || "").trim();
}

async function obtenirStatistiques(adminClient, kiosqueId) {
  const { data, error } = await adminClient.rpc(
    "superadmin_kiosque_stats",
    { p_kiosque_id: kiosqueId }
  );

  if (error) {
    console.error("Erreur statistiques kiosque :", error);
    throw new Error(
      "Impossible de vérifier les données de cette structure. La suppression est bloquée par sécurité."
    );
  }

  const details = (data || []).map((ligne) => ({
    table: ligne.table_name,
    enregistrements: Number(ligne.record_count || 0),
    octets: Number(ligne.estimated_bytes || 0),
  }));

  return {
    totalEnregistrements: details.reduce(
      (total, ligne) => total + ligne.enregistrements,
      0
    ),
    tailleEstimeeOctets: details.reduce(
      (total, ligne) => total + ligne.octets,
      0
    ),
    details,
  };
}

function normaliserWhatsapp(valeur) {
  let numero = String(valeur || "").trim().replace(/[\s().-]/g, "");

  if (/^0[157]\d{8}$/.test(numero)) {
    numero = `+225${numero}`;
  } else if (/^2250[157]\d{8}$/.test(numero)) {
    numero = `+${numero}`;
  } else if (/^225[157]\d{7}$/.test(numero)) {
    numero = `+${numero}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(numero) ? numero : null;
}

export async function GET(request, context) {
  try {
    const clients = getClients();
    const verification = await verifierSuperAdmin(request, clients);
    if (verification.error) return verification.error;

    const { adminClient } = verification;
    const id = await lireId(context);

    if (!id) {
      return NextResponse.json(
        { error: "Identifiant de structure manquant." },
        { status: 400 }
      );
    }

    const { data: kiosque, error } = await adminClient
      .from("kiosques")
      .select("id, nom, owner_id, actif, devise")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!kiosque) {
      return NextResponse.json(
        { error: "Structure introuvable." },
        { status: 404 }
      );
    }

    const { data: profil, error: profilError } = await adminClient
      .from("users")
      .select("id, nom, email, auth_email, telephone")
      .eq("id", kiosque.owner_id)
      .maybeSingle();

    if (profilError) throw profilError;

    const { data: authResult, error: authError } =
      await adminClient.auth.admin.getUserById(kiosque.owner_id);

    if (authError) throw authError;

    const metadata = authResult?.user?.user_metadata || {};
    const statistiques = await obtenirStatistiques(adminClient, id);

    return NextResponse.json({
      kiosque: {
        ...kiosque,
        proprietaire: {
          id: kiosque.owner_id,
          nom: profil?.nom || metadata.full_name || "",
          whatsapp:
            profil?.telephone ||
            metadata.whatsapp ||
            authResult?.user?.phone ||
            "",
          email:
            profil?.email ||
            profil?.auth_email ||
            authResult?.user?.email ||
            "",
        },
        statistiques,
      },
    });
  } catch (error) {
    console.error("GET /api/super-admin/kiosques/[id] :", error);

    return NextResponse.json(
      { error: error.message || "Impossible de consulter cette structure." },
      { status: 500 }
    );
  }
}

export async function PATCH(request, context) {
  try {
    const clients = getClients();
    const verification = await verifierSuperAdmin(request, clients);
    if (verification.error) return verification.error;

    const { adminClient } = verification;
    const id = await lireId(context);
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Identifiant de structure manquant." },
        { status: 400 }
      );
    }

    const { data: kiosque, error: kioskError } = await adminClient
      .from("kiosques")
      .select("id, nom, owner_id, actif, devise")
      .eq("id", id)
      .maybeSingle();

    if (kioskError) throw kioskError;

    if (!kiosque) {
      return NextResponse.json(
        { error: "Structure introuvable." },
        { status: 404 }
      );
    }

    const miseAJourKiosque = {};
    const miseAJourProfil = {};
    const miseAJourMetadata = {};

    if (Object.hasOwn(body, "nom")) {
      const nom = String(body.nom || "").trim();

      if (!nom) {
        return NextResponse.json(
          { error: "Le nom de la structure est obligatoire." },
          { status: 400 }
        );
      }

      miseAJourKiosque.nom = nom;
    }

    if (Object.hasOwn(body, "actif")) {
      if (typeof body.actif !== "boolean") {
        return NextResponse.json(
          { error: "Le statut actif doit être un booléen." },
          { status: 400 }
        );
      }

      miseAJourKiosque.actif = body.actif;
    }

    if (Object.hasOwn(body, "nomProprietaire")) {
      const nomProprietaire = String(body.nomProprietaire || "").trim();

      if (!nomProprietaire) {
        return NextResponse.json(
          { error: "Le nom du propriétaire est obligatoire." },
          { status: 400 }
        );
      }

      miseAJourProfil.nom = nomProprietaire;
      miseAJourMetadata.full_name = nomProprietaire;
    }

    if (Object.hasOwn(body, "whatsapp")) {
      const whatsapp = normaliserWhatsapp(body.whatsapp);

      if (!whatsapp) {
        return NextResponse.json(
          { error: "Le numéro WhatsApp est invalide." },
          { status: 400 }
        );
      }

      // Le téléphone est aussi l'identifiant de connexion.
      // On met donc à jour le téléphone Auth et le profil ensemble.
      const { error: authPhoneError } =
        await adminClient.auth.admin.updateUserById(kiosque.owner_id, {
          phone: whatsapp,
          phone_confirm: true,
          user_metadata: {
            whatsapp,
          },
        });

      if (authPhoneError) throw authPhoneError;

      miseAJourProfil.telephone = whatsapp;
      miseAJourMetadata.whatsapp = whatsapp;
    }

    if (Object.hasOwn(body, "email")) {
      const email = String(body.email || "").trim().toLowerCase();

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: "L'adresse e-mail est invalide." },
          { status: 400 }
        );
      }

      miseAJourProfil.email = email || null;
      miseAJourProfil.auth_email = email || null;

      // Supabase Auth ne traite pas une adresse vide comme une suppression.
      // On ne change l'adresse Auth que lorsqu'une nouvelle adresse est fournie.
      if (email) {
        const { error: authEmailError } =
          await adminClient.auth.admin.updateUserById(kiosque.owner_id, {
            email,
            email_confirm: true,
          });

        if (authEmailError) throw authEmailError;

        miseAJourMetadata.email = email;
      }
    }

    if (Object.keys(miseAJourKiosque).length > 0) {
      const { error } = await adminClient
        .from("kiosques")
        .update(miseAJourKiosque)
        .eq("id", id);

      if (error) throw error;
    }

    if (Object.keys(miseAJourProfil).length > 0) {
      const { error } = await adminClient
        .from("users")
        .update(miseAJourProfil)
        .eq("id", kiosque.owner_id);

      if (error) throw error;
    }

    if (Object.keys(miseAJourMetadata).length > 0) {
      const { data: authData, error: authReadError } =
        await adminClient.auth.admin.getUserById(kiosque.owner_id);

      if (authReadError) throw authReadError;

      const { error: metadataError } =
        await adminClient.auth.admin.updateUserById(kiosque.owner_id, {
          user_metadata: {
            ...(authData?.user?.user_metadata || {}),
            ...miseAJourMetadata,
          },
        });

      if (metadataError) throw metadataError;
    }

    const { data: kiosqueMisAJour, error: reloadError } = await adminClient
      .from("kiosques")
      .select("id, nom, owner_id, actif, devise")
      .eq("id", id)
      .single();

    if (reloadError) throw reloadError;

    return NextResponse.json({
      message: "Structure mise à jour avec succès.",
      kiosque: kiosqueMisAJour,
    });
  } catch (error) {
    console.error("PATCH /api/super-admin/kiosques/[id] :", error);

    return NextResponse.json(
      { error: error.message || "Impossible de modifier cette structure." },
      { status: 500 }
    );
  }
}


export async function DELETE(request, context) {
  try {
    const verification = await verifierSuperAdmin(request);

    if (verification.error) {
      return verification.error;
    }

    const { adminClient } = verification;
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Identifiant du kiosque manquant." },
        { status: 400 }
      );
    }

    // 1. Supprimer les données métier et le kiosque en une transaction SQL.
    const { data: ownerId, error: suppressionError } =
      await adminClient.rpc("superadmin_supprimer_kiosque", {
        p_kiosque_id: id,
      });

    if (suppressionError) {
      console.error("Suppression du kiosque :", suppressionError);

      return NextResponse.json(
        {
          error:
            suppressionError.message ||
            "La suppression a échoué. Aucune suppression partielle des données métier n'a été validée.",
        },
        { status: 500 }
      );
    }

    // 2. Vérifier si le propriétaire possède encore un autre kiosque.
    if (ownerId) {
      const { count, error: autresKiosquesError } = await adminClient
        .from("kiosques")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId);

      if (autresKiosquesError) {
        console.error(
          "Vérification des autres kiosques :",
          autresKiosquesError
        );

        return NextResponse.json({
          success: true,
          kiosqueSupprime: true,
          nettoyageCompte: false,
          message:
            "Le kiosque et ses données métier ont été supprimés. Le nettoyage du compte propriétaire reste à vérifier.",
        });
      }

      // 3. Ne pas supprimer un compte encore utilisé par un autre kiosque.
      if (count === 0) {
        const { data: roles, error: rolesError } = await adminClient
          .from("monkiosk_user_roles")
          .select("role")
          .eq("user_id", ownerId);

        if (rolesError) {
          console.error("Lecture des rôles :", rolesError);

          return NextResponse.json({
            success: true,
            kiosqueSupprime: true,
            nettoyageCompte: false,
            message:
              "Le kiosque a été supprimé, mais le nettoyage du compte doit être vérifié.",
          });
        }

        const autresRoles = (roles || []).filter(
          (item) => item.role !== "owner"
        );

        // Protéger notamment un compte possédant un autre rôle privilégié.
        if (autresRoles.length === 0) {
          const { error: roleDeleteError } = await adminClient
            .from("monkiosk_user_roles")
            .delete()
            .eq("user_id", ownerId)
            .eq("role", "owner");

          if (roleDeleteError) {
            console.error("Suppression du rôle owner :", roleDeleteError);

            return NextResponse.json({
              success: true,
              kiosqueSupprime: true,
              nettoyageCompte: false,
              message:
                "Le kiosque a été supprimé, mais le rôle du propriétaire n'a pas pu être nettoyé.",
            });
          }

          const { error: profilDeleteError } = await adminClient
            .from("users")
            .delete()
            .eq("id", ownerId);

          if (profilDeleteError) {
            console.error("Suppression du profil :", profilDeleteError);

            return NextResponse.json({
              success: true,
              kiosqueSupprime: true,
              nettoyageCompte: false,
              message:
                "Le kiosque a été supprimé, mais le profil du propriétaire doit être vérifié.",
            });
          }

          const { error: authDeleteError } =
            await adminClient.auth.admin.deleteUser(ownerId);

          if (authDeleteError) {
            console.error("Suppression du compte Auth :", authDeleteError);

            return NextResponse.json({
              success: true,
              kiosqueSupprime: true,
              nettoyageCompte: false,
              message:
                "Le kiosque a été supprimé, mais le compte Supabase Auth doit être nettoyé manuellement.",
            });
          }
        } else {
          // Le compte possède un autre rôle : on le conserve.
          const { error: roleDeleteError } = await adminClient
            .from("monkiosk_user_roles")
            .delete()
            .eq("user_id", ownerId)
            .eq("role", "owner");

          if (roleDeleteError) {
            console.error("Suppression du rôle owner :", roleDeleteError);

            return NextResponse.json({
              success: true,
              kiosqueSupprime: true,
              nettoyageCompte: false,
              message:
                "Le kiosque a été supprimé, mais le rôle owner n'a pas pu être nettoyé.",
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      kiosqueSupprime: true,
      nettoyageCompte: true,
      message: "Le kiosque et ses données métier ont été supprimés.",
    });
  } catch (error) {
    console.error("DELETE /api/super-admin/kiosques/[id] :", error);

    return NextResponse.json(
      { error: error.message || "Erreur lors de la suppression du kiosque." },
      { status: 500 }
    );
  }
}

