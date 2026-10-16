// src/app/api/register/route.js

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

export async function POST(request) {
  let admin;
  let newUserId = null;

  try {
    const body = await request.json();

    const nomProprietaire = String(body.nomProprietaire || "").trim();
    const nomKiosque = String(body.nomKiosque || "").trim();
    const whatsapp = normalizePhone(body.whatsapp);
    const emailSaisi = String(body.email || "").trim().toLowerCase();
    const motDePasse = String(body.motDePasse || "");
    const devise = String(body.devise || "FCFA").trim();

    if (!nomProprietaire || !nomKiosque || !whatsapp || !motDePasse) {
      return NextResponse.json(
        { error: "Renseigne tous les champs obligatoires." },
        { status: 400 }
      );
    }

    if (nomProprietaire.length > 120 || nomKiosque.length > 150) {
      return NextResponse.json(
        { error: "Le nom saisi est trop long." },
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

    // Vérifier si le numéro est déjà utilisé dans le profil applicatif.
    const { data: existingProfile, error: lookupError } = await admin
      .from("users")
      .select("id")
      .eq("telephone", whatsapp)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existingProfile) {
      return NextResponse.json(
        { error: "Ce numéro WhatsApp possède déjà un compte." },
        { status: 409 }
      );
    }

    /*
     * La connexion existante utilise users.auth_email.
     * Si aucun e-mail personnel n'est fourni, on crée un identifiant technique
     * stable. Il ne s'agit pas d'une adresse de contact.
     */
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

    const { error: profileError } = await admin.from("users").insert({
      id: newUserId,
      nom: nomProprietaire,
      email: emailSaisi || null,
      role: "admin",
      actif: true,
      telephone: whatsapp,
      auth_email: authEmail,
    });

    if (profileError) throw profileError;

    const { error: roleError } = await admin
      .from("monkiosk_user_roles")
      .insert({
        user_id: newUserId,
        role: "owner",
      });

    if (roleError) throw roleError;

    const { data: kiosque, error: kioskError } = await admin
      .from("kiosques")
      .insert({
        nom: nomKiosque,
        owner_id: newUserId,
        actif: true,
        devise,
      })
      .select("id, nom, owner_id, actif, devise")
      .single();

    if (kioskError) throw kioskError;

    // Rattacher le kiosque au profil du propriétaire.
    const { data: profilRattache, error: rattachementError } = await admin
    .from("users")
    .update({
        kiosque_id: kiosque.id,
    })
    .eq("id", newUserId)
    .select("id, kiosque_id")
    .single();

    if (rattachementError) {
    console.error(
        "Erreur de rattachement du propriétaire au kiosque :",
        rattachementError.message
    );

    throw rattachementError;
    }

    // Vérification finale de la cohérence du rattachement.
    if (profilRattache.kiosque_id !== kiosque.id) {
    throw new Error(
        "Le kiosque créé n'a pas été correctement associé au propriétaire."
    );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Compte et structure créés avec succès.",
        kiosque,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur inscription publique MAAX Business :", error);

    // Nettoyage des enregistrements si une étape a échoué.
    if (admin && newUserId) {
      await admin.from("kiosques").delete().eq("owner_id", newUserId);
      await admin
        .from("monkiosk_user_roles")
        .delete()
        .eq("user_id", newUserId);
      await admin.from("users").delete().eq("id", newUserId);
      await admin.auth.admin.deleteUser(newUserId);
    }

    return NextResponse.json(
      {
        error:
          "La création du compte a échoué. Vérifie les informations et réessaie.",
      },
      { status: 500 }
    );
  }
}