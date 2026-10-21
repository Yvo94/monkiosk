
// src/app/api/lavage/dashboard/route.js

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

function debutJour(date) {
  return `${date}T00:00:00.000Z`;
}

function montant(value) {
  const resultat = Number(value ?? 0);
  return Number.isFinite(resultat) ? resultat : 0;
}

function estPayee(statut) {
  return statut === "payee";
}

function reponseErreur(message, status, details = undefined) {
  return NextResponse.json(
    {
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export async function GET(request) {
  console.log("[LAVAGE] 1. Route appelée :", request.url);

  try {
    // -------------------------------------------------------
    // 1. Vérifier la configuration Supabase
    // -------------------------------------------------------

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[LAVAGE] Configuration Supabase manquante :", {
        urlPresente: Boolean(supabaseUrl),
        clePresente: Boolean(supabaseKey),
      });

      return reponseErreur(
        "Configuration Supabase serveur incomplète.",
        500
      );
    }

    // -------------------------------------------------------
    // 2. Créer le client associé à la session utilisateur
    // -------------------------------------------------------

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
              // Les cookies peuvent être en lecture seule.
            }
          },
        },
      }
    );

    // -------------------------------------------------------
    // 3. Vérifier l'identité de l'utilisateur
    // -------------------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[LAVAGE] Session invalide :", {
        erreur: authError?.message ?? null,
      });

      return reponseErreur("Session expirée.", 401);
    }

    console.log("[LAVAGE] Utilisateur connecté :", {
      id: user.id,
      email: user.email ?? null,
    });

    // -------------------------------------------------------
    // 4. Identifier la station autorisée
    // -------------------------------------------------------

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get("lavage_id");

    let stationQuery = supabase
      .from("lavages")
      .select("id, nom, devise, actif, owner_id")
      .eq("owner_id", user.id)
      .eq("actif", true);

    if (stationId) {
      stationQuery = stationQuery.eq("id", stationId);
    }

    const {
      data: stations,
      error: stationError,
    } = await stationQuery;

    console.log("[LAVAGE] Diagnostic station :", {
      utilisateurId: user.id,
      stationDemandee: stationId,
      nombreStations: stations?.length ?? 0,
      stations: (stations || []).map((station) => ({
        id: station.id,
        nom: station.nom,
      })),
      erreur: stationError
        ? {
            message: stationError.message,
            code: stationError.code,
            details: stationError.details,
            hint: stationError.hint,
          }
        : null,
    });

    if (stationError) {
      console.error(
        "[LAVAGE] Erreur de recherche de station :",
        stationError
      );

      return reponseErreur(
        "Impossible de vérifier l'accès à la station.",
        500,
        {
          code: stationError.code,
          message: stationError.message,
        }
      );
    }

    if (!stations?.length) {
      return reponseErreur(
        stationId
          ? "Station introuvable ou accès non autorisé."
          : "Aucune station de lavage active trouvée.",
        403,
        {
          utilisateurId: user.id,
          stationDemandee: stationId,
          nombreStations: 0,
        }
      );
    }

    // Plusieurs stations : demander à l'interface d'en sélectionner une.
    if (!stationId && stations.length > 1) {
      return NextResponse.json(
        {
          error:
            "Plusieurs stations sont disponibles. Sélectionnez une station.",
          code: "STATION_SELECTION_REQUIRED",
          stations: stations.map(({ id, nom, devise }) => ({
            id,
            nom,
            devise: devise || "FCFA",
          })),
        },
        { status: 409 }
      );
    }

    const station = stations[0];
    const devise = station.devise || "FCFA";

    // -------------------------------------------------------
    // 5. Calculer les périodes en heure d'Abidjan
    // -------------------------------------------------------

    const today = dateAbidjan();

    const tomorrowDate = new Date(`${today}T12:00:00.000Z`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = dateAbidjan(tomorrowDate);

    const startDate = new Date(`${today}T12:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    const sevenDaysAgo = dateAbidjan(startDate);

    // -------------------------------------------------------
    // 6. Charger les données du dashboard
    // -------------------------------------------------------

    const [
      servicesTodayResult,
      servicesSevenDaysResult,
      paymentsTodayResult,
      recentServicesResult,
      caisseResult,
      prestationsResult,
      laveursResult,
    ] = await Promise.all([
      // Prestations terminées aujourd'hui
      supabase
        .from("lavage_services")
        .select(`
          id,
          montant_total,
          date_service,
          commission_laveur,
          commission_statut,
          laveur_id,
          lavage_laveurs (
            id,
            nom
          )
        `)
        .eq("lavage_id", station.id)
        .eq("statut", "termine")
        .gte("date_service", debutJour(today))
        .lt("date_service", debutJour(tomorrow)),

      // Chiffre d'affaires sur sept jours
      supabase
        .from("lavage_services")
        .select("id, montant_total, date_service")
        .eq("lavage_id", station.id)
        .eq("statut", "termine")
        .gte("date_service", debutJour(sevenDaysAgo))
        .lt("date_service", debutJour(tomorrow))
        .order("date_service", { ascending: true }),

      // Encaissements du jour
      supabase
        .from("lavage_encaissements")
        .select("id, montant, date_encaissement")
        .eq("lavage_id", station.id)
        .gte("date_encaissement", debutJour(today))
        .lt("date_encaissement", debutJour(tomorrow)),

      // Cinq dernières prestations
      supabase
        .from("lavage_services")
        .select(`
          id,
          montant_total,
          date_service,
          statut,
          commission_laveur,
          commission_statut,
          lavage_vehicules (
            immatriculation,
            marque,
            modele
          ),
          lavage_laveurs (
            nom
          )
        `)
        .eq("lavage_id", station.id)
        .order("date_service", { ascending: false })
        .limit(5),

      // Caisses actives
      supabase
        .from("lavage_caisses")
        .select("id, nom, solde_actuel")
        .eq("lavage_id", station.id)
        .eq("actif", true),

      // Nombre de prestations configurées
      supabase
        .from("lavage_prestations")
        .select("id", { count: "exact", head: true })
        .eq("lavage_id", station.id)
        .eq("actif", true),

      // Nombre de laveurs actifs
      supabase
        .from("lavage_laveurs")
        .select("id", { count: "exact", head: true })
        .eq("lavage_id", station.id)
        .eq("actif", true),
    ]);

    // -------------------------------------------------------
    // 7. Vérifier toutes les requêtes
    // -------------------------------------------------------

    const results = [
      ["prestations du jour", servicesTodayResult],
      ["prestations des sept jours", servicesSevenDaysResult],
      ["encaissements du jour", paymentsTodayResult],
      ["dernières prestations", recentServicesResult],
      ["caisses", caisseResult],
      ["catalogue des prestations", prestationsResult],
      ["laveurs", laveursResult],
    ];

    const failedResult = results.find(
      ([, result]) => result.error
    );

    if (failedResult) {
      const [nomRequete, result] = failedResult;

      console.error("[LAVAGE] Erreur de requête :", {
        requete: nomRequete,
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
      });

      return reponseErreur(
        "Impossible de charger les données du dashboard.",
        500,
        {
          requete: nomRequete,
          code: result.error.code,
          message: result.error.message,
        }
      );
    }

    const servicesToday = servicesTodayResult.data || [];
    const servicesSevenDays = servicesSevenDaysResult.data || [];
    const paymentsToday = paymentsTodayResult.data || [];
    const caisses = caisseResult.data || [];

    // -------------------------------------------------------
    // 8. Calculer les statistiques journalières
    // -------------------------------------------------------

    const chiffreAffaires = servicesToday.reduce(
      (sum, service) =>
        sum + montant(service.montant_total),
      0
    );

    const encaissements = paymentsToday.reduce(
      (sum, payment) =>
        sum + montant(payment.montant),
      0
    );

    const commissionsTotales = servicesToday.reduce(
      (sum, service) =>
        sum + montant(service.commission_laveur),
      0
    );

    const commissionsPayees = servicesToday.reduce(
      (sum, service) =>
        sum +
        (estPayee(service.commission_statut)
          ? montant(service.commission_laveur)
          : 0),
      0
    );

    const commissionsAPayer = servicesToday.reduce(
      (sum, service) =>
        sum +
        (!estPayee(service.commission_statut)
          ? montant(service.commission_laveur)
          : 0),
      0
    );

    const soldeCaisses = caisses.reduce(
      (sum, caisse) =>
        sum + montant(caisse.solde_actuel),
      0
    );

    // -------------------------------------------------------
    // 9. Regrouper les commissions par laveur
    // -------------------------------------------------------

    const commissionsParLaveur = new Map();

    for (const service of servicesToday) {
      const laveurId = service.laveur_id || "sans-laveur";

      const nom =
        service.lavage_laveurs?.nom ||
        "Laveur non renseigné";

      if (!commissionsParLaveur.has(laveurId)) {
        commissionsParLaveur.set(laveurId, {
          laveur_id: service.laveur_id,
          nom,
          lavages: 0,
          commission_totale: 0,
          commission_payee: 0,
          commission_a_payer: 0,
        });
      }

      const ligne = commissionsParLaveur.get(laveurId);
      const commission = montant(service.commission_laveur);

      ligne.lavages += 1;
      ligne.commission_totale += commission;

      if (estPayee(service.commission_statut)) {
        ligne.commission_payee += commission;
      } else {
        ligne.commission_a_payer += commission;
      }
    }

    // -------------------------------------------------------
    // 10. Construire l'évolution du chiffre d'affaires
    // -------------------------------------------------------

    const evolution = Array.from(
      { length: 7 },
      (_, index) => {
        const date = new Date(`${today}T12:00:00.000Z`);

        date.setUTCDate(date.getUTCDate() - (6 - index));

        const key = dateAbidjan(date);

        const total = servicesSevenDays
          .filter(
            (service) =>
              dateAbidjan(new Date(service.date_service)) === key
          )
          .reduce(
            (sum, service) =>
              sum + montant(service.montant_total),
            0
          );

        return {
          date: key,
          montant: total,
        };
      }
    );

    // -------------------------------------------------------
    // 11. Retourner les données au dashboard
    // -------------------------------------------------------

    return NextResponse.json({
      station: {
        id: station.id,
        nom: station.nom,
        devise,
      },

      devise,

      statistiques: {
        chiffreAffaires,
        encaissements,

        prestationsTerminees: servicesToday.length,

        panierMoyen:
          servicesToday.length > 0
            ? chiffreAffaires / servicesToday.length
            : 0,

        commissionsTotales,
        commissionsPayees,
        commissionsAPayer,

        resultatApresCommissions:
          chiffreAffaires - commissionsTotales,

        soldeCaisses,
        caissesActives: caisses.length,

        prestationsConfigurees:
          prestationsResult.count || 0,

        laveursActifs:
          laveursResult.count || 0,
      },

      commissionsParLaveur:
        Array.from(commissionsParLaveur.values()),

      evolution,

      derniersServices:
        recentServicesResult.data || [],

      dateStatistiques: today,
    });
  } catch (error) {
    console.error("[LAVAGE] Erreur inattendue du dashboard :", {
      message: error?.message ?? String(error),
      code: error?.code ?? null,
      details: error?.details ?? null,
      hint: error?.hint ?? null,
    });

    return reponseErreur(
      "Impossible de charger les statistiques de la station.",
      500
    );
  }
}