
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

    const cookieStore = await cookies();

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          
        },
      },
    });

    const admin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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

    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, nom, role, actif, kiosque_id")
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

    // -----------------------------------------------------
    // KIOSQUE
    // Compatibilité avec les comptes existants et les rôles
    // rattachés à un kiosque.
    // -----------------------------------------------------
    if (profile.kiosque_id) {
      const { data: kiosk, error: kioskError } = await admin
        .from("kiosques")
        .select("id, nom, devise, actif")
        .eq("id", profile.kiosque_id)
        .maybeSingle();

      if (kioskError) {
        console.error("Contexte kiosque :", kioskError.message);

        return NextResponse.json(
          { error: "Impossible de vérifier le kiosque." },
          { status: 500 }
        );
      }

      if (kiosk?.actif) {
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

    // -----------------------------------------------------
    // LAVAGE
    // Pour cette première version, le rattachement est celui
    // du propriétaire via lavages.owner_id.
    // -----------------------------------------------------
    const { data: lavage, error: lavageError } = await admin
      .from("lavages")
      .select("id, nom, devise, actif")
      .eq("owner_id", user.id)
      .eq("actif", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lavageError) {
      console.error("Contexte lavage :", lavageError.message);

      return NextResponse.json(
        { error: "Impossible de vérifier le module Lavage." },
        { status: 500 }
      );
    }

    if (lavage) {
      // Vérifier que le propriétaire possède bien le module.
      const { data: association, error: associationError } = await admin
        .from("proprietaire_modules")
        .select("id, actif, modules!inner(code, actif)")
        .eq("proprietaire_id", user.id)
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
