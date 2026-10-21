
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getContext(request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    }
  );

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return { error: "Session expirée ou utilisateur non connecté.", status: 401 };
  }

  const { searchParams } = new URL(request.url);
  const requestedId = searchParams.get("lavage_id");

  let query = supabase
    .from("lavages")
    .select("id, nom, actif")
    .eq("owner_id", authData.user.id)
    .eq("actif", true);

  if (requestedId) query = query.eq("id", requestedId);

  const { data: stations, error } = await query.order("created_at");

  if (error) {
    console.error("Chargement des stations :", error);
    return { error: "Impossible de charger les stations.", status: 500 };
  }

  if (!stations?.length) {
    return {
      error: "Aucune station de lavage active accessible.",
      status: 403,
    };
  }

  if (!requestedId && stations.length > 1) {
    return {
      error: "Plusieurs stations actives : sélectionnez une station.",
      status: 409,
    };
  }

  return { supabase, lavage: stations[0] };
}

export async function GET(request) {
  try {
    const context = await getContext(request);
    if (context.error) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status }
      );
    }

    const { data, error } = await context.supabase
      .from("lavage_prestations")
      .select("id, lavage_id, nom, description, prix, actif, created_at")
      .eq("lavage_id", context.lavage.id)
      .order("nom");

    if (error) throw error;

    return NextResponse.json({
      items: data || [],
      lavage: context.lavage,
    });
  } catch (error) {
    console.error("GET types lavage :", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors du chargement." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const context = await getContext(request);
    if (context.error) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status }
      );
    }

    const body = await request.json();
    const nom = String(body.nom || "").trim();
    const description = String(body.description || "").trim();
    const prix = Number(body.prix);

    if (!nom) {
      return NextResponse.json(
        { error: "Le nom du type de lavage est obligatoire." },
        { status: 400 }
      );
    }

    const { data, error } = await context.supabase
      .from("lavage_prestations")
      .insert({
        lavage_id: context.lavage.id,
        nom,
        description: description || null,
        actif: true,
      })
      .select("id, lavage_id, nom, description, actif, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ce type de lavage existe déjà." },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    console.error("POST types lavage :", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la création." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const context = await getContext(request);
    if (context.error) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status }
      );
    }

    const body = await request.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Identifiant manquant." },
        { status: 400 }
      );
    }

    const updates = {};

    if (typeof body.nom === "string") {
      const nom = body.nom.trim();
      if (!nom) {
        return NextResponse.json(
          { error: "Le nom est obligatoire." },
          { status: 400 }
        );
      }
      updates.nom = nom;
    }

    if (typeof body.description === "string" || body.description === null) {
      updates.description = String(body.description || "").trim() || null;
    }

    if (body.prix !== undefined) {
      const prix = Number(body.prix);

      if (body.prix === "" || body.prix === null ||
          !Number.isFinite(prix) || prix < 0) {
        return NextResponse.json(
          { error: "Le prix doit être un nombre positif ou nul." },
          { status: 400 }
        );
      }

      updates.prix = prix;
    }

    if (typeof body.actif === "boolean") {
      updates.actif = body.actif;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json(
        { error: "Aucune modification fournie." },
        { status: 400 }
      );
    }

    const { data, error } = await context.supabase
      .from("lavage_prestations")
      .update(updates)
      .eq("id", id)
      .eq("lavage_id", context.lavage.id)
      .select("id, lavage_id, nom, description, prix, actif, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Un type de lavage portant ce nom existe déjà." },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("PATCH types lavage :", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la modification." },
      { status: 500 }
    );
  }
}
