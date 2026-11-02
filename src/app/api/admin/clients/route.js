
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlatformAdmin } from "@/lib/admin-auth";

export async function GET(request) {
  try {
    const session = await getPlatformAdmin();

    if (!session) {
      return NextResponse.json(
        { error: "Accès non autorisé." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const recherche = (searchParams.get("q") || "").trim();
    const mode = searchParams.get("mode");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const colonnes = "id, nom, telephone, role";

    // MODE 1 : Recherche utilisée par la page Licences.
    // On conserve le comportement existant.
    if (mode !== "liste") {
      if (recherche.length < 3) {
        return NextResponse.json({ clients: [] });
      }

      const [parNom, parTelephone] = await Promise.all([
        supabaseAdmin
          .from("users")
          .select(colonnes)
          .eq("role", "admin")
          .eq("actif", true)
          .ilike("nom", `%${recherche}%`)
          .limit(10),

        supabaseAdmin
          .from("users")
          .select(colonnes)
          .eq("role", "admin")
          .eq("actif", true)
          .ilike("telephone", `%${recherche}%`)
          .limit(10),
      ]);

      if (parNom.error) throw parNom.error;
      if (parTelephone.error) throw parTelephone.error;

      const clientsMap = new Map();

      [...(parNom.data || []), ...(parTelephone.data || [])]
        .forEach((client) => {
          clientsMap.set(client.id, client);
        });

      return NextResponse.json({
        clients: Array.from(clientsMap.values()).slice(0, 10),
      });
    }

    // MODE 2 : Liste complète des clients avec pagination.
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1
    );

    const pageSize = 20;
    const debut = (page - 1) * pageSize;
    const fin = debut + pageSize - 1;

    const { data: clients, count, error: clientsError } =
      await supabaseAdmin
        .from("users")
        .select(colonnes, { count: "exact" })
        .eq("role", "admin")
        .eq("actif", true)
        .order("nom", { ascending: true })
        .range(debut, fin);

    if (clientsError) throw clientsError;

    const clientIds = (clients || []).map((client) => client.id);

    // Récupération des licences des clients affichés.
    let licences = [];

    if (clientIds.length > 0) {
      const { data, error: licencesError } = await supabaseAdmin
        .from("licenses")
        .select(`
          id,
          proprietaire_id,
          client_nom,
          client_telephone,
          modules,
          duree_jours,
          statut,
          date_creation,
          date_activation,
          date_expiration
        `)
        .in("proprietaire_id", clientIds)
        .order("date_creation", { ascending: false });

      if (licencesError) throw licencesError;

      licences = data || [];
    }

    // Association des licences à chaque client.
    const clientsAvecLicences = (clients || []).map((client) => ({
      ...client,
      licences: licences.filter(
        (licence) => licence.proprietaire_id === client.id
      ),
    }));

    return NextResponse.json({
      clients: clientsAvecLicences,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });

  } catch (error) {
    console.error("Erreur API clients :", error);

    return NextResponse.json(
      { error: "Impossible de récupérer les clients." },
      { status: 500 }
    );
  }
}
