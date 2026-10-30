
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request) {
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

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Aucun renouvellement de cookie dans cette route.
        },
      },
    });

    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // =====================================================
    // AUTHENTIFICATION
    // =====================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Connexion requise." },
        { status: 401 }
      );
    }

    // =====================================================
    // PROFIL UTILISATEUR
    // =====================================================

    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, nom, role, actif, kiosque_id, lavage_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Contexte utilisateur :", profileError.message);

      return NextResponse.json(
        { error: "Impossible de récupérer le profil." },
        { status: 500 }
      );
    }

    if (!profile || !profile.actif) {
      return NextResponse.json(
        { error: "Compte utilisateur inactif ou introuvable." },
        { status: 403 }
      );
    }

    const modules = [];

    // =====================================================
    // KIOSQUE
    // =====================================================

    if (profile.kiosque_id) {
      const { data: kiosk, error: kioskError } = await admin
        .from("kiosques")
        .select("id, nom, devise, actif")
        .eq("id", profile.kiosque_id)
        .eq("actif", true)
        .maybeSingle();

      if (kioskError) {
        console.error("Contexte kiosque :", kioskError.message);

        return NextResponse.json(
          { error: "Impossible de vérifier le kiosque." },
          { status: 500 }
        );
      }

      if (kiosk) {
        modules.push({
          code: "kiosque",
          nom: "Kiosque",
          etablissement: {
            id: kiosk.id,
            nom: kiosk.nom,
            devise: kiosk.devise,
          },
        });
      }
    }

    // =====================================================
    // LAVAGE
    // =====================================================

    let lavage = null;
    let proprietaireId = null;

    if (profile.role === "admin") {
      // L'administrateur retrouve sa station par owner_id.
      const { data, error } = await admin
        .from("lavages")
        .select("id, nom, devise, actif, owner_id")
        .eq("owner_id", user.id)
        .eq("actif", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Contexte lavage administrateur :", error.message);

        return NextResponse.json(
          { error: "Impossible de vérifier le module Lavage." },
          { status: 500 }
        );
      }

      lavage = data;
      proprietaireId = data?.owner_id || null;

    } else if (["gerant", "caissier"].includes(profile.role)) {
      // Le gérant et le caissier retrouvent leur station
      // par le lavage_id enregistré dans leur profil.

      if (profile.lavage_id) {
        const { data, error } = await admin
          .from("lavages")
          .select("id, nom, devise, actif, owner_id")
          .eq("id", profile.lavage_id)
          .eq("actif", true)
          .maybeSingle();

        if (error) {
          console.error("Contexte lavage utilisateur :", error.message);

          return NextResponse.json(
            { error: "Impossible de vérifier votre station de lavage." },
            { status: 500 }
          );
        }

        lavage = data;
        proprietaireId = data?.owner_id || null;
      }
    }

    // =====================================================
    // VÉRIFICATION DE L'ABONNEMENT / MODULE PROPRIÉTAIRE
    // =====================================================

    if (lavage && proprietaireId) {
      const { data: association, error: associationError } =
        await admin
          .from("proprietaire_modules")
          .select("id, actif, modules!inner(code, actif)")
          .eq("proprietaire_id", proprietaireId)
          .eq("actif", true)
          .eq("modules.code", "lavage")
          .eq("modules.actif", true)
          .maybeSingle();

      if (associationError) {
        console.error(
          "Association du module Lavage :",
          associationError.message
        );

        return NextResponse.json(
          { error: "Impossible de vérifier les droits du module." },
          { status: 500 }
        );
      }

      if (association) {
        modules.push({
          code: "lavage",
          nom: "Lavage",
          etablissement: {
            id: lavage.id,
            nom: lavage.nom,
            devise: lavage.devise,
          },
        });
      }
    }

    // =====================================================
    // RÉPONSE
    // =====================================================

    return NextResponse.json({
      user: {
        id: profile.id,
        nom: profile.nom,
        role: profile.role,
      },
      modules,
    });

  } catch (error) {
    console.error("GET /api/auth/context :", error);

    return NextResponse.json(
      { error: "Erreur serveur lors du chargement du contexte." },
      { status: 500 }
    );
  }
}
