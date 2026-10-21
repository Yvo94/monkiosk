
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getContext(request) {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Configuration Supabase manquante.");
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
          // Les cookies peuvent être en lecture seule selon le contexte.
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Session expirée. Reconnecte-toi." },
        { status: 401 }
      ),
    };
  }

  const { data: stations, error: stationError } = await supabase
    .from("lavages")
    .select("id, nom, devise")
    .eq("owner_id", user.id)
    .eq("actif", true);

  if (stationError) {
    console.error("[LAVEURS] Lecture stations :", stationError);
    return {
      error: NextResponse.json(
        { error: "Impossible de récupérer la station de lavage." },
        { status: 500 }
      ),
    };
  }

  if (!stations?.length) {
    return {
      error: NextResponse.json(
        { error: "Aucune station de lavage active accessible." },
        { status: 403 }
      ),
    };
  }

  const stationId = new URL(request.url).searchParams.get("lavage_id");

  let station;

  if (stationId) {
    station = stations.find((item) => item.id === stationId);

    if (!station) {
      return {
        error: NextResponse.json(
          { error: "Station non autorisée ou inactive." },
          { status: 403 }
        ),
      };
    }
  } else if (stations.length === 1) {
    station = stations[0];
  } else {
    return {
      error: NextResponse.json(
        {
          error: "Plusieurs stations disponibles. Sélectionne une station.",
          code: "STATION_SELECTION_REQUIRED",
          stations,
        },
        { status: 409 }
      ),
    };
  }

  return { supabase, user, station };
}

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function validatePayload(body) {
  const nom = typeof body.nom === "string" ? body.nom.trim() : "";
  const telephone =
    typeof body.telephone === "string" ? body.telephone.trim() : "";

  if (!nom || nom.length > 120) {
    return { error: "Le nom est obligatoire (120 caractères maximum)." };
  }

  if (telephone.length > 30) {
    return { error: "Le numéro de téléphone est trop long." };
  }

  return { nom, telephone: telephone || null };
}

export async function GET(request) {
  try {
    const context = await getContext(request);
    if (context.error) return context.error;

    const { supabase, station } = context;

    const { data, error } = await supabase
      .from("lavage_laveurs")
      .select("id, lavage_id, nom, telephone, actif, created_at")
      .eq("lavage_id", station.id)
      .order("nom", { ascending: true });

    if (error) {
      console.error("[LAVEURS] GET :", error);
      return jsonError("Impossible de charger les laveurs.", 500);
    }

    return NextResponse.json({
      station,
      laveurs: data || [],
    });
  } catch (error) {
    console.error("[LAVEURS] GET inattendu :", error);
    return jsonError("Erreur interne lors du chargement des laveurs.", 500);
  }
}

export async function POST(request) {
  try {
    const context = await getContext(request);
    if (context.error) return context.error;

    const { supabase, station } = context;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonError("Données invalides.");
    }

    const validated = validatePayload(body);
    if (validated.error) return jsonError(validated.error);

    const { data, error } = await supabase
      .from("lavage_laveurs")
      .insert({
        lavage_id: station.id,
        nom: validated.nom,
        telephone: validated.telephone,
        actif: true,
      })
      .select("id, lavage_id, nom, telephone, actif, created_at")
      .single();

    if (error) {
      console.error("[LAVEURS] POST :", error);
      return jsonError("Impossible d'enregistrer ce laveur.", 500);
    }

    return NextResponse.json(
      { message: "Laveur ajouté avec succès.", laveur: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("[LAVEURS] POST inattendu :", error);
    return jsonError("Erreur interne lors de l'ajout du laveur.", 500);
  }
}

export async function PATCH(request) {
  try {
    const context = await getContext(request);
    if (context.error) return context.error;

    const { supabase, station } = context;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || !body.id) {
      return jsonError("Identifiant du laveur manquant.");
    }

    const updates = {};

    if (Object.hasOwn(body, "nom") || Object.hasOwn(body, "telephone")) {
      const validated = validatePayload(body);
      if (validated.error) return jsonError(validated.error);

      updates.nom = validated.nom;
      updates.telephone = validated.telephone;
    }

    if (Object.hasOwn(body, "actif")) {
      if (typeof body.actif !== "boolean") {
        return jsonError("Le statut du laveur est invalide.");
      }

      updates.actif = body.actif;
    }

    if (!Object.keys(updates).length) {
      return jsonError("Aucune modification à enregistrer.");
    }

    const { data, error } = await supabase
      .from("lavage_laveurs")
      .update(updates)
      .eq("id", body.id)
      .eq("lavage_id", station.id)
      .select("id, lavage_id, nom, telephone, actif, created_at")
      .maybeSingle();

    if (error) {
      console.error("[LAVEURS] PATCH :", error);
      return jsonError("Impossible de modifier ce laveur.", 500);
    }

    if (!data) {
      return jsonError("Laveur introuvable ou accès non autorisé.", 404);
    }

    return NextResponse.json({
      message: "Laveur modifié avec succès.",
      laveur: data,
    });
  } catch (error) {
    console.error("[LAVEURS] PATCH inattendu :", error);
    return jsonError("Erreur interne lors de la modification.", 500);
  }
}
