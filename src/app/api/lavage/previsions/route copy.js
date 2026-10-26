
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";


const JOURS_HISTORIQUE = 180;
const JOURS_PREVISION = 7;
const TAILLE_PAGE = 1000;

function dateAbidjan() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ajouterJours(date, nombre) {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + nombre);
  return d.toISOString().slice(0, 10);
}

function creerSerieDates(debut, finInclus) {
  const dates = [];
  let date = debut;

  while (date <= finInclus) {
    dates.push(date);
    date = ajouterJours(date, 1);
  }

  return dates;
}

function moyenne(valeurs) {
  if (!valeurs.length) return 0;
  return valeurs.reduce((total, valeur) => total + valeur, 0) /
    valeurs.length;
}

function arrondir(valeur) {
  return Math.round(valeur);
}

function calculerPrevisions(historique) {
  const dates = Object.keys(historique).sort();
  const valeurs = dates.map((date) => historique[date]);

  const joursActifs = valeurs.filter((montant) => montant > 0).length;
  const nombreJours = valeurs.length;

  const derniers7 = valeurs.slice(-7);
  const precedents7 = valeurs.slice(-14, -7);

  const derniers28 = valeurs.slice(-28);
  const precedents28 = valeurs.slice(-56, -28);

  const moyenneRecente = moyenne(derniers28);
  const moyennePrecedente = moyenne(precedents28);

  let facteurTendance = 1;

  if (moyennePrecedente > 0) {
    facteurTendance = moyenneRecente / moyennePrecedente;
    facteurTendance = Math.max(
      0.75,
      Math.min(1.25, facteurTendance)
    );
  }

  const previsions = [];

  for (let i = 1; i <= JOURS_PREVISION; i++) {
    const date = ajouterJours(dates[dates.length - 1], i);
    const jourSemaine = new Date(
      `${date}T12:00:00.000Z`
    ).getUTCDay();

    const valeursMemeJour = dates
      .filter((dateHistorique) => {
        return new Date(
          `${dateHistorique}T12:00:00.000Z`
        ).getUTCDay() === jourSemaine;
      })
      .slice(-8)
      .map((dateHistorique) => historique[dateHistorique]);

    const moyenneJourSemaine = moyenne(valeursMemeJour);

    let montantPrevu = 0;

    if (valeursMemeJour.length > 0) {
      // Le profil du jour de la semaine pèse davantage
      // que la moyenne quotidienne générale.
      montantPrevu =
        (moyenneJourSemaine * 0.7 +
          moyenneRecente * 0.3) *
        facteurTendance;
    } else {
      montantPrevu = moyenneRecente * facteurTendance;
    }

    montantPrevu = Math.max(0, arrondir(montantPrevu));

    previsions.push({
      date,
      jourSemaine,
      montantPrevu,
      historiqueMemeJour: arrondir(moyenneJourSemaine),
    });
  }

  let fiabilite = "faible";

  if (nombreJours >= 120 && joursActifs >= 45) {
    fiabilite = "bonne";
  } else if (nombreJours >= 60 && joursActifs >= 20) {
    fiabilite = "moyenne";
  }

  return {
    previsions,
    totalPrevu: previsions.reduce(
      (total, jour) => total + jour.montantPrevu,
      0
    ),
    moyenneQuotidienneHistorique: arrondir(moyenne(valeurs)),
    joursHistorique: nombreJours,
    joursAvecActivite: joursActifs,
    facteurTendance: Number(facteurTendance.toFixed(2)),
    fiabilite,
  };
}

export async function GET(request) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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
              // Les cookies peuvent être en lecture seule
              // dans certains contextes Next.js.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get("lavage_id");

    let stationsQuery = supabase
      .from("lavages")
      .select("id, nom, devise")
      .eq("owner_id", user.id)
      .eq("actif", true);

    if (stationId) {
      stationsQuery = stationsQuery.eq("id", stationId);
    }

    const { data: stations, error: stationsError } =
      await stationsQuery;

    if (stationsError) {
      console.error(
        "Erreur chargement stations pour prévisions:",
        stationsError
      );

      return NextResponse.json(
        { error: "Impossible de charger la station." },
        { status: 500 }
      );
    }

    if (!stations?.length) {
      return NextResponse.json(
        { error: "Aucune station active accessible." },
        { status: 404 }
      );
    }

    if (!stationId && stations.length > 1) {
      return NextResponse.json(
        {
          error: "Sélectionne une station pour afficher ses prévisions.",
          code: "STATION_SELECTION_REQUIRED",
          stations,
        },
        { status: 409 }
      );
    }

    const station = stations[0];
    const aujourdHui = dateAbidjan();
    const debutHistorique = ajouterJours(
      aujourdHui,
      -(JOURS_HISTORIQUE - 1)
    );

    const debutISO = `${debutHistorique}T00:00:00.000Z`;

    // On exclut aujourd'hui : la journée n'est pas encore terminée.
    const finISO = `${aujourdHui}T00:00:00.000Z`;

    let services = [];
    let debutPage = 0;

    while (true) {
      const finPage = debutPage + TAILLE_PAGE - 1;

      const { data, error } = await supabase
        .from("lavage_services")
        .select("date_service, montant_total")
        .eq("lavage_id", station.id)
        .eq("statut", "termine")
        .gte("date_service", debutISO)
        .lt("date_service", finISO)
        .order("date_service", { ascending: true })
        .range(debutPage, finPage);

      if (error) {
        console.error(
          "Erreur chargement historique des prévisions:",
          error
        );

        return NextResponse.json(
          { error: "Impossible de charger l'historique du chiffre d'affaires." },
          { status: 500 }
        );
      }

      services = services.concat(data || []);

      if (!data || data.length < TAILLE_PAGE) {
        break;
      }

      debutPage += TAILLE_PAGE;
    }

    // On ne commence pas avant la première opération connue.
    // Les jours sans activité sont ensuite conservés à zéro.
    const hier = ajouterJours(aujourdHui, -1);

    const datesServices = services
    .map((service) => new Date(service.date_service).toISOString().slice(0, 10))
    .filter((date) => date <= hier)
    .sort();

    const debutEffectif = datesServices.length
    ? datesServices[0]
    : ajouterJours(hier, -29);

    const datesHistorique = creerSerieDates(debutEffectif, hier);

    const historique = Object.fromEntries(
    datesHistorique.map((date) => [date, 0])
    );

    for (const service of services) {
    const date = new Date(service.date_service)
        .toISOString()
        .slice(0, 10);

    // Ne jamais inclure la journée en cours.
    if (Object.prototype.hasOwnProperty.call(historique, date)) {
        historique[date] += Number(service.montant_total || 0);
    }
    }

    const resultat = calculerPrevisions(historique);

    return NextResponse.json({
      station: {
        id: station.id,
        nom: station.nom,
        devise: station.devise || "FCFA",
      },
      dateCalcul: aujourdHui,
      periodeHistorique: {
        debut: debutHistorique,
        fin: aujourdHui,
      },
      historique: datesHistorique.map((date) => ({
        date,
        chiffreAffaires: arrondir(historique[date]),
      })),
      previsions: resultat.previsions,
      statistiques: {
        totalPrevu7Jours: resultat.totalPrevu,
        moyenneQuotidienneHistorique:
          resultat.moyenneQuotidienneHistorique,
        joursHistorique: resultat.joursHistorique,
        joursAvecActivite: resultat.joursAvecActivite,
        facteurTendance: resultat.facteurTendance,
        fiabilite: resultat.fiabilite,
      },
      methode: "Moyenne par jour de la semaine et tendance récente",
    });
  } catch (error) {
    console.error("Erreur API prévisions lavage:", error);

    return NextResponse.json(
      { error: "Une erreur inattendue est survenue lors du calcul des prévisions." },
      { status: 500 }
    );
  }
}
