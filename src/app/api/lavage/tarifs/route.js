
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

function responseError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getUserAndStation(supabase, request) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: responseError("Session expirée. Connecte-toi.", 401) };
  }

  const url = new URL(request.url);
  const lavageId = url.searchParams.get("lavage_id");

  let query = supabase
    .from("lavages")
    .select("id, nom, devise")
    .eq("owner_id", user.id)
    .eq("actif", true);

  if (lavageId) query = query.eq("id", lavageId);

  const { data: stations, error } = await query.order("created_at");

  if (error) {
    return { error: responseError(error.message, 500) };
  }

  if (!stations?.length) {
    return {
      error: responseError(
        "Aucune station de lavage active accessible.",
        404
      ),
    };
  }

  if (!lavageId && stations.length > 1) {
    return {
      error: responseError(
        "Plusieurs stations sont disponibles. Précise le lavage_id.",
        409
      ),
    };
  }

  return { user, station: stations[0] };
}

async function validateReferences(
  supabase,
  lavageId,
  typeVehiculeId,
  prestationId
) {
  const [{ data: vehicule, error: vehiculeError }, { data: prestation, error: prestationError }] =
    await Promise.all([
      supabase
        .from("lavage_types_vehicule")
        .select("id, nom")
        .eq("id", typeVehiculeId)
        .eq("lavage_id", lavageId)
        .eq("actif", true)
        .maybeSingle(),
      supabase
        .from("lavage_prestations")
        .select("id, nom")
        .eq("id", prestationId)
        .eq("lavage_id", lavageId)
        .eq("actif", true)
        .maybeSingle(),
    ]);

  if (vehiculeError || prestationError) {
    return { error: "Impossible de vérifier les références du tarif." };
  }

  if (!vehicule) return { error: "Sélectionne un type de véhicule actif." };
  if (!prestation) return { error: "Sélectionne un type de lavage actif." };

  return { vehicule, prestation };
}

export async function GET(request) {
  try {
    const supabase = await getSupabase();
    const result = await getUserAndStation(supabase, request);
    if (result.error) return result.error;

    const { station } = result;

    const [
      { data: tarifs, error: tarifsError },
      { data: vehicules, error: vehiculesError },
      { data: prestations, error: prestationsError },
    ] = await Promise.all([
      supabase
        .from("lavage_tarifs")
        .select("*")
        .eq("lavage_id", station.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("lavage_types_vehicule")
        .select("id, nom")
        .eq("lavage_id", station.id)
        .eq("actif", true)
        .order("nom"),
      supabase
        .from("lavage_prestations")
        .select("id, nom")
        .eq("lavage_id", station.id)
        .eq("actif", true)
        .order("nom"),
    ]);

    const error = tarifsError || vehiculesError || prestationsError;
    if (error) return responseError(error.message, 500);

    const vehiculesMap = new Map((vehicules || []).map((v) => [v.id, v.nom]));
    const prestationsMap = new Map(
      (prestations || []).map((p) => [p.id, p.nom])
    );

    const items = (tarifs || []).map((tarif) => ({
      ...tarif,
      type_vehicule_nom: vehiculesMap.get(tarif.type_vehicule_id) || "Type indisponible",
      prestation_nom: prestationsMap.get(tarif.prestation_id) || "Type indisponible",
    }));

    return NextResponse.json({
      lavage: station,
      items,
      vehicules: vehicules || [],
      prestations: prestations || [],
    });
  } catch {
    return responseError("Erreur interne lors du chargement des tarifs.", 500);
  }
}

export async function POST(request) {
  try {
    const supabase = await getSupabase();
    const result = await getUserAndStation(supabase, request);
    if (result.error) return result.error;

    const { station } = result;
    const body = await request.json();

    const typeVehiculeId = body.type_vehicule_id;
    const prestationId = body.prestation_id;
    const prix = Number(body.prix);
    const commission = Number(body.commission_laveur ?? 0);

    if (!typeVehiculeId || !prestationId) {
      return responseError("Le type de véhicule et le type de lavage sont obligatoires.");
    }

    if (!Number.isFinite(prix) || prix < 0) {
      return responseError("Le prix doit être un nombre positif ou nul.");
    }

    if (!Number.isFinite(commission) || commission < 0) {
      return responseError("La commission doit être un nombre positif ou nul.");
    }

    const references = await validateReferences(
      supabase,
      station.id,
      typeVehiculeId,
      prestationId
    );

    if (references.error) return responseError(references.error);

    const { data, error } = await supabase
      .from("lavage_tarifs")
      .insert({
        lavage_id: station.id,
        type_vehicule_id: typeVehiculeId,
        prestation_id: prestationId,
        prix,
        commission_laveur: commission,
        actif: true,
      })
      .select("*")
      .single();

    if (error?.code === "23505") {
      return responseError(
        "Un tarif existe déjà pour ce type de véhicule et ce type de lavage.",
        409
      );
    }

    if (error) return responseError(error.message, 500);

    return NextResponse.json({ item: data }, { status: 201 });
  } catch {
    return responseError("Erreur interne lors de la création du tarif.", 500);
  }
}

export async function PATCH(request) {
  try {
    const supabase = await getSupabase();
    const result = await getUserAndStation(supabase, request);
    if (result.error) return result.error;

    const { station } = result;
    const body = await request.json();
    const { id } = body;

    if (!id) return responseError("Identifiant du tarif manquant.");

    const { data: existing, error: existingError } = await supabase
      .from("lavage_tarifs")
      .select("*")
      .eq("id", id)
      .eq("lavage_id", station.id)
      .maybeSingle();

    if (existingError) return responseError(existingError.message, 500);
    if (!existing) return responseError("Tarif introuvable.", 404);

    const updates = {};

    if (body.actif !== undefined) {
      if (typeof body.actif !== "boolean") {
        return responseError("Le statut du tarif est invalide.");
      }
      updates.actif = body.actif;
    }

    if (body.prix !== undefined) {
      const prix = Number(body.prix);
      if (!Number.isFinite(prix) || prix < 0) {
        return responseError("Le prix doit être un nombre positif ou nul.");
      }
      updates.prix = prix;
    }

    if (body.commission_laveur !== undefined) {
      const commission = Number(body.commission_laveur);
      if (!Number.isFinite(commission) || commission < 0) {
        return responseError("La commission doit être un nombre positif ou nul.");
      }
      updates.commission_laveur = commission;
    }

    const typeVehiculeId = body.type_vehicule_id ?? existing.type_vehicule_id;
    const prestationId = body.prestation_id ?? existing.prestation_id;

    if (
      body.type_vehicule_id !== undefined ||
      body.prestation_id !== undefined
    ) {
      const references = await validateReferences(
        supabase,
        station.id,
        typeVehiculeId,
        prestationId
      );

      if (references.error) return responseError(references.error);

      updates.type_vehicule_id = typeVehiculeId;
      updates.prestation_id = prestationId;
    }

    if (!Object.keys(updates).length) {
      return responseError("Aucune modification reçue.");
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("lavage_tarifs")
      .update(updates)
      .eq("id", id)
      .eq("lavage_id", station.id)
      .select("*")
      .single();

    if (error?.code === "23505") {
      return responseError("Cette combinaison de véhicule et de lavage existe déjà.", 409);
    }

    if (error) return responseError(error.message, 500);

    return NextResponse.json({ item: data });
  } catch {
    return responseError("Erreur interne lors de la modification du tarif.", 500);
  }
}
