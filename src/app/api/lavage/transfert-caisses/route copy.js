
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function reponseErreur(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function dateAbidjan(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateValide(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return false;
  }

  const valeur = new Date(`${date}T12:00:00.000Z`);

  return (
    !Number.isNaN(valeur.getTime()) &&
    valeur.toISOString().slice(0, 10) === date
  );
}

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return reponseErreur(
        "Configuration Supabase serveur incomplète.",
        500
      );
    }

    // =====================================================
    // CONNEXION SUPABASE
    // =====================================================

    const cookieStore = await cookies();

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
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
              // Cookies éventuellement en lecture seule.
            }
          },
        },
      }
    );

    // =====================================================
    // AUTHENTIFICATION
    // =====================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reponseErreur("Session expirée.", 401);
    }

    // =====================================================
    // PROFIL UTILISATEUR
    // =====================================================

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, nom, role, actif, lavage_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[TRANSFERT] Erreur profil :", profileError);

      return reponseErreur(
        "Impossible de vérifier votre profil.",
        500
      );
    }

    if (!profile || !profile.actif) {
      return reponseErreur(
        "Votre compte est introuvable ou désactivé.",
        403
      );
    }

    const role = String(profile.role || "").trim().toLowerCase();

    // =====================================================
    // IDENTIFICATION DE LA STATION
    // =====================================================

    const { searchParams } = new URL(request.url);
    const stationIdDemandee = searchParams.get("lavage_id");

    let stationQuery = supabase
      .from("lavages")
      .select("id, nom, devise, actif, owner_id")
      .eq("actif", true);

    if (role === "admin") {
      stationQuery = stationQuery.eq("owner_id", user.id);

      if (stationIdDemandee) {
        stationQuery = stationQuery.eq("id", stationIdDemandee);
      }
    } else if (role === "gerant" || role === "caissier") {
      if (!profile.lavage_id) {
        return reponseErreur(
          "Aucune station n'est associée à votre compte.",
          403
        );
      }

      if (
        stationIdDemandee &&
        stationIdDemandee !== profile.lavage_id
      ) {
        return reponseErreur(
          "Vous n'êtes pas autorisé à accéder à cette station.",
          403
        );
      }

      stationQuery = stationQuery.eq("id", profile.lavage_id);
    } else {
      return reponseErreur(
        "Votre rôle ne permet pas d'effectuer ce transfert.",
        403
      );
    }

    const { data: stations, error: stationError } =
      await stationQuery;

    if (stationError) {
      console.error("[TRANSFERT] Erreur station :", stationError);

      return reponseErreur(
        "Impossible de vérifier la station.",
        500
      );
    }

    if (!stations?.length) {
      return reponseErreur(
        "Aucune station de lavage active trouvée.",
        403
      );
    }

    if (!stationIdDemandee && stations.length > 1) {
      return reponseErreur(
        "Veuillez sélectionner une station de lavage.",
        409
      );
    }

    const station = stations[0];

    // =====================================================
    // RÉCUPÉRATION AUTOMATIQUE DE LA CAISSE PRINCIPALE
    // =====================================================

    const { data: caissePrincipale, error: erreurCaissePrincipale } =
      await supabase
        .from("lavage_caisses")
        .select("id, nom, code, solde_actuel")
        .eq("lavage_id", station.id)
        .eq("actif", true)
        .eq("code", "PRINCIPALE")
        .maybeSingle();

    if (erreurCaissePrincipale) {
      console.error(
        "[TRANSFERT] Erreur récupération caisse principale :",
        erreurCaissePrincipale
      );

      return reponseErreur(
        "Impossible de récupérer la caisse principale.",
        500
      );
    }

    if (!caissePrincipale?.id) {
      return reponseErreur(
        "Aucune caisse principale active n'a été trouvée pour cette station.",
        404
      );
    }

    // =====================================================
    // DONNÉES DU TRANSFERT
    // =====================================================

    let body;

    try {
      body = await request.json();
    } catch {
      return reponseErreur("Les données transmises sont invalides.");
    }

    const {
      caisse_destination_id,
      montant,
      motif,
      date_transfert,
    } = body || {};

    if (!uuidRegex.test(caisse_destination_id || "")) {
      return reponseErreur(
        "L'identifiant de la caisse destination est invalide."
      );
    }

    if (caissePrincipale.id === caisse_destination_id) {
      return reponseErreur(
        "La caisse principale ne peut pas être sa propre destination."
      );
    }

    const montantNumerique = Number(montant);

    if (
      !Number.isSafeInteger(montantNumerique) ||
      montantNumerique <= 0
    ) {
      return reponseErreur(
        "Le montant du transfert doit être un entier positif."
      );
    }

    if (montantNumerique > Number(caissePrincipale.solde_actuel || 0)) {
      return reponseErreur(
        "Le montant dépasse le solde disponible de la caisse principale."
      );
    }

    if (!dateValide(date_transfert)) {
      return reponseErreur(
        "La date comptable du transfert est invalide."
      );
    }

    if (date_transfert > dateAbidjan()) {
      return reponseErreur(
        "La date du transfert ne peut pas être dans le futur."
      );
    }

    // =====================================================
    // VÉRIFICATION DU DROIT DE GESTION DES CAISSES
    // =====================================================

    const { data: peutGererCaisses, error: permissionError } =
      await supabase.rpc("lavage_a_le_droit", {
        p_lavage_id: station.id,
        p_action: "caisses.gerer",
      });

    if (permissionError || peutGererCaisses !== true) {
      return reponseErreur(
        "Vous n'avez pas le droit d'effectuer un transfert entre caisses.",
        403
      );
    }

    // =====================================================
    // EXÉCUTION DU TRANSFERT SQL
    // =====================================================

    console.log("[TRANSFERT] Données validées :", {
      station_id: station.id,
      caisse_source_id: caissePrincipale.id,
      caisse_destination_id,
      montant: montantNumerique,
      date_transfert,
    });

    const { data: transfertId, error: transfertError } =
      await supabase.rpc("lavage_transferer_entre_caisses", {
        p_caisse_source_id: caissePrincipale.id,
        p_caisse_destination_id: caisse_destination_id,
        p_montant: montantNumerique,
        p_motif:
          typeof motif === "string"
            ? motif.trim() || null
            : null,
        p_date_transfert: date_transfert,
      });

    if (transfertError) {
      console.error("[TRANSFERT] Erreur RPC :", {
        message: transfertError.message,
        code: transfertError.code,
        details: transfertError.details,
        hint: transfertError.hint,
      });

      return reponseErreur(
        transfertError.message ||
          "Impossible d'effectuer le transfert.",
        400
      );
    }

    // =====================================================
    // SUCCÈS
    // =====================================================

    return NextResponse.json({
      success: true,
      transfert_id: transfertId,
      message: "Transfert effectué avec succès.",
      caisse_source: caissePrincipale.nom,
      caisse_destination_id,
    });

  } catch (error) {
    console.error("[TRANSFERT] Erreur inattendue :", error);

    return reponseErreur(
      "Une erreur inattendue est survenue lors du transfert.",
      500
    );
  }
}
