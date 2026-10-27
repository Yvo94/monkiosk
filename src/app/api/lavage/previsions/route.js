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

  return (
    valeurs.reduce((total, valeur) => total + valeur, 0) /
    valeurs.length
  );
}


function mediane(valeurs) {
  if (!valeurs.length) return 0;

  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);

  return triees.length % 2 === 0
    ? (triees[milieu - 1] + triees[milieu]) / 2
    : triees[milieu];
}

function moyennePonderee(valeurs) {
  if (!valeurs.length) return 0;

  // Les observations les plus récentes ont plus de poids.
  let totalPondere = 0;
  let totalPoids = 0;

  valeurs.forEach((valeur, index) => {
    const poids = index + 1;
    totalPondere += valeur * poids;
    totalPoids += poids;
  });

  return totalPoids ? totalPondere / totalPoids : 0;
}


function arrondir(valeur) {
  return Math.round(valeur);
}


function calculerPrevisions(historique, aujourdHui) {
  const dates = Object.keys(historique).sort();
  const valeurs = dates.map((date) =>
    Math.max(0, Number(historique[date]) || 0)
  );

  const joursActifs = valeurs.filter(
    (montant) => montant > 0
  ).length;

  const nombreJours = valeurs.length;

  // Tendance sur 28 jours complets comparés aux 28 jours précédents.
  const derniers28 = valeurs.slice(-28);
  const precedents28 = valeurs.slice(-56, -28);

  const moyenneRecente = moyenne(derniers28);
  const moyennePrecedente = moyenne(precedents28);

  const joursActifsRecents = derniers28.filter(
    (montant) => montant > 0
  ).length;

  const joursActifsPrecedents = precedents28.filter(
    (montant) => montant > 0
  ).length;

  let facteurTendance = 1;

  const tendanceFiable =
    derniers28.length === 28 &&
    precedents28.length === 28 &&
    joursActifsRecents >= 8 &&
    joursActifsPrecedents >= 8 &&
    moyennePrecedente > 0;

  if (tendanceFiable) {
    const ratio = moyenneRecente / moyennePrecedente;

    facteurTendance = Math.max(
      0.85,
      Math.min(1.15, ratio)
    );
  }

  const previsions = [];

  for (let i = 1; i <= JOURS_PREVISION; i++) {
    const date = ajouterJours(aujourdHui, i);

    const jourSemaine = new Date(
      `${date}T12:00:00.000Z`
    ).getUTCDay();

    // Les dernières occurrences du même jour de semaine.
    const valeursMemeJour = dates
      .filter((dateHistorique) => {
        const jourHistorique = new Date(
          `${dateHistorique}T12:00:00.000Z`
        ).getUTCDay();

        return jourHistorique === jourSemaine;
      })
      .slice(-12)
      .map((dateHistorique) =>
        Math.max(
          0,
          Number(historique[dateHistorique]) || 0
        )
      );

    const moyennePondereeJour =
      moyennePonderee(valeursMemeJour);

    const medianeJour = mediane(valeursMemeJour);

    let basePrevision;

    if (valeursMemeJour.length >= 4) {
      // La médiane limite l'effet des journées exceptionnelles.
      // La moyenne pondérée prend davantage en compte la période récente.
      basePrevision =
        medianeJour * 0.4 +
        moyennePondereeJour * 0.6;
    } else if (valeursMemeJour.length > 0) {
      basePrevision =
        moyennePondereeJour;
    } else {
      basePrevision = moyenneRecente;
    }

    const montantPrevu = Math.max(
      0,
      arrondir(basePrevision * facteurTendance)
    );

    previsions.push({
      date,
      jourSemaine,
      montantPrevu,
      historiqueMemeJour: arrondir(
        moyenne(valeursMemeJour)
      ),
    });
  }

  // Indicateur provisoire basé sur la quantité de données.
  // Il ne représente pas encore une précision mesurée par backtesting.
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
    moyenneQuotidienneHistorique: arrondir(
      moyenne(valeurs)
    ),
    joursHistorique: nombreJours,
    joursAvecActivite: joursActifs,
    facteurTendance: Number(
      facteurTendance.toFixed(2)
    ),
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
          error:
            "Sélectionne une station pour afficher ses prévisions.",
          code: "STATION_SELECTION_REQUIRED",
          stations,
        },
        { status: 409 }
      );
    }

    const station = stations[0];
    const aujourdHui = dateAbidjan();
    const hier = ajouterJours(aujourdHui, -1);

    const debutRecherche = ajouterJours(
      aujourdHui,
      -(JOURS_HISTORIQUE - 1)
    );

    const debutISO = `${debutRecherche}T00:00:00.000Z`;

    // La journée en cours est exclue de l'historique.
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
          {
            error:
              "Impossible de charger l'historique du chiffre d'affaires.",
          },
          { status: 500 }
        );
      }

      services = services.concat(data || []);

      if (!data || data.length < TAILLE_PAGE) {
        break;
      }

      debutPage += TAILLE_PAGE;
    }

    // Première date connue parmi les opérations récupérées.
    const datesServices = services
      .map((service) =>
        new Date(service.date_service).toISOString().slice(0, 10)
      )
      .filter((date) => date <= hier)
      .sort();

    // S'il n'existe aucune opération, on conserve une fenêtre
    // de 30 jours pour éviter une série historique vide.
    const debutEffectif = datesServices.length
      ? datesServices[0]
      : ajouterJours(hier, -29);

    const datesHistorique = creerSerieDates(
      debutEffectif,
      hier
    );

    const historique = Object.fromEntries(
      datesHistorique.map((date) => [date, 0])
    );

    for (const service of services) {
      const date = new Date(service.date_service)
        .toISOString()
        .slice(0, 10);

      if (
        Object.prototype.hasOwnProperty.call(historique, date)
      ) {
        historique[date] += Number(
          service.montant_total || 0
        );
      }
    }

    const resultat = calculerPrevisions(
      historique,
      aujourdHui
    );

    return NextResponse.json({
      station: {
        id: station.id,
        nom: station.nom,
        devise: station.devise || "FCFA",
      },
      dateCalcul: aujourdHui,
      periodeHistorique: {
        debut: datesHistorique[0] || debutEffectif,
        fin: hier,
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
      methode:
        "Moyenne par jour de la semaine et tendance récente",
    });
  } catch (error) {
    console.error(
      "Erreur API prévisions lavage:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Une erreur inattendue est survenue lors du calcul des prévisions.",
      },
      { status: 500 }
    );
  }
}