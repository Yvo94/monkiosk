
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createHash } from "crypto";

// =====================================================
// OUTILS
// =====================================================

function hashLicenseCode(code) {
  const normalized = String(code || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  return createHash("sha256")
    .update(normalized)
    .digest("hex");
}

function normalizeLicenseCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

// =====================================================
// POST : ACTIVATION D'UNE LICENCE
// =====================================================

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key || !serviceKey) {
      return NextResponse.json(
        { error: "Configuration Supabase incomplète." },
        { status: 500 }
      );
    }

    // -------------------------------------------------
    // CLIENTS SUPABASE
    // -------------------------------------------------

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Les cookies ne sont pas modifiés ici.
        },
      },
    });

    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // -------------------------------------------------
    // AUTHENTIFICATION
    // -------------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Vous devez être connecté pour activer une licence." },
        { status: 401 }
      );
    }

    // -------------------------------------------------
    // VÉRIFICATION DU PROFIL
    // -------------------------------------------------

    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, nom, actif")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profil activation licence :", profileError.message);

      return NextResponse.json(
        { error: "Impossible de vérifier votre compte." },
        { status: 500 }
      );
    }

    if (!profile || !profile.actif) {
      return NextResponse.json(
        { error: "Votre compte est inactif ou introuvable." },
        { status: 403 }
      );
    }

    // -------------------------------------------------
    // RÉCUPÉRATION DU CODE
    // -------------------------------------------------

    const body = await request.json();
    const code = normalizeLicenseCode(body.code);

    if (!code || code.length < 10) {
      return NextResponse.json(
        { error: "Veuillez saisir un code de licence valide." },
        { status: 400 }
      );
    }

    const codeHash = hashLicenseCode(code);

    // -------------------------------------------------
    // RECHERCHE DE LA LICENCE
    // -------------------------------------------------

    const { data: licence, error: licenceError } = await admin
      .from("licenses")
      .select(`
        id,
        code_hash,
        proprietaire_id,
        modules,
        duree_jours,
        statut,
        date_activation,
        date_expiration
      `)
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (licenceError) {
      console.error("Recherche licence :", licenceError.message);

      return NextResponse.json(
        { error: "Impossible de vérifier la licence." },
        { status: 500 }
      );
    }

    if (!licence) {
      return NextResponse.json(
        { error: "Code de licence incorrect." },
        { status: 404 }
      );
    }

    // -------------------------------------------------
    // VÉRIFICATION DU PROPRIÉTAIRE
    // -------------------------------------------------

    if (!licence.proprietaire_id) {
      return NextResponse.json(
        {
          error:
            "Cette licence n'est pas encore attribuée. Veuillez contacter MAAX Technologies."
        },
        { status: 403 }
      );
    }

    if (licence.proprietaire_id !== user.id) {
      return NextResponse.json(
        {
          error:
            "Cette licence n'est pas attribuée à votre compte."
        },
        { status: 403 }
      );
    }

    // -------------------------------------------------
    // LICENCE DÉJÀ ACTIVÉE
    // -------------------------------------------------

    if (licence.date_activation) {
      const expiration = licence.date_expiration
        ? new Date(licence.date_expiration)
        : null;

      if (
        licence.statut === "active" &&
        expiration &&
        expiration.getTime() > Date.now()
      ) {
        return NextResponse.json({
          success: true,
          message: "Votre licence est déjà active.",
          licence: {
            modules: licence.modules,
            date_activation: licence.date_activation,
            date_expiration: licence.date_expiration,
          },
        });
      }

      return NextResponse.json(
        {
          error: "Cette licence a déjà été utilisée ou a expiré."
        },
        { status: 409 }
      );
    }

    // -------------------------------------------------
    // VÉRIFICATION DU STATUT
    // -------------------------------------------------

    if (licence.statut !== "disponible") {
      return NextResponse.json(
        { error: "Cette licence n'est pas disponible pour activation." },
        { status: 409 }
      );
    }

    if (
      !Number.isInteger(licence.duree_jours) ||
      licence.duree_jours <= 0
    ) {
      return NextResponse.json(
        { error: "La durée de cette licence est invalide." },
        { status: 500 }
      );
    }

    // -------------------------------------------------
    // CALCUL DES DATES
    // -------------------------------------------------

    const maintenant = new Date();

    const expiration = new Date(
      maintenant.getTime() +
      licence.duree_jours * 24 * 60 * 60 * 1000
    );

    // -------------------------------------------------
    // ACTIVATION CONDITIONNELLE
    // -------------------------------------------------

    const { data: licenceActivee, error: activationError } = await admin
      .from("licenses")
      .update({
        statut: "active",
        date_activation: maintenant.toISOString(),
        date_expiration: expiration.toISOString(),
        updated_at: maintenant.toISOString(),
      })
      .eq("id", licence.id)
      .eq("proprietaire_id", user.id)
      .eq("statut", "disponible")
      .is("date_activation", null)
      .select(`
        id,
        modules,
        duree_jours,
        statut,
        date_activation,
        date_expiration
      `)
      .maybeSingle();

    if (activationError) {
      console.error("Activation licence :", activationError.message);

      return NextResponse.json(
        { error: "Une erreur est survenue pendant l'activation." },
        { status: 500 }
      );
    }

    // Si aucune ligne n'a été modifiée, une autre requête
    // a peut-être activé la licence simultanément.
    if (!licenceActivee) {
      return NextResponse.json(
        {
          error:
            "Cette licence a déjà été activée ou n'est plus disponible."
        },
        { status: 409 }
      );
    }

    // -------------------------------------------------
    // SUCCÈS
    // -------------------------------------------------

    return NextResponse.json({
      success: true,
      message: "Votre licence a été activée avec succès.",
      licence: {
        modules: licenceActivee.modules,
        duree_jours: licenceActivee.duree_jours,
        date_activation: licenceActivee.date_activation,
        date_expiration: licenceActivee.date_expiration,
      },
    });

  } catch (error) {
    console.error("POST /api/licences/activation :", error);

    return NextResponse.json(
      { error: "Erreur serveur lors de l'activation de la licence." },
      { status: 500 }
    );
  }
}
