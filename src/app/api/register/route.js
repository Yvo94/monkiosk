
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalizePhone(value) {
  let phone = String(value || "")
    .trim()
    .replace(/[\s().-]/g, "");

  if (/^0\d{9}$/.test(phone)) phone = `+225${phone.slice(1)}`;
  if (/^225\d{10}$/.test(phone)) phone = `+${phone}`;

  return phone;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase serveur incomplète.");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function throwIfError(error) {
  if (error) throw error;
}

export async function POST(request) {
  let admin;
  let newUserId = null;

  try {
    const body = await request.json();

    const nomProprietaire = String(body.nomProprietaire || "").trim();
    const nomKiosque = String(body.nomKiosque || "").trim();
    const nomLavage = String(body.nomLavage || "").trim();
    const whatsapp = normalizePhone(body.whatsapp);
    const emailSaisi = String(body.email || "").trim().toLowerCase();
    const motDePasse = String(body.motDePasse || "");
    const devise = String(body.devise || "FCFA").trim();

    // Compatibilité avec l'ancien formulaire :
    // en l'absence de "modules", on conserve le comportement Kiosque.
    const modulesDemandes =
      body.modules === undefined ? ["kiosque"] : body.modules;

    if (
      !Array.isArray(modulesDemandes) ||
      modulesDemandes.length === 0 ||
      !modulesDemandes.every(
        (module) => typeof module === "string"
      )
    ) {
      return NextResponse.json(
        { error: "Sélectionne au moins un module valide." },
        { status: 400 }
      );
    }

    const modules = [...new Set(modulesDemandes)];

    const modulesAutorises = ["kiosque", "lavage"];
    const modulesInvalides = modules.filter(
      (module) => !modulesAutorises.includes(module)
    );

    if (modulesInvalides.length > 0) {
      return NextResponse.json(
        { error: "Un ou plusieurs modules sélectionnés sont invalides." },
        { status: 400 }
      );
    }

    const veutKiosque = modules.includes("kiosque");
    const veutLavage = modules.includes("lavage");

    if (!nomProprietaire || !whatsapp || !motDePasse) {
      return NextResponse.json(
        { error: "Renseigne tous les champs obligatoires." },
        { status: 400 }
      );
    }

    if (
      nomProprietaire.length > 120 ||
      nomKiosque.length > 150 ||
      nomLavage.length > 150
    ) {
      return NextResponse.json(
        { error: "Un des noms saisis est trop long." },
        { status: 400 }
      );
    }

    if (veutKiosque && !nomKiosque) {
      return NextResponse.json(
        { error: "Renseigne le nom de ton établissement Kiosque." },
        { status: 400 }
      );
    }

    if (veutLavage && !nomLavage) {
      return NextResponse.json(
        { error: "Renseigne le nom de ta station de lavage." },
        { status: 400 }
      );
    }

    if (!/^\+[1-9]\d{7,14}$/.test(whatsapp)) {
      return NextResponse.json(
        {
          error:
            "Numéro WhatsApp invalide. Exemple : 0700000000 ou +2250700000000.",
        },
        { status: 400 }
      );
    }

    if (motDePasse.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères." },
        { status: 400 }
      );
    }

    if (
      emailSaisi &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailSaisi) ||
        emailSaisi.length > 254)
    ) {
      return NextResponse.json(
        { error: "L'adresse e-mail est invalide." },
        { status: 400 }
      );
    }

    if (devise !== "FCFA") {
      return NextResponse.json(
        { error: "Devise non prise en charge." },
        { status: 400 }
      );
    }

    admin = getAdminClient();

    // Vérifier que le numéro n'est pas déjà utilisé.
    const { data: existingProfile, error: lookupError } = await admin
      .from("users")
      .select("id")
      .eq("telephone", whatsapp)
      .maybeSingle();

    throwIfError(lookupError);

    if (existingProfile) {
      return NextResponse.json(
        { error: "Ce numéro WhatsApp possède déjà un compte." },
        { status: 409 }
      );
    }

    // Vérifier les modules dans le catalogue central.
    const { data: catalogue, error: catalogueError } = await admin
      .from("modules")
      .select("id, code, actif")
      .in("code", modules);

    throwIfError(catalogueError);

    const modulesDisponibles = catalogue || [];
    const codesDisponibles = modulesDisponibles
      .filter((module) => module.actif)
      .map((module) => module.code);

    if (modules.some((code) => !codesDisponibles.includes(code))) {
      return NextResponse.json(
        {
          error:
            "Un module sélectionné est indisponible. Vérifie le catalogue des modules.",
        },
        { status: 400 }
      );
    }

    // Identifiant de connexion technique si aucun e-mail n'est fourni.
    const phoneDigits = whatsapp.replace(/\D/g, "");
    const authEmail =
      emailSaisi || `wa-${phoneDigits}@auth.maaxbusiness.com`;

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        phone: whatsapp,
        password: motDePasse,
        phone_confirm: true,
        email: authEmail,
        email_confirm: true,
        user_metadata: {
          full_name: nomProprietaire,
          whatsapp,
          email: emailSaisi || null,
        },
      });

    if (authError) {
      if (
        /already registered|already exists|duplicate/i.test(
          authError.message || ""
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Ce numéro ou cette adresse e-mail est déjà associé à un compte.",
          },
          { status: 409 }
        );
      }

      throw authError;
    }

    newUserId = authData.user.id;

    // Profil propriétaire.
    const { error: profileError } = await admin.from("users").insert({
      id: newUserId,
      nom: nomProprietaire,
      email: emailSaisi || null,
      role: "admin",
      actif: true,
      telephone: whatsapp,
      auth_email: authEmail,
    });

    throwIfError(profileError);

    // Rôle global du propriétaire.
    const { error: roleError } = await admin
      .from("monkiosk_user_roles")
      .insert({
        user_id: newUserId,
        role: "owner",
      });

    throwIfError(roleError);

    // Enregistrer les modules sélectionnés.
    const associations = modulesDisponibles
      .filter((module) => modules.includes(module.code))
      .map((module) => ({
        proprietaire_id: newUserId,
        module_id: module.id,
        actif: true,
      }));

    const { error: associationsError } = await admin
      .from("proprietaire_modules")
      .insert(associations);

    throwIfError(associationsError);

    let kiosque = null;
    let caissePrincipale = null;
    let lavage = null;
    let caisseLavage = null;

    // =====================================================
    // MODULE KIOSQUE : établissement + caisse principale
    // =====================================================
    if (veutKiosque) {
      const { data, error } = await admin
        .from("kiosques")
        .insert({
          nom: nomKiosque,
          owner_id: newUserId,
          actif: true,
          devise,
        })
        .select("id, nom, owner_id, actif, devise")
        .single();

      throwIfError(error);
      kiosque = data;

      // Conserver la compatibilité avec le dashboard actuel.
      const { data: profilRattache, error: rattachementError } =
        await admin
          .from("users")
          .update({ kiosque_id: kiosque.id })
          .eq("id", newUserId)
          .select("id, kiosque_id")
          .single();

      throwIfError(rattachementError);

      if (profilRattache.kiosque_id !== kiosque.id) {
        throw new Error(
          "Le kiosque n'a pas été correctement associé au propriétaire."
        );
      }

      const { data: caisse, error: caisseError } = await admin
        .from("kiosque_caisses")
        .insert({
          kiosque_id: kiosque.id,
          code: "PRINCIPALE",
          nom: "Caisse principale",
          solde_initial: 0,
          solde_actuel: 0,
        })
        .select(
          "id, kiosque_id, code, nom, solde_initial, solde_actuel"
        )
        .single();

      throwIfError(caisseError);
      caissePrincipale = caisse;
    }

    // =====================================================
    // MODULE LAVAGE : station + caisse principale dédiée
    // =====================================================
    if (veutLavage) {
      const { data, error } = await admin
        .from("lavages")
        .insert({
          nom: nomLavage,
          owner_id: newUserId,
          actif: true,
          devise,
        })
        .select("id, nom, owner_id, actif, devise")
        .single();

      throwIfError(error);
      lavage = data;

      const { data: caisse, error: caisseError } = await admin
        .from("lavage_caisses")
        .insert({
          lavage_id: lavage.id,
          code: "PRINCIPALE",
          nom: "Caisse principale",
          solde_initial: 0,
          solde_actuel: 0,
          actif: true,
        })
        .select(
          "id, lavage_id, code, nom, solde_initial, solde_actuel"
        )
        .single();

      throwIfError(caisseError);
      caisseLavage = caisse;
    }

    return NextResponse.json(
      {
        success: true,
        message: "Compte, modules, établissements et caisses créés avec succès.",
        modules,
        kiosque,
        caissePrincipale,
        lavage,
        caisseLavage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur inscription publique MAAX Business :", error);

    // Nettoyage compensatoire si une étape échoue.
    // On libère d'abord le profil de sa référence au kiosque.
    if (admin && newUserId) {
      try {
        await admin
          .from("users")
          .update({ kiosque_id: null })
          .eq("id", newUserId);

        await admin
          .from("lavages")
          .delete()
          .eq("owner_id", newUserId);

        await admin
          .from("kiosques")
          .delete()
          .eq("owner_id", newUserId);

        await admin
          .from("proprietaire_modules")
          .delete()
          .eq("proprietaire_id", newUserId);

        await admin
          .from("monkiosk_user_roles")
          .delete()
          .eq("user_id", newUserId);

        await admin.from("users").delete().eq("id", newUserId);

        await admin.auth.admin.deleteUser(newUserId);
      } catch (cleanupError) {
        console.error(
          "Erreur pendant le nettoyage de l'inscription :",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "La création du compte a échoué. Vérifie la configuration et réessaie.",
      },
      { status: 500 }
    );
  }
}
