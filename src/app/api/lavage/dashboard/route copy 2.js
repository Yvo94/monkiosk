
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

  const get = (type) => parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function debutJour(date) {
  return `${date}T00:00:00.000Z`;
}

function lendemain(date) {
  const valeur = new Date(`${date}T12:00:00.000Z`);
  valeur.setUTCDate(valeur.getUTCDate() + 1);
  return valeur.toISOString().slice(0, 10);
}

function decalageJour(date, nombre) {
  const valeur = new Date(`${date}T12:00:00.000Z`);
  valeur.setUTCDate(valeur.getUTCDate() + nombre);
  return valeur.toISOString().slice(0, 10);
}

function dateValide(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return false;

  const valeur = new Date(`${date}T12:00:00.000Z`);

  return (
    !Number.isNaN(valeur.getTime()) &&
    valeur.toISOString().slice(0, 10) === date
  );
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

    const cookieStore = await cookies();

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
            // Les cookies peuvent être en lecture seule.
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reponseErreur("Session expirée.", 401);
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get("lavage_id");

    const today = dateAbidjan();

    // Sans paramètres : statistiques du jour.
    const dateDebut = searchParams.get("date_debut") || today;
    const dateFin = searchParams.get("date_fin") || today;

    if (!dateValide(dateDebut) || !dateValide(dateFin)) {
      return reponseErreur("Les dates sélectionnées sont invalides.", 400);
    }

    if (dateDebut > dateFin) {
      return reponseErreur(
        "La date de début doit être antérieure ou égale à la date de fin.",
        400
      );
    }

    if (dateFin > today) {
      return reponseErreur(
        "La date de fin ne peut pas être dans le futur.",
        400
      );
    }

    // La borne de fin est exclusive pour inclure toute la journée choisie.
    const borneDebut = debutJour(dateDebut);
    const borneFin = debutJour(lendemain(dateFin));

    let stationQuery = supabase
      .from("lavages")
      .select("id, nom, devise, actif, owner_id")
      .eq("owner_id", user.id)
      .eq("actif", true);

    if (stationId) {
      stationQuery = stationQuery.eq("id", stationId);
    }

    const { data: stations, error: stationError } = await stationQuery;

    if (stationError) {
      console.error("[LAVAGE] Erreur de recherche de station :", stationError);
      return reponseErreur(
        "Impossible de vérifier l'accès à la station.",
        500
      );
    }

    if (!stations?.length) {
      return reponseErreur(
        stationId
          ? "Station introuvable ou accès non autorisé."
          : "Aucune station de lavage active trouvée.",
        403
      );
    }

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

    // Graphique : les 7 jours se terminant à la date de fin sélectionnée.
    const debutEvolution = decalageJour(dateFin, -6);

    const [
      servicesPeriodeResult,
      servicesEvolutionResult,
      encaissementsPeriodeResult,
      recentServicesResult,
      caisseResult,
      prestationsResult,
      laveursResult,
      depensesPeriodeResult,
    ] = await Promise.all([
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
        .gte("date_service", borneDebut)
        .lt("date_service", borneFin),

      supabase
        .from("lavage_services")
        .select("id, montant_total, date_service")
        .eq("lavage_id", station.id)
        .eq("statut", "termine")
        .gte("date_service", debutJour(debutEvolution))
        .lt("date_service", debutJour(lendemain(dateFin)))
        .order("date_service", { ascending: true }),

      supabase
        .from("lavage_encaissements")
        .select("id, montant, date_encaissement")
        .eq("lavage_id", station.id)
        .gte("date_encaissement", borneDebut)
        .lt("date_encaissement", borneFin),

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
        .gte("date_service", borneDebut)
        .lt("date_service", borneFin)
        .order("date_service", { ascending: false })
        .limit(5),

      // Les soldes des caisses sont des soldes actuels.
      supabase
        .from("lavage_caisses")
        .select("id, nom, code, solde_actuel")
        .eq("lavage_id", station.id)
        .eq("actif", true),

      supabase
        .from("lavage_prestations")
        .select("id", { count: "exact", head: true })
        .eq("lavage_id", station.id)
        .eq("actif", true),

      supabase
        .from("lavage_laveurs")
        .select("id", { count: "exact", head: true })
        .eq("lavage_id", station.id)
        .eq("actif", true),

      supabase
        .from("lavage_depenses")
        .select(`
          id,
          libelle,
          categorie,
          montant,
          date_depense,
          mode_paiement,
          statut,
          notes
        `)
        .eq("lavage_id", station.id)
        .gte("date_depense", borneDebut)
        .lt("date_depense", borneFin)
        .order("date_depense", { ascending: false }),
    ]);

    const resultats = [
      ["prestations de la période", servicesPeriodeResult],
      ["évolution du chiffre d'affaires", servicesEvolutionResult],
      ["encaissements de la période", encaissementsPeriodeResult],
      ["dernières prestations", recentServicesResult],
      ["caisses", caisseResult],
      ["catalogue des prestations", prestationsResult],
      ["laveurs", laveursResult],
      ["dépenses de la période", depensesPeriodeResult],
    ];

    const echec = resultats.find(([, resultat]) => resultat.error);

    if (echec) {
      const [nomRequete, resultat] = echec;

      console.error("[LAVAGE] Erreur de requête :", {
        requete: nomRequete,
        message: resultat.error.message,
        code: resultat.error.code,
        details: resultat.error.details,
        hint: resultat.error.hint,
      });

      return reponseErreur(
        "Impossible de charger les données du dashboard.",
        500,
        {
          requete: nomRequete,
          code: resultat.error.code,
          message: resultat.error.message,
        }
      );
    }

    const services = servicesPeriodeResult.data || [];
    const encaissementsListe = encaissementsPeriodeResult.data || [];
    const caisses = caisseResult.data || [];
    const depenses = depensesPeriodeResult.data || [];
    const servicesEvolution = servicesEvolutionResult.data || [];

    const depensesPayees = depenses.filter(
      (depense) => depense.statut === "payee"
    );

    const totalDepensesPayees = depensesPayees.reduce(
      (total, depense) => total + montant(depense.montant),
      0
    );

    const chiffreAffaires = services.reduce(
      (total, service) => total + montant(service.montant_total),
      0
    );

    const encaissements = encaissementsListe.reduce(
      (total, paiement) => total + montant(paiement.montant),
      0
    );

    const commissionsTotales = services.reduce(
      (total, service) => total + montant(service.commission_laveur),
      0
    );

    const commissionsPayees = services.reduce(
      (total, service) =>
        total +
        (estPayee(service.commission_statut)
          ? montant(service.commission_laveur)
          : 0),
      0
    );

    const commissionsAPayer = services.reduce(
      (total, service) =>
        total +
        (!estPayee(service.commission_statut)
          ? montant(service.commission_laveur)
          : 0),
      0
    );

    const soldeCaisses = caisses.reduce(
      (total, caisse) => total + montant(caisse.solde_actuel),
      0
    );

    const caissePrincipale = caisses.find(
      (caisse) =>
        String(caisse.code || "").trim().toUpperCase() === "PRINCIPALE"
    );

    const soldeCaissePrincipale = montant(
      caissePrincipale?.solde_actuel
    );

    const resultatApresCommissions =
      chiffreAffaires - commissionsTotales;

    const beneficeNet =
      resultatApresCommissions - totalDepensesPayees;

    const commissionsParLaveur = new Map();

    for (const service of services) {
      const laveurId = service.laveur_id || "sans-laveur";
      const nom =
        service.lavage_laveurs?.nom || "Laveur non renseigné";

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

    const evolution = Array.from({ length: 7 }, (_, index) => {
      const date = decalageJour(debutEvolution, index);

      const total = servicesEvolution
        .filter(
          (service) =>
            dateAbidjan(new Date(service.date_service)) === date
        )
        .reduce(
          (somme, service) => somme + montant(service.montant_total),
          0
        );

      return { date, montant: total };
    });

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
        prestationsTerminees: services.length,

        panierMoyen:
          services.length > 0 ? chiffreAffaires / services.length : 0,

        commissionsTotales,
        commissionsPayees,
        commissionsAPayer,
        resultatApresCommissions,
        totalDepensesPayees,
        nombreDepenses: depenses.length,
        beneficeNet,

        soldeCaisses,
        soldeCaissePrincipale,
        caissesActives: caisses.length,
        prestationsConfigurees: prestationsResult.count || 0,
        laveursActifs: laveursResult.count || 0,
      },

      commissionsParLaveur: Array.from(commissionsParLaveur.values()),
      evolution,
      derniersServices: recentServicesResult.data || [],
      depensesDuJour: depenses,
      dateStatistiques: today,
      periode: {
        dateDebut,
        dateFin,
      },
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
