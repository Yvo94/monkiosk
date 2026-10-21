
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
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
          } catch {
            // Les cookies peuvent être en lecture seule dans certains contextes.
          }
        },
      },
    }
  );
}

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getStation(supabase, request) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: errorResponse(
        "Session expirée. Connecte-toi à nouveau.",
        401
      ),
    };
  }

  const url = new URL(request.url);
  const lavageId = url.searchParams.get("lavage_id");

  let query = supabase
    .from("lavages")
    .select("id, nom, devise")
    .eq("owner_id", user.id)
    .eq("actif", true);

  if (lavageId) {
    query = query.eq("id", lavageId);
  }

  const { data: stations, error } = await query.order("created_at");

  if (error) {
    return {
      error: errorResponse(
        "Impossible de récupérer les stations de lavage.",
        500
      ),
    };
  }

  if (!stations?.length) {
    return {
      error: errorResponse(
        "Aucune station de lavage active accessible.",
        404
      ),
    };
  }

  if (!lavageId && stations.length > 1) {
    return {
      error: errorResponse(
        "Plusieurs stations sont disponibles. Précise le paramètre lavage_id.",
        409
      ),
    };
  }

  return { user, station: stations[0] };
}


function validateImageUrl(value) {
  // Autoriser l'absence d'image.
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: null };
  }

  if (typeof value !== "string") {
    return { valid: false };
  }

  const imageUrl = value.trim();

  // Une chaîne vide après nettoyage signifie aucune image.
  if (!imageUrl) {
    return { valid: true, value: null };
  }

  if (imageUrl.length > 2048) {
    return { valid: false };
  }

  try {
    const parsed = new URL(imageUrl);

    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      !parsed.hostname
    ) {
      return { valid: false };
    }

    return { valid: true, value: imageUrl };
  } catch {
    return { valid: false };
  }
}


export async function GET(request) {
  try {
    const supabase = await getSupabase();
    const result = await getStation(supabase, request);

    if (result.error) return result.error;

    const { station } = result;

    const { data, error } = await supabase
      .from("lavage_types_vehicule")
      .select(
        "id, lavage_id, nom, description, image_url, actif, created_at"
      )
      .eq("lavage_id", station.id)
      .order("created_at", { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      lavage: station,
      items: data || [],
    });
  } catch {
    return errorResponse(
      "Erreur interne lors du chargement des types de véhicules.",
      500
    );
  }
}

export async function POST(request) {
  try {
    const supabase = await getSupabase();
    const result = await getStation(supabase, request);

    if (result.error) return result.error;

    const { station } = result;
    const body = await request.json();

    const nom = typeof body.nom === "string" ? body.nom.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (!nom) {
      return errorResponse("Le nom du type de véhicule est obligatoire.");
    }

    if (nom.length > 100) {
      return errorResponse(
        "Le nom du type de véhicule ne doit pas dépasser 100 caractères."
      );
    }

    if (description.length > 500) {
      return errorResponse(
        "La description ne doit pas dépasser 500 caractères."
      );
    }

    const image = validateImageUrl(body.image_url);

    if (!image.valid) {
      return errorResponse(
        "L’adresse de l’image doit être une URL HTTP ou HTTPS valide."
      );
    }

    const { data, error } = await supabase
      .from("lavage_types_vehicule")
      .insert({
        lavage_id: station.id,
        nom,
        description: description || null,
        image_url: image.value,
        actif: true,
      })
      .select(
        "id, lavage_id, nom, description, image_url, actif, created_at"
      )
      .single();

    if (error?.code === "23505") {
      return errorResponse(
        "Ce type de véhicule existe déjà pour cette station.",
        409
      );
    }

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch {
    return errorResponse(
      "Erreur interne lors de la création du type de véhicule.",
      500
    );
  }
}

export async function PATCH(request) {
  try {
    const supabase = await getSupabase();
    const result = await getStation(supabase, request);

    if (result.error) return result.error;

    const { station } = result;
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return errorResponse("Identifiant du type de véhicule manquant.");
    }

    const { data: existing, error: existingError } = await supabase
      .from("lavage_types_vehicule")
      .select("id, lavage_id, nom, description, image_url, actif")
      .eq("id", id)
      .eq("lavage_id", station.id)
      .maybeSingle();

    if (existingError) {
      return errorResponse(existingError.message, 500);
    }

    if (!existing) {
      return errorResponse("Type de véhicule introuvable.", 404);
    }

    const updates = {};

    if (body.nom !== undefined) {
      if (typeof body.nom !== "string" || !body.nom.trim()) {
        return errorResponse("Le nom du type de véhicule est obligatoire.");
      }

      const nom = body.nom.trim();

      if (nom.length > 100) {
        return errorResponse(
          "Le nom ne doit pas dépasser 100 caractères."
        );
      }

      updates.nom = nom;
    }

    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== "string") {
        return errorResponse("La description est invalide.");
      }

      const description = (body.description || "").trim();

      if (description.length > 500) {
        return errorResponse(
          "La description ne doit pas dépasser 500 caractères."
        );
      }

      updates.description = description || null;
    }

    if (body.image_url !== undefined) {
      const image = validateImageUrl(body.image_url);

      if (!image.valid) {
        return errorResponse(
          "L’adresse de l’image doit être une URL HTTP ou HTTPS valide."
        );
      }

      updates.image_url = image.value;
    }

    if (body.actif !== undefined) {
      if (typeof body.actif !== "boolean") {
        return errorResponse("Le statut transmis est invalide.");
      }

      updates.actif = body.actif;
    }

    if (!Object.keys(updates).length) {
      return errorResponse("Aucune modification reçue.");
    }

    const { data, error } = await supabase
      .from("lavage_types_vehicule")
      .update(updates)
      .eq("id", id)
      .eq("lavage_id", station.id)
      .select(
        "id, lavage_id, nom, description, image_url, actif, created_at"
      )
      .single();

    if (error?.code === "23505") {
      return errorResponse(
        "Un type de véhicule portant ce nom existe déjà.",
        409
      );
    }

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ item: data });
  } catch {
    return errorResponse(
      "Erreur interne lors de la modification du type de véhicule.",
      500
    );
  }
}
