
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CarFront,
  ClipboardList,
  CreditCard,
  Settings,
  Users,
  ArrowRight,
  Droplets,
  Wallet,
  TrendingUp,
  Receipt,
  Banknote,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  LoaderCircle,
  X,
  CheckCircle2,
} from "lucide-react";

import NouvelleOperationModal from "@/components/lavage/NouvelleOperationModal";

const rubriques = [
  {
    titre: "Prestations",
    description: "Enregistrer et consulter les opérations de lavage.",
    href: "/dashboard/lavage/services",
    icone: ClipboardList,
  },
  {
    titre: "Laveurs",
    description: "Gérer les laveurs et suivre leurs commissions.",
    href: "/dashboard/lavage/laveurs",
    icone: Users,
  },
  {
    titre: "Tarifs",
    description: "Configurer les tarifs selon les véhicules et prestations.",
    href: "/dashboard/lavage/tarifs",
    icone: CreditCard,
  },
  {
    titre: "Caisses",
    description: "Consulter les caisses et les mouvements financiers.",
    href: "/dashboard/lavage/caisses",
    icone: Wallet,
  },
  {
    titre: "Rapports",
    description: "Suivre les recettes et les commissions.",
    href: "/dashboard/lavage/rapports",
    icone: TrendingUp,
  },
  {
    titre: "Paramètres",
    description: "Configurer les informations et le fonctionnement du lavage.",
    href: "/dashboard/lavage/parametres",
    icone: Settings,
  },
];

function montant(valeur, devise = "FCFA") {
  const nombre = Number(valeur || 0);

  return `${nombre.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} ${devise || "FCFA"}`;
}

function dateLisible(valeur) {
  if (!valeur) return "—";

  const date = new Date(valeur);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nomClient(operation) {
  return (
    operation?.client?.nom ||
    operation?.client_nom ||
    operation?.nom_client ||
    operation?.client_name ||
    "Client de passage"
  );
}

function nomVehicule(operation) {
  const vehicule = operation?.vehicule || {};

  return (
    vehicule.immatriculation ||
    operation?.immatriculation ||
    operation?.numero_immatriculation ||
    vehicule.marque ||
    operation?.type_vehicule?.nom ||
    operation?.type_vehicule_nom ||
    "Véhicule"
  );
}

function nomPrestation(operation) {
  return (
    operation?.prestation?.nom ||
    operation?.prestation_nom ||
    operation?.lavage_prestations?.nom ||
    operation?.details?.[0]?.prestation?.nom ||
    operation?.details?.[0]?.prestation_nom ||
    "Prestation de lavage"
  );
}

function statutOperation(operation) {
  const statut = String(
    operation?.statut ||
      operation?.status ||
      operation?.etat ||
      ""
  ).toLowerCase();

  if (
    ["terminee", "terminée", "termine", "completed", "complete", "payee", "payée"]
      .includes(statut)
  ) {
    return {
      libelle: "Terminée",
      classe: "bg-emerald-50 text-emerald-700",
    };
  }

  if (
    ["annulee", "annulée", "annule", "cancelled", "canceled"]
      .includes(statut)
  ) {
    return {
      libelle: "Annulée",
      classe: "bg-red-50 text-red-700",
    };
  }

  if (
    ["en_cours", "en cours", "pending", "en_attente", "en attente"]
      .includes(statut)
  ) {
    return {
      libelle: "En cours",
      classe: "bg-amber-50 text-amber-700",
    };
  }

  return {
    libelle: statut ? statut.replaceAll("_", " ") : "Enregistrée",
    classe: "bg-slate-100 text-slate-700",
  };
}

function StatistiqueCard({
  titre,
  valeur,
  description,
  icone: Icone,
  accent = "blue",
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    gold: "bg-amber-50 text-amber-700",
    purple: "bg-violet-50 text-violet-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{titre}</p>
          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-[#14233B]">
            {valeur}
          </p>
          {description && (
            <p className="mt-2 text-xs text-slate-500">{description}</p>
          )}
        </div>

        <div
          className={`shrink-0 rounded-xl p-3 ${
            accents[accent] || accents.blue
          }`}
        >
          <Icone size={21} />
        </div>
      </div>
    </div>
  );
}

function BarreEvolution({ donnees = [], devise = "FCFA" }) {
  const valeurs = donnees.map((item) =>
    Number(
      item.chiffreAffaires ??
        item.chiffre_affaires ??
        item.montant ??
        item.total ??
        0
    )
  );

  const maximum = Math.max(...valeurs, 1);

  if (!donnees.length) {
    return (
      <div className="flex min-h-44 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">
        Aucune donnée d’évolution disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {donnees.map((item, index) => {
        const valeur = valeurs[index];
        const largeur = Math.max((valeur / maximum) * 100, valeur > 0 ? 2 : 0);

        const libelle =
          item.date ||
          item.jour ||
          item.libelle ||
          item.label ||
          item.periode ||
          `Période ${index + 1}`;

        return (
          <div key={`${libelle}-${index}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-600">{libelle}</span>
              <span className="shrink-0 font-semibold text-[#14233B]">
                {montant(valeur, devise)}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#D8BD83] transition-all"
                style={{ width: `${largeur}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardLavagePage() {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState("");
  const [modalNouvelleOperation, setModalNouvelleOperation] =
    useState(false);

  const chargerDashboard = useCallback(async (silencieux = false) => {
    if (silencieux) {
      setActualisation(true);
    } else {
      setChargement(true);
    }

    setErreur("");

    try {
      const response = await fetch("/api/lavage/dashboard", {
        method: "GET",
        cache: "no-store",
      });

      const resultat = await response.json();

      if (!response.ok) {
        throw new Error(
          resultat?.error ||
            resultat?.message ||
            "Impossible de charger le tableau de bord Lavage."
        );
      }

      if (resultat?.success === false) {
        throw new Error(
          resultat.error || "Erreur lors du chargement du tableau de bord."
        );
      }

      setDonnees(resultat);
    } catch (err) {
      setErreur(
        err.message || "Une erreur est survenue lors du chargement."
      );
    } finally {
      setChargement(false);
      setActualisation(false);
    }
  }, []);

  useEffect(() => {
    chargerDashboard();
  }, [chargerDashboard]);

  const station = donnees?.station || {};
  const statistiques = donnees?.statistiques || {};
  const evolution = Array.isArray(donnees?.evolution)
    ? donnees.evolution
    : [];
  const derniersServices = Array.isArray(donnees?.derniersServices)
    ? donnees.derniersServices
    : [];
  const devise = donnees?.devise || "FCFA";

  const chiffreAffaires = Number(
    statistiques.chiffreAffaires || 0
  );

  const encaissements = Number(
    statistiques.encaissements || 0
  );

  const prestationsTerminees = Number(
    statistiques.prestationsTerminees || 0
  );

  const panierMoyen = Number(
    statistiques.panierMoyen || 0
  );

  const totalCommissionsLaveurs = Number(
    statistiques.commissionsTotales || 0
  );

  const commissionsPayees = Number(
    statistiques.commissionsPayees || 0
  );

  const commissionsAPayer = Number(
    statistiques.commissionsAPayer ??
      Math.max(totalCommissionsLaveurs - commissionsPayees, 0)
  );

  const resultatApresCommissions = Number(
    statistiques.resultatApresCommissions ??
      chiffreAffaires - totalCommissionsLaveurs
  );

  const soldeCaisses = Number(
    statistiques.soldeCaisses || 0
  );

  const caissesActives = Number(
    statistiques.caissesActives || 0
  );

  const prestationsConfigurees = Number(
    statistiques.prestationsConfigurees || 0
  );

  const laveursActifs = Number(
    statistiques.laveursActifs || 0
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        {/* En-tête */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#14233B] p-3 text-[#D8BD83]">
              <Droplets size={26} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                MAAX Business
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#14233B] sm:text-3xl">
                Tableau de bord Lavage
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {station.nom ||
                  station.nom_lavage ||
                  station.libelle ||
                  "Suivi de votre activité de lavage automobile"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => chargerDashboard(true)}
              disabled={chargement || actualisation}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#14233B] transition hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  actualisation ? "animate-spin" : ""
                }
              />
              Actualiser
            </button>

            <button
              type="button"
              onClick={() => setModalNouvelleOperation(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-5 py-3 text-sm font-bold text-[#14233B] transition hover:bg-[#e6ce98]"
            >
              <CarFront size={18} />
              Nouvelle opération
            </button>
          </div>
        </div>

        {/* Erreur */}
        {erreur && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle size={21} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Impossible de charger les données
              </p>
              <p className="mt-1 text-sm">{erreur}</p>
              <button
                type="button"
                onClick={() => chargerDashboard()}
                className="mt-3 text-sm font-bold underline"
              >
                Réessayer
              </button>
            </div>
            <button
              type="button"
              onClick={() => setErreur("")}
              className="rounded-lg p-1 hover:bg-red-100"
              aria-label="Fermer le message"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Chargement initial */}
        {chargement && !donnees ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white">
            <LoaderCircle
              size={32}
              className="animate-spin text-[#14233B]"
            />
            <p className="text-sm text-slate-500">
              Chargement du tableau de bord…
            </p>
          </div>
        ) : (
          <>
            {/* Indicateurs principaux */}
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#14233B]">
                  Activité du jour
                </h2>
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays size={15} />
                  Aujourd’hui
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatistiqueCard
                  titre="Chiffre d’affaires"
                  valeur={montant(chiffreAffaires, devise)}
                  description="Montant total des prestations"
                  icone={TrendingUp}
                  accent="blue"
                />

                <StatistiqueCard
                  titre="Encaissements"
                  valeur={montant(encaissements, devise)}
                  description="Montants encaissés"
                  icone={Banknote}
                  accent="green"
                />

                <StatistiqueCard
                  titre="Prestations terminées"
                  valeur={prestationsTerminees.toLocaleString("fr-FR")}
                  description="Opérations finalisées"
                  icone={CarFront}
                  accent="purple"
                />

                <StatistiqueCard
                  titre="Panier moyen"
                  valeur={montant(panierMoyen, devise)}
                  description="Recette moyenne par prestation"
                  icone={Receipt}
                  accent="gold"
                />
              </div>
            </section>

            {/* Commissions et caisses */}
            <section>
              <h2 className="mb-4 text-lg font-bold text-[#14233B]">
                Commissions et trésorerie
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatistiqueCard
                  titre="Commissions des laveurs"
                  valeur={montant(totalCommissionsLaveurs, devise)}
                  description="Total généré aujourd’hui"
                  icone={Users}
                  accent="purple"
                />

                <StatistiqueCard
                  titre="Commissions payées"
                  valeur={montant(commissionsPayees, devise)}
                  description="Montant déjà réglé"
                  icone={CheckCircle2}
                  accent="green"
                />

                <StatistiqueCard
                  titre="Commissions à payer"
                  valeur={montant(commissionsAPayer, devise)}
                  description="Reste à régler aux laveurs"
                  icone={Wallet}
                  accent="gold"
                />

                <StatistiqueCard
                  titre="Solde des caisses"
                  valeur={montant(soldeCaisses, devise)}
                  description={`${caissesActives} caisse(s) active(s)`}
                  icone={Banknote}
                  accent="blue"
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatistiqueCard
                  titre="Résultat après commissions"
                  valeur={montant(resultatApresCommissions, devise)}
                  description="Chiffre d’affaires moins commissions générées"
                  icone={TrendingUp}
                  accent="green"
                />

                <StatistiqueCard
                  titre="Configuration active"
                  valeur={`${laveursActifs} laveur(s)`}
                  description={`${prestationsConfigurees} prestation(s) configurée(s)`}
                  icone={Settings}
                  accent="gold"
                />
              </div>
            </section>

            {/* Graphique d'évolution et raccourcis */}
            <section className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2 sm:p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-[#14233B]">
                    Évolution du chiffre d’affaires
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Suivi des recettes sur la période disponible
                  </p>
                </div>

                <BarreEvolution
                  donnees={evolution}
                  devise={devise}
                />
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-[#14233B]">
                  Accès rapides
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Gestion quotidienne du lavage
                </p>

                <div className="mt-5 space-y-3">
                  {rubriques.map((rubrique) => {
                    const Icone = rubrique.icone;

                    return (
                      <Link
                        key={rubrique.href}
                        href={rubrique.href}
                        className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-[#D8BD83] hover:bg-amber-50/40"
                      >
                        <div className="rounded-lg bg-slate-100 p-2 text-[#14233B] transition group-hover:bg-[#D8BD83]/30">
                          <Icone size={19} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#14233B]">
                            {rubrique.titre}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {rubrique.description}
                          </p>
                        </div>

                        <ArrowRight
                          size={16}
                          className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#14233B]"
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Dernières opérations */}
            <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <h2 className="text-lg font-bold text-[#14233B]">
                    Dernières opérations
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Les opérations récemment enregistrées
                  </p>
                </div>

                <Link
                  href="/dashboard/lavage/services"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#14233B] hover:text-amber-700"
                >
                  Voir toutes les opérations
                  <ArrowRight size={16} />
                </Link>
              </div>

              {derniersServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                  <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                    <ClipboardList size={28} />
                  </div>
                  <p className="mt-4 font-semibold text-[#14233B]">
                    Aucune opération pour le moment
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Enregistrez votre première opération avec le bouton
                    « Nouvelle opération ».
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalNouvelleOperation(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#D8BD83] px-4 py-3 text-sm font-bold text-[#14233B] hover:bg-[#e6ce98]"
                  >
                    <CarFront size={17} />
                    Nouvelle opération
                  </button>
                </div>
              ) : (
                <>
                  {/* Tableau sur grand écran */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[720px] text-left">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Date</th>
                          <th className="px-6 py-4 font-semibold">Véhicule</th>
                          <th className="px-6 py-4 font-semibold">Client</th>
                          <th className="px-6 py-4 font-semibold">Prestation</th>
                          <th className="px-6 py-4 text-right font-semibold">
                            Montant
                          </th>
                          <th className="px-6 py-4 font-semibold">Statut</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {derniersServices.map((operation, index) => {
                          const statut = statutOperation(operation);
                          const montantOperation = Number(
                            operation.montant_total ??
                              operation.montant ??
                              operation.total ??
                              operation.prix_total ??
                              0
                          );

                          return (
                            <tr
                              key={operation.id || index}
                              className="transition hover:bg-slate-50/70"
                            >
                              <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                {dateLisible(
                                  operation.created_at ||
                                    operation.date_prestation ||
                                    operation.date_creation ||
                                    operation.date
                                )}
                              </td>

                              <td className="px-6 py-4">
                                <p className="text-sm font-semibold text-[#14233B]">
                                  {nomVehicule(operation)}
                                </p>
                              </td>

                              <td className="px-6 py-4 text-sm text-slate-600">
                                {nomClient(operation)}
                              </td>

                              <td className="px-6 py-4 text-sm text-slate-600">
                                {nomPrestation(operation)}
                              </td>

                              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-bold text-[#14233B]">
                                {montant(montantOperation, devise)}
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statut.classe}`}
                                >
                                  {statut.libelle}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cartes sur mobile */}
                  <div className="divide-y divide-slate-100 md:hidden">
                    {derniersServices.map((operation, index) => {
                      const statut = statutOperation(operation);
                      const montantOperation = Number(
                        operation.montant_total ??
                          operation.montant ??
                          operation.total ??
                          operation.prix_total ??
                          0
                      );

                      return (
                        <div
                          key={operation.id || index}
                          className="space-y-3 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-bold text-[#14233B]">
                                {nomVehicule(operation)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {dateLisible(
                                  operation.created_at ||
                                    operation.date_prestation ||
                                    operation.date_creation ||
                                    operation.date
                                )}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statut.classe}`}
                            >
                              {statut.libelle}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-500">Client</p>
                              <p className="mt-1 font-medium text-[#14233B]">
                                {nomClient(operation)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">
                                Prestation
                              </p>
                              <p className="mt-1 font-medium text-[#14233B]">
                                {nomPrestation(operation)}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-3">
                            <p className="text-xs text-slate-500">Montant</p>
                            <p className="mt-1 text-lg font-bold text-[#14233B]">
                              {montant(montantOperation, devise)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* Fenêtre partagée de création d'opération */}
        <NouvelleOperationModal
          open={modalNouvelleOperation}
          onClose={() => setModalNouvelleOperation(false)}
          onSuccess={() => chargerDashboard(true)}
        />
      </div>
    </main>
  );
}

function CheckCircle2Icon(props) {
  return <ClipboardCheck {...props} />;
}
