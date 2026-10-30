
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const JOURS_HISTORIQUE = 360;
const JOURS_PREVISION = 30;
const JOURS_PREVISION_COURT = 7;
const JOURS_MATURITE = 30;
const JOURS_ANALYSE_DEPENSES = 90;
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
  return Math.round(Number(valeur) || 0);
}

function calculerMaturite(joursDisponibles) {
  let baseReferenceJours;

  if (joursDisponibles < 30) {
    baseReferenceJours = 30;
  } else if (joursDisponibles < 90) {
    baseReferenceJours = 90;
  } else if (joursDisponibles < 180) {
    baseReferenceJours = 180;
  } else {
    baseReferenceJours = 360;
  }

  const progression = Math.min(
    100,
    Math.round((joursDisponibles / baseReferenceJours) * 100)
  );

  return {
    joursDisponibles,
    baseReferenceJours,
    joursRequis: baseReferenceJours,
    progression,
    seuilAtteint: progression >= 100,

    niveau:
      progression >= 100
        ? "excellent"
        : progression >= 70
          ? "bon"
          : progression >= 30
            ? "moyen"
            : "faible",

    libelle:
      progression >= 100
        ? "Historique complet"
        : progression >= 70
          ? "Bonne maturité"
          : progression >= 30
            ? "Maturité en progression"
            : "Historique insuffisant",
  };
}

function jourSemaine(date) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function montantNumerique(valeur) {
  const montant = Number(valeur);
  return Number.isFinite(montant) ? Math.max(0, montant) : 0;
}

async function chargerToutesLesLignes(creerRequete) {
  let lignes = [];
  let debut = 0;

  while (true) {
    const fin = debut + TAILLE_PAGE - 1;
    const { data, error } = await creerRequete().range(debut, fin);

    if (error) throw error;

    lignes = lignes.concat(data || []);

    if (!data || data.length < TAILLE_PAGE) break;

    debut += TAILLE_PAGE;
  }

  return lignes;
}

function calculerPrevisionsCA(historique, datesHistoriques, aujourdHui) {
  const valeurs = datesHistoriques.map((date) =>
    montantNumerique(historique[date]?.chiffreAffaires)
  );

  const joursActifs = valeurs.filter((montant) => montant > 0).length;
  const moyenneHistorique = moyenne(valeurs);

  const derniers28 = valeurs.slice(-28);
  const precedents28 = valeurs.slice(-56, -28);

  const moyenneRecente = moyenne(derniers28);
  const moyennePrecedente = moyenne(precedents28);

  const actifsRecents = derniers28.filter((v) => v > 0).length;
  const actifsPrecedents = precedents28.filter((v) => v > 0).length;

  let facteurTendance = 1;

  const tendanceFiable =
    derniers28.length === 28 &&
    precedents28.length === 28 &&
    actifsRecents >= 8 &&
    actifsPrecedents >= 8 &&
    moyennePrecedente > 0;

  if (tendanceFiable) {
    facteurTendance = Math.max(
      0.85,
      Math.min(1.15, moyenneRecente / moyennePrecedente)
    );
  }

  const previsions = [];

  for (let i = 1; i <= JOURS_PREVISION; i++) {
    const date = ajouterJours(aujourdHui, i);
    const jour = jourSemaine(date);

    const valeursMemeJour = datesHistoriques
      .filter((dateHistorique) => jourSemaine(dateHistorique) === jour)
      .slice(-12)
      .map((dateHistorique) =>
        montantNumerique(historique[dateHistorique]?.chiffreAffaires)
      );

    const joursAvecActivite = valeursMemeJour.filter((v) => v > 0).length;

    let basePrevision = 0;

    if (valeursMemeJour.length >= 4) {
      basePrevision =
        mediane(valeursMemeJour) * 0.4 +
        moyennePonderee(valeursMemeJour) * 0.6;
    } else if (valeursMemeJour.length > 0) {
      basePrevision = moyennePonderee(valeursMemeJour);
    } else {
      basePrevision = moyenneRecente || moyenneHistorique;
    }

    const montantPrevu = arrondir(
      Math.max(0, basePrevision * facteurTendance)
    );

    previsions.push({
      date,
      jourSemaine: jour,
      montantPrevu,
      historiqueMemeJour: arrondir(moyenne(valeursMemeJour)),
      occurrencesHistoriques: valeursMemeJour.length,
      joursAvecActivite,
      risqueJourCreux:
        valeursMemeJour.length >= 4 &&
        joursAvecActivite / valeursMemeJour.length < 0.5,
    });
  }

  let fiabilite = "faible";

  if (datesHistoriques.length >= 120 && joursActifs >= 45) {
    fiabilite = "bonne";
  } else if (datesHistoriques.length >= 60 && joursActifs >= 20) {
    fiabilite = "moyenne";
  }

  const totalPrevu30Jours = previsions.reduce(
    (total, jour) => total + jour.montantPrevu,
    0
  );

  const totalPrevu7Jours = previsions
    .slice(0, JOURS_PREVISION_COURT)
    .reduce((total, jour) => total + jour.montantPrevu, 0);

  return {
    previsions,
    totalPrevu: totalPrevu30Jours,
    totalPrevu7Jours,
    totalPrevu30Jours,
    moyenneQuotidienneHistorique: arrondir(moyenneHistorique),
    joursHistorique: datesHistoriques.length,
    joursAvecActivite: joursActifs,
    facteurTendance: Number(facteurTendance.toFixed(2)),
    fiabilite,
  };
}

function calculerPrevisionsDepenses(depenses, datesAnalyse, datesPrevisions) {
  const nombreJours = Math.max(1, datesAnalyse.length);
  const totauxParCategorie = {};
  let totalDepenses = 0;

  for (const depense of depenses) {
    const montant = montantNumerique(depense.montant);
    const categorie = depense.categorie || "Non catégorisée";

    totalDepenses += montant;
    totauxParCategorie[categorie] =
      (totauxParCategorie[categorie] || 0) + montant;
  }

  const depenseMoyenneQuotidienne = totalDepenses / nombreJours;

  const categories = Object.entries(totauxParCategorie)
    .map(([categorie, totalHistorique]) => ({
      categorie,
      totalHistorique: arrondir(totalHistorique),
      moyenneQuotidienne: arrondir(totalHistorique / nombreJours),
      montantPrevu7Jours: arrondir(
        (totalHistorique / nombreJours) * JOURS_PREVISION_COURT
      ),
      montantPrevu30Jours: arrondir(
        (totalHistorique / nombreJours) * JOURS_PREVISION
      ),
    }))
    .sort((a, b) => b.montantPrevu30Jours - a.montantPrevu30Jours);

  const montantPrevu7Jours = arrondir(
    depenseMoyenneQuotidienne * JOURS_PREVISION_COURT
  );

  const montantPrevu30Jours = arrondir(
    depenseMoyenneQuotidienne * JOURS_PREVISION
  );

  const previsionsParJour = datesPrevisions.map((date) => ({
    date,
    montantPrevu: arrondir(depenseMoyenneQuotidienne),
    methode: "Moyenne quotidienne des dépenses payées sur la période analysée",
  }));

  return {
    totalHistorique: arrondir(totalDepenses),
    moyenneQuotidienne: arrondir(depenseMoyenneQuotidienne),
    montantPrevu7Jours,
    montantPrevu30Jours,
    categories,
    previsionsParJour,
    nombreDepenses: depenses.length,
    periodeAnalyseJours: nombreJours,
    avertissement:
      "Estimation statistique basée sur les dépenses payées. Elle ne prédit pas les dates exactes d'achat, les ruptures de stock ni les maintenances.",
  };
}



function normaliserTexte(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Identifie la famille réelle d'une dépense à partir de sa catégorie
// et de son libellé, même si la catégorie enregistrée est "Autre".
function determinerFamilleDepense(depense) {
  const categorie = normaliserTexte(depense.categorie);
  const libelle = normaliserTexte(depense.libelle);
  const texte = `${categorie} ${libelle}`;

  if (/salubrite|hygiene|nettoyage|assainissement/.test(texte)) {
    return {
      categorie: "Salubrité",
      nature: "Frais de salubrité et d'entretien",
    };
  }

  if (/electricite|courant|rechargement/.test(texte)) {
    return {
      categorie: "Électricité",
      nature: "Facture ou consommation électrique",
    };
  }

  if (/eau|sene/.test(texte)) {
    return {
      categorie: "Eau",
      nature: "Approvisionnement ou facture d'eau",
    };
  }

  if (
    /savon|shampoing|shampooing|detergent|degraissant|produit de lavage|produits de lavage/.test(
      texte
    )
  ) {
    return {
      categorie: "Produits de lavage",
      nature: "Détergents, savons, shampoings et dégraissants",
    };
  }

  if (/chiffon|eponge|brosse|gant|consommable|accessoire/.test(texte)) {
    return {
      categorie: "Consommables",
      nature: "Chiffons, éponges et accessoires",
    };
  }

  if (
    /maintenance|entretien|reparation|reparations|panne|piece detachee/.test(
      texte
    )
  ) {
    return {
      categorie: "Maintenance",
      nature: "Entretien et réparation des équipements",
    };
  }

  if (/installation|amenagement|equipement|travaux/.test(texte)) {
    return {
      categorie: "Installations",
      nature: "Petites réparations et entretien des installations",
    };
  }

  return {
    categorie: depense.categorie || "Non catégorisée",
    nature: depense.libelle || depense.categorie || "Autre dépense",
  };
}


function estUnRechargementElectricite(depense) {
  const texte =
    `${normaliserTexte(depense.categorie)} ` +
    `${normaliserTexte(depense.libelle)}`;

  return (
    /electricite|courant|compteur/.test(texte) &&
    /rechargement|recharge|credit|unite/.test(texte)
  );
}

function calculerPrevisionRechargementElectricite(
  depenses,
  services,
  aujourdHui
) {
  // Ne conserver que les dépenses correspondant réellement
  // à un rechargement électrique.
  const depensesElectricite = depenses.filter(
    estUnRechargementElectricite
  );

  // Regrouper les rechargements effectués le même jour.
  const rechargesParDate = new Map();

  for (const depense of depensesElectricite) {
    const date = new Date(depense.date_depense)
      .toISOString()
      .slice(0, 10);

    const existante = rechargesParDate.get(date);

    if (existante) {
      existante.montant += montantNumerique(depense.montant);

      if (
        new Date(depense.date_depense) >
        new Date(existante.dateHeure)
      ) {
        existante.dateHeure = depense.date_depense;
      }
    } else {
      rechargesParDate.set(date, {
        date,
        dateHeure: depense.date_depense,
        montant: montantNumerique(depense.montant),
      });
    }
  }

  const recharges = [...rechargesParDate.values()].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  if (recharges.length < 2) {
    return {
      disponible: false,
      datePrevue: null,
      montantMoyenRecharge: arrondir(
        moyenne(recharges.map((r) => r.montant))
      ),
      nombreRechargementsObserves: recharges.length,
      nombreIntervallesAnalyses: 0,
      confiance: "insuffisante",
      explication:
        "Il faut au moins deux rechargements enregistrés pour commencer à mesurer le nombre d'opérations entre les rechargements.",
    };
  }

  const intervalles = [];

  // Mesurer les opérations réalisées entre chaque paire
  // de rechargements successifs.
  for (let i = 1; i < recharges.length; i++) {
    const precedent = recharges[i - 1];
    const suivant = recharges[i];

    const debut = new Date(precedent.dateHeure).getTime();
    const fin = new Date(suivant.dateHeure).getTime();

    const dureeJours = (fin - debut) / 86400000;

    if (!Number.isFinite(dureeJours) || dureeJours <= 0) {
      continue;
    }

    const nombreOperations = services.filter((service) => {
      const dateService = new Date(service.date_service).getTime();

      return dateService > debut && dateService <= fin;
    }).length;

    intervalles.push({
      dateDebut: precedent.date,
      dateFin: suivant.date,
      dureeJours,
      nombreOperations,
      montantRecharge: suivant.montant,
      operationsParJour: nombreOperations / dureeJours,
    });
  }

  if (!intervalles.length) {
    return {
      disponible: false,
      datePrevue: null,
      montantMoyenRecharge: arrondir(
        moyenne(recharges.map((r) => r.montant))
      ),
      nombreRechargementsObserves: recharges.length,
      nombreIntervallesAnalyses: 0,
      confiance: "insuffisante",
      explication:
        "Les dates des rechargements ne permettent pas encore de calculer des intervalles exploitables.",
    };
  }

  // Le nombre habituel d'opérations avant un nouveau
  // rechargement est estimé avec la médiane historique.
  const operationsParIntervalle = intervalles
    .map((intervalle) => intervalle.nombreOperations)
    .filter((nombre) => nombre > 0);

  if (!operationsParIntervalle.length) {
    return {
      disponible: false,
      datePrevue: null,
      montantMoyenRecharge: arrondir(
        moyenne(recharges.map((r) => r.montant))
      ),
      nombreRechargementsObserves: recharges.length,
      nombreIntervallesAnalyses: intervalles.length,
      confiance: "insuffisante",
      explication:
        "Aucune opération terminée n'a été retrouvée entre les rechargements observés.",
    };
  }

  const objectifOperations = mediane(operationsParIntervalle);

  const dernierRechargement = recharges[recharges.length - 1];
  const dernierRechargementTimestamp = new Date(
    dernierRechargement.dateHeure
  ).getTime();

  // Nombre d'opérations réalisées depuis le dernier rechargement.
  const operationsDepuisDernierRechargement = services.filter(
    (service) =>
      new Date(service.date_service).getTime() >
      dernierRechargementTimestamp
  ).length;

  // Rythme d'activité des 14 derniers jours.
  const debutActivite = ajouterJours(aujourdHui, -13);

  const operationsRecentes = services.filter((service) => {
    const date = new Date(service.date_service)
      .toISOString()
      .slice(0, 10);

    return date >= debutActivite && date <= aujourdHui;
  }).length;

  let operationsParJour = operationsRecentes / 14;

  // Si l'activité récente est nulle, utiliser le rythme
  // moyen observé entre les rechargements historiques.
  if (operationsParJour <= 0) {
    operationsParJour = moyenne(
      intervalles
        .filter((intervalle) => intervalle.operationsParJour > 0)
        .map((intervalle) => intervalle.operationsParJour)
    );
  }

  if (operationsParJour <= 0) {
    return {
      disponible: false,
      datePrevue: null,
      montantMoyenRecharge: arrondir(
        moyenne(recharges.map((r) => r.montant))
      ),
      nombreRechargementsObserves: recharges.length,
      nombreIntervallesAnalyses: intervalles.length,
      objectifOperations: arrondir(objectifOperations),
      operationsDepuisDernierRechargement,
      confiance: "insuffisante",
      explication:
        "Le rythme récent de la station ne permet pas encore d'estimer une date de prochain rechargement.",
    };
  }

  const operationsRestantes = Math.max(
    0,
    objectifOperations - operationsDepuisDernierRechargement
  );

  const joursRestants =
    operationsRestantes === 0
      ? 0
      : Math.ceil(operationsRestantes / operationsParJour);

  const datePrevue = ajouterJours(aujourdHui, joursRestants);

  // Évaluer la régularité du nombre d'opérations entre rechargements.
  const ecartType = Math.sqrt(
    moyenne(
      operationsParIntervalle.map((nombre) =>
        Math.pow(nombre - objectifOperations, 2)
      )
    )
  );

  const coefficientVariation =
    objectifOperations > 0
      ? ecartType / objectifOperations
      : 1;

  let confiance = "faible";

  if (
    intervalles.length >= 3 &&
    coefficientVariation <= 0.25
  ) {
    confiance = "bonne";
  } else if (
    intervalles.length >= 2 &&
    coefficientVariation <= 0.5
  ) {
    confiance = "moyenne";
  }

  return {
    disponible: true,
    datePrevue,
    montantMoyenRecharge: arrondir(
      moyenne(recharges.map((r) => r.montant))
    ),
    dernierRechargement: dernierRechargement.date,
    dernierMontantRecharge: arrondir(dernierRechargement.montant),

    nombreRechargementsObserves: recharges.length,
    nombreIntervallesAnalyses: intervalles.length,

    objectifOperations: arrondir(objectifOperations),
    operationsDepuisDernierRechargement,
    operationsRestantesEstimees: arrondir(operationsRestantes),

    rythmeRecentOperationsParJour: Number(
      operationsParJour.toFixed(2)
    ),

    joursRestantsEstimes: joursRestants,

    confiance,

    methode:
      "Médiane du nombre d'opérations terminées entre les rechargements, ajustée selon le rythme des 14 derniers jours.",

    avertissement:
      "La date est indicative. Elle suppose que chaque dépense enregistrée correspond à un événement de rechargement comparable.",
  };
}


function calculerRecommandationsDepenses(depenses, aujourdHui) {
  const groupes = new Map();

  for (const depense of depenses) {
    const famille = determinerFamilleDepense(depense);

    // Regroupement par famille pour reconnaître les libellés différents
    // qui correspondent à une même nature de dépense.
    const cle = normaliserTexte(famille.categorie);

    if (!groupes.has(cle)) {
      groupes.set(cle, {
        categorie: famille.categorie,
        libelle: famille.nature,
        occurrences: new Map(),
      });
    }

    const date = new Date(depense.date_depense)
      .toISOString()
      .slice(0, 10);

    const groupe = groupes.get(cle);

    // Plusieurs dépenses de la même famille le même jour
    // sont cumulées en une seule occurrence.
    groupe.occurrences.set(
      date,
      (groupe.occurrences.get(date) || 0) +
        montantNumerique(depense.montant)
    );
  }

  const recommandationsHistoriques = [];
  const dateLimite = ajouterJours(aujourdHui, 30);

  for (const groupe of groupes.values()) {
    const occurrences = [...groupe.occurrences.entries()]
      .map(([date, montant]) => ({ date, montant }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (occurrences.length < 3) continue;

    const intervalles = [];

    for (let i = 1; i < occurrences.length; i++) {
      const precedent = new Date(`${occurrences[i - 1].date}T12:00:00Z`);
      const suivant = new Date(`${occurrences[i].date}T12:00:00Z`);

      const jours = Math.round(
        (suivant - precedent) / 86400000
      );

      if (jours > 0) intervalles.push(jours);
    }

    if (intervalles.length < 2) continue;

    const intervalleMoyen = moyenne(intervalles);

    const ecartType = Math.sqrt(
      moyenne(
        intervalles.map((intervalle) =>
          Math.pow(intervalle - intervalleMoyen, 2)
        )
      )
    );

    const coefficientVariation =
      intervalleMoyen > 0 ? ecartType / intervalleMoyen : 1;

    if (
      intervalleMoyen < 3 ||
      intervalleMoyen > 60 ||
      coefficientVariation > 0.35
    ) {
      continue;
    }

    const derniereOccurrence = occurrences[occurrences.length - 1];
    const intervallePrevu = Math.max(1, Math.round(intervalleMoyen));

    const prochaineDate = ajouterJours(
      derniereOccurrence.date,
      intervallePrevu
    );

    if (
      prochaineDate > dateLimite ||
      prochaineDate <= aujourdHui
    ) {
      continue;
    }

    const montantMoyen = moyenne(
      occurrences.map((occurrence) => occurrence.montant)
    );

    // Calcul exact du nombre d'échéances qui tombent
    // réellement dans les 30 prochains jours.
    let occurrencesPrevues30Jours = 0;
    let dateOccurrence = prochaineDate;

    while (dateOccurrence <= dateLimite) {
      occurrencesPrevues30Jours++;

      dateOccurrence = ajouterJours(
        dateOccurrence,
        intervallePrevu
      );
    }

    const confiance =
      occurrences.length >= 4 && coefficientVariation <= 0.2
        ? "elevee"
        : "moyenne";

    recommandationsHistoriques.push({
      datePrevue: prochaineDate,
      nature: groupe.libelle,
      categorie: groupe.categorie,
      montantEstime: arrondir(montantMoyen),
      montantEstime30Jours: arrondir(
        montantMoyen * occurrencesPrevues30Jours
      ),
      occurrencesPrevues30Jours,
      origine: "historique",
      confiance,
      intervalleMoyenJours: intervallePrevu,
      nombreOccurrencesObservees: occurrences.length,
      explication:
        `Cette famille de dépenses a été observée ${occurrences.length} fois, ` +
        `avec un intervalle moyen d'environ ${intervallePrevu} jours.`,
    });
  }

  return recommandationsHistoriques.sort(
    (a, b) => a.datePrevue.localeCompare(b.datePrevue)
  );
}

function genererSuggestionsDepenses(depenses, recommandationsHistoriques) {
  const categoriesHabituelles = [
    {
      categorie: "Produits de lavage",
      nature: "Détergents, savons, shampoings et dégraissants",
    },
    {
      categorie: "Consommables",
      nature: "Chiffons, éponges et accessoires",
    },
    {
      categorie: "Eau",
      nature: "Approvisionnement ou facture d'eau",
    },
    {
      categorie: "Électricité",
      nature: "Facture ou consommation électrique",
    },
    {
      categorie: "Maintenance",
      nature: "Entretien et réparation des équipements",
    },
    {
      categorie: "Salubrité",
      nature: "Frais de salubrité et d'entretien",
    },
    {
      categorie: "Installations",
      nature: "Petites réparations et entretien des installations",
    },
  ];

  const categoriesDejaConnues = new Set(
    depenses.map((depense) =>
      normaliserTexte(determinerFamilleDepense(depense).categorie)
    )
  );

  const categoriesDejaRecommandees = new Set(
    recommandationsHistoriques.map((recommandation) =>
      normaliserTexte(recommandation.categorie)
    )
  );

  return categoriesHabituelles
    .filter((suggestion) => {
      const categorie = normaliserTexte(suggestion.categorie);

      return (
        !categoriesDejaConnues.has(categorie) &&
        !categoriesDejaRecommandees.has(categorie)
      );
    })
    .map((suggestion) => ({
      datePrevue: null,
      nature: suggestion.nature,
      categorie: suggestion.categorie,
      montantEstime: null,
      montantEstime30Jours: null,
      occurrencesPrevues30Jours: null,
      origine: "suggestion",
      confiance: "faible",
      explication:
        "Dépense indicative courante pour une station de lavage. " +
        "Aucun historique suffisant ne permet d'estimer sa date ou son montant. " +
        "Cette suggestion ne constitue pas une obligation de dépense.",
    }));
}

function construirePrevisionsDetailleesDepenses(depenses, aujourdHui) {
  const historiques = calculerRecommandationsDepenses(
    depenses,
    aujourdHui
  );

  const suggestions = genererSuggestionsDepenses(
    depenses,
    historiques
  );

  const recommandations = [...historiques, ...suggestions];

  const montantEstime30Jours = historiques.reduce(
    (total, item) => total + item.montantEstime30Jours,
    0
  );

  return {
    recommandations,

    budget30Jours: {
      montantEstime: arrondir(montantEstime30Jours),
      nombreDepensesEstimees: historiques.length,
      nombreDepensesNonEstimees: suggestions.length,
      montantNonEstime: null,
      explication:
        "Le budget estimé additionne les occurrences récurrentes " +
        "détectées dont la prochaine échéance intervient dans les 30 jours. " +
        "Les suggestions sans historique fiable ne sont pas chiffrées.",
    },

    nombreRecommandationsHistoriques: historiques.length,
    nombreSuggestions: suggestions.length,
  };
}


function genererRecommandations({
  caHistorique,
  caPrevu,
  commissionsHistoriques,
  depensesHistoriques,
  maturite,
  previsionsCA,
  previsionsDepenses,
}) {
  const recommandations = [];

  if (maturite.progression < 100) {
    recommandations.push({
      type: "donnees",
      priorite: "information",
      titre: "Consolider l'historique",
      message: `L'historique exploitable couvre ${maturite.joursDisponibles} jour(s) sur les ${maturite.baseReferenceJours} jours de référence.`,
      action:
        "Enregistrer régulièrement les opérations et les dépenses pour améliorer les estimations.",
    });
  }

  if (caHistorique > 0) {
    const ratioCommissions = commissionsHistoriques / caHistorique;

    if (ratioCommissions > 0.25) {
      recommandations.push({
        type: "commissions",
        priorite: "a_verifier",
        titre: "Vérifier le poids des commissions",
        message: `Les commissions représentent environ ${Math.round(
          ratioCommissions * 100
        )}% du chiffre d'affaires historique de la période.`,
        action:
          "Examiner les tarifs, les commissions par type de véhicule et la répartition des prestations avant de modifier les règles de rémunération.",
      });
    }

    const ratioDepenses = depensesHistoriques / caHistorique;

    if (ratioDepenses > 0.2) {
      recommandations.push({
        type: "depenses",
        priorite: "a_verifier",
        titre: "Analyser les dépenses",
        message: `Les dépenses payées représentent environ ${Math.round(
          ratioDepenses * 100
        )}% du chiffre d'affaires sur la période commune analysée.`,
        action:
          "Examiner les catégories les plus coûteuses et vérifier les achats exceptionnels avant de conclure à une hausse anormale.",
      });
    }
  }

  const joursCreux = previsionsCA.filter((jour) => jour.risqueJourCreux);

  if (joursCreux.length) {
    recommandations.push({
      type: "activite",
      priorite: "opportunite",
      titre: "Préparer les journées historiquement calmes",
      message: `${joursCreux.length} jour(s) prévu(s) présentent une activité historiquement faible par rapport aux observations disponibles.`,
      action:
        "Tester une action commerciale ciblée ou organiser les présences en fonction de la fréquentation attendue, sans réduire automatiquement les effectifs.",
      dates: joursCreux.map((jour) => jour.date),
    });
  }

  if (
    caHistorique > 0 &&
    caPrevu <
      caHistorique *
        (JOURS_PREVISION_COURT / Math.max(1, maturite.joursDisponibles)) *
        0.8
  ) {
    recommandations.push({
      type: "chiffre_affaires",
      priorite: "a_verifier",
      titre: "Surveiller le chiffre d'affaires prévisionnel",
      message:
        "Le niveau prévisionnel mérite une vérification au regard de l'activité historique.",
      action:
        "Contrôler les jours de fermeture, les données de services enregistrées et les changements récents de tarifs ou de fréquentation.",
    });
  }

  if (
    previsionsDepenses.montantPrevu7Jours === 0 &&
    depensesHistoriques === 0
  ) {
    recommandations.push({
      type: "depenses",
      priorite: "information",
      titre: "Historique de dépenses insuffisant",
      message:
        "Aucune dépense payée n'a été trouvée sur la période analysée.",
      action:
        "Vérifier que les dépenses de la station sont bien enregistrées et marquées comme payées. Une prévision nulle ne signifie pas qu'aucun achat ne sera nécessaire.",
    });
  }

  if (!recommandations.length) {
    recommandations.push({
      type: "suivi",
      priorite: "information",
      titre: "Poursuivre le suivi",
      message:
        "Aucune anomalie simple n'a été détectée avec les indicateurs disponibles.",
      action:
        "Continuer à enregistrer les services et les dépenses afin de suivre l'évolution de la rentabilité.",
    });
  }

  return recommandations;
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
              // Les cookies peuvent être en lecture seule.
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

    if (!stationId) {
      return NextResponse.json(
        { error: "L'identifiant de la station est requis." },
        { status: 400 }
      );
    }

    const { data: station, error: stationError } = await supabase
      .from("lavages")
      .select("id, nom, devise")
      .eq("id", stationId)
      .eq("owner_id", user.id)
      .eq("actif", true)
      .maybeSingle();

    if (stationError) {
      console.error("Erreur chargement station :", stationError);

      return NextResponse.json(
        { error: "Impossible de charger la station." },
        { status: 500 }
      );
    }

    if (!station) {
      return NextResponse.json(
        { error: "Station active introuvable ou inaccessible." },
        { status: 404 }
      );
    }

    const aujourdHui = dateAbidjan();
    const hier = ajouterJours(aujourdHui, -1);
    const debutFenetre = ajouterJours(aujourdHui, -JOURS_HISTORIQUE);

    const debutISO = `${debutFenetre}T00:00:00.000Z`;
    const finISO = `${aujourdHui}T00:00:00.000Z`;
    const finServicesISO =
      `${ajouterJours(aujourdHui, 1)}T00:00:00.000Z`;

    const services = await chargerToutesLesLignes(() =>
      supabase
        .from("lavage_services")
        .select("date_service, montant_total, commission_laveur")
        .eq("lavage_id", station.id)
        .eq("statut", "termine")
        .gte("date_service", debutISO)
        .lt("date_service", finServicesISO)
        .order("date_service", { ascending: true })
    );

    const depensesElectriciteHistoriques =
        await chargerToutesLesLignes(() =>
            supabase
            .from("lavage_depenses")
            .select("date_depense, libelle, categorie, montant, statut")
            .eq("lavage_id", station.id)
            .eq("statut", "payee")
            .gte("date_depense", debutISO)
            .lt("date_depense", finServicesISO)
            .order("date_depense", { ascending: true })
        );

    const datesServices = services
      .map((service) =>
        new Date(service.date_service).toISOString().slice(0, 10)
      )
      .filter((date) => date <= hier)
      .sort();

    const premiereDateService = datesServices[0] || null;

    const debutHistorique = premiereDateService
      ? premiereDateService
      : ajouterJours(hier, -29);

    const datesHistoriques = creerSerieDates(debutHistorique, hier);

    const historique = Object.fromEntries(
      datesHistoriques.map((date) => [
        date,
        {
          chiffreAffaires: 0,
          commissions: 0,
          nombreServices: 0,
        },
      ])
    );

    for (const service of services) {
      const date = new Date(service.date_service).toISOString().slice(0, 10);

      if (!historique[date]) continue;

      historique[date].chiffreAffaires += montantNumerique(
        service.montant_total
      );

      historique[date].commissions += montantNumerique(
        service.commission_laveur
      );

      historique[date].nombreServices += 1;
    }

    const debutAnalyseDepenses = ajouterJours(
      hier,
      -(JOURS_ANALYSE_DEPENSES - 1)
    );

    const { data: depenses, error: depensesError } = await supabase
      .from("lavage_depenses")
      .select("date_depense, libelle, categorie, montant, statut")
      .eq("lavage_id", station.id)
      .eq("statut", "payee")
      .gte("date_depense", `${debutAnalyseDepenses}T00:00:00.000Z`)
      .lt("date_depense", finISO)
      .order("date_depense", { ascending: true });

    if (depensesError) {
      console.error("Erreur chargement dépenses :", depensesError);

      return NextResponse.json(
        {
          error:
            "Impossible de charger les dépenses. Vérifie la structure de la table lavage_depenses.",
        },
        { status: 500 }
      );
    }

    const datesAnalyseDepenses = creerSerieDates(debutAnalyseDepenses, hier);
    const depensesPayees = depenses || [];
    const previsionRechargementElectricite =
        calculerPrevisionRechargementElectricite(
            depensesElectriciteHistoriques,
            services,
            aujourdHui
        );

    const totauxDepensesParDate = Object.fromEntries(
      datesHistoriques.map((date) => [date, 0])
    );

    for (const depense of depensesPayees) {
      const date = new Date(depense.date_depense).toISOString().slice(0, 10);

      if (Object.prototype.hasOwnProperty.call(totauxDepensesParDate, date)) {
        totauxDepensesParDate[date] += montantNumerique(depense.montant);
      }
    }

    const datesPrevisions = Array.from(
      { length: JOURS_PREVISION },
      (_, index) => ajouterJours(aujourdHui, index + 1)
    );

    const resultatCA = calculerPrevisionsCA(
      historique,
      datesHistoriques,
      aujourdHui
    );

    const resultatDepenses = calculerPrevisionsDepenses(
        depensesPayees,
        datesAnalyseDepenses,
        datesPrevisions
        );

        const recommandationsDetailleesDepenses =
        construirePrevisionsDetailleesDepenses(
            depensesPayees,
            aujourdHui
        );

    const totalCAHistorique = datesHistoriques.reduce(
      (total, date) =>
        total + montantNumerique(historique[date]?.chiffreAffaires),
      0
    );

    const totalCommissionsHistoriques = datesHistoriques.reduce(
      (total, date) =>
        total + montantNumerique(historique[date]?.commissions),
      0
    );

    const totalDepensesHistoriques = datesHistoriques.reduce(
      (total, date) =>
        total + montantNumerique(totauxDepensesParDate[date]),
      0
    );

    const commissionsMoyennesParJour =
      datesHistoriques.length > 0
        ? totalCommissionsHistoriques / datesHistoriques.length
        : 0;

    const commissionsPrevues7Jours = arrondir(
      commissionsMoyennesParJour * JOURS_PREVISION_COURT
    );

    const commissionsPrevues30Jours = arrondir(
      commissionsMoyennesParJour * JOURS_PREVISION
    );

    const resultatEstime7Jours =
      resultatCA.totalPrevu7Jours -
      commissionsPrevues7Jours -
      resultatDepenses.montantPrevu7Jours;

    const resultatEstime30Jours =
      resultatCA.totalPrevu30Jours -
      commissionsPrevues30Jours -
      resultatDepenses.montantPrevu30Jours;

    const joursDisponibles = datesHistoriques.length;

    const maturite = {
    ...calculerMaturite(joursDisponibles),
    datePremiereOperation: premiereDateService,
    joursAvecActivite: resultatCA.joursAvecActivite,
    avertissement:
        "La progression indique la durée couverte depuis la première opération retrouvée, pas une mesure de précision. Les journées à zéro peuvent correspondre à une fermeture ou à une absence d'enregistrement.",
    };

    const recommandations = genererRecommandations({
      caHistorique: totalCAHistorique,
      caPrevu: resultatCA.totalPrevu7Jours,
      commissionsHistoriques: totalCommissionsHistoriques,
      depensesHistoriques: totalDepensesHistoriques,
      maturite,
      previsionsCA: resultatCA.previsions.slice(0, JOURS_PREVISION_COURT),
      previsionsDepenses: resultatDepenses,
    });

    return NextResponse.json({
      station: {
        id: station.id,
        nom: station.nom,
        devise: station.devise || "FCFA",
      },

      dateCalcul: aujourdHui,

      maturite,

      historique: {
        debut: datesHistoriques[0] || debutHistorique,
        fin: hier,
        jours: datesHistoriques.length,
        joursAvecActivite: resultatCA.joursAvecActivite,
        chiffreAffaires: arrondir(totalCAHistorique),
        commissions: arrondir(totalCommissionsHistoriques),
        depensesPayees: arrondir(totalDepensesHistoriques),
        resultatApresCommissionsEtDepenses: arrondir(
          totalCAHistorique -
            totalCommissionsHistoriques -
            totalDepensesHistoriques
        ),
        donneesParJour: datesHistoriques.map((date) => ({
          date,
          ...historique[date],
          depensesPayees: arrondir(totauxDepensesParDate[date]),
        })),
      },

      previsions: {
        chiffreAffaires: {
          jours: resultatCA.previsions,
          total7Jours: resultatCA.totalPrevu7Jours,
          total15Jours: arrondir(
            resultatCA.previsions
              .slice(0, 15)
              .reduce((total, jour) => total + jour.montantPrevu, 0)
          ),
          total30Jours: resultatCA.totalPrevu30Jours,
          totalPrevu: resultatCA.totalPrevu30Jours,
          moyenneQuotidienneHistorique:
            resultatCA.moyenneQuotidienneHistorique,
          joursHistorique: resultatCA.joursHistorique,
          joursAvecActivite: resultatCA.joursAvecActivite,
          facteurTendance: resultatCA.facteurTendance,
          fiabilite: resultatCA.fiabilite,
          methode:
            "Médiane et moyenne pondérée par jour de la semaine, ajustées par la tendance récente.",
        },

        depenses: {
        ...resultatDepenses,

        rechargementElectricite:
            previsionRechargementElectricite,

        recommandations:
            recommandationsDetailleesDepenses.recommandations,

        budget30Jours:
            recommandationsDetailleesDepenses.budget30Jours,

        nombreRecommandationsHistoriques:
            recommandationsDetailleesDepenses.nombreRecommandationsHistoriques,

        nombreSuggestions:
            recommandationsDetailleesDepenses.nombreSuggestions,
        },

        commissions: {
          moyenneQuotidienne: arrondir(commissionsMoyennesParJour),
          totalPrevu7Jours: commissionsPrevues7Jours,
          totalPrevu30Jours: commissionsPrevues30Jours,
          methode:
            "Estimation provisoire basée sur les commissions historiques moyennes par jour.",
        },

        resultatEstime7Jours: arrondir(resultatEstime7Jours),
        resultatEstime30Jours: arrondir(resultatEstime30Jours),
      },

      recommandations,

      limites: [
        "Le résultat estimé n'est pas un bénéfice comptable : il ne couvre que le chiffre d'affaires, les commissions enregistrées et les dépenses payées retrouvées.",
        "Les dépenses futures sont estimées par moyenne quotidienne et ne prédisent pas les dates d'achat.",
        "Les prévisions ne peuvent pas encore détecter les ruptures de stock ni programmer une maintenance sans données dédiées.",
        "Les journées sans service enregistré sont traitées comme des journées à zéro activité ; les fermetures ne sont pas distinguées des données manquantes.",
        "Les estimations sont provisoires lorsque l'historique est court ou peu actif.",
        "Le prochain rechargement électrique est estimé à partir du nombre d'opérations réalisées entre les rechargements historiques et du rythme récent de la station.",
        "La prévision suppose que les rechargements enregistrés sont comparables. Les recharges partielles, les variations de consommation des équipements et les changements de tarifs peuvent modifier la date réelle.",
      ],
    });
  } catch (error) {
    console.error("Erreur API prévisions rentabilité :", error);

    return NextResponse.json(
      {
        error:
          "Une erreur inattendue est survenue lors du calcul des prévisions de rentabilité.",
      },
      { status: 500 }
    );
  }
}
