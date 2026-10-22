
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NouvelleDepenseModal from "@/components/lavage/NouvelleDepenseModal";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  LoaderCircle,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
  X,
  AlertCircle,
} from "lucide-react";

const CATEGORIES = [
  "Eau",
  "Électricité",
  "Produits de lavage",
  "Entretien et réparation",
  "Salaires",
  "Transport",
  "Loyer",
  "Fournitures",
  "Autre",
];

const MODES = [
  { value: "especes", label: "Espèces" },
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Money" },
  { value: "moov_money", label: "Moov Money" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement" },
  { value: "autre", label: "Autre" },
];

function dateLocaleInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function formatMontant(value, devise = "FCFA") {
  return `${Number(value || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} ${devise}`;
}

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Abidjan",
  }).format(new Date(value));
}

const FORM_INITIAL = {
  libelle: "",
  categorie: "Autre",
  montant: "",
  date_depense: dateLocaleInput(),
  mode_paiement: "especes",
  statut: "payee",
  caisse_id: "",
  notes: "",
};

export default function DepensesLavagePage() {
  const [stations, setStations] = useState([]);
  const [lavageId, setLavageId] = useState("");
  const [station, setStation] = useState(null);
  const [caisses, setCaisses] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [modalNouvelleDepense, setModalNouvelleDepense] = useState(false);

  const [form, setForm] = useState(FORM_INITIAL);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("toutes");
  const [filtreCategorie, setFiltreCategorie] = useState("toutes");

  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const devise = station?.devise || "FCFA";
  const paiementEspeces = form.mode_paiement === "especes";
  const caisseRequise =
    form.statut === "payee" && paiementEspeces;

  const chargerDonnees = useCallback(async (idDemande = lavageId) => {
    setChargement(true);
    setErreur("");

    try {
      const url = idDemande
        ? `/api/lavage/depenses?lavage_id=${encodeURIComponent(idDemande)}`
        : "/api/lavage/depenses";

      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json();

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Impossible de charger les dépenses."
        );
      }

      setStations(result.stations || []);

      if (!idDemande) {
        if ((result.stations || []).length === 1) {
          const seuleStation = result.stations[0];
          setLavageId(seuleStation.id);
          setStation(seuleStation);
        } else {
          setLavageId("");
          setStation(null);
          setDepenses([]);
          setCaisses([]);
        }

        return;
      }

      setStation(result.station);
      setLavageId(result.station.id);
      setDepenses(result.depenses || []);
      setCaisses(result.caisses || []);

      setForm((precedent) => {
        const caisseExiste = (result.caisses || []).some(
          (caisse) => caisse.id === precedent.caisse_id
        );

        return {
          ...precedent,
          caisse_id: caisseExiste
            ? precedent.caisse_id
            : (result.caisses || []).length === 1
              ? result.caisses[0].id
              : "",
        };
      });
    } catch (error) {
      setErreur(error.message || "Une erreur est survenue.");
    } finally {
      setChargement(false);
    }
  }, [lavageId]);

  useEffect(() => {
    chargerDonnees("");
  }, []);

  useEffect(() => {
    if (lavageId) {
      chargerDonnees(lavageId);
    }
  }, [lavageId]);

  function modifierChamp(event) {
    const { name, value } = event.target;

    setForm((precedent) => ({
      ...precedent,
      [name]: value,
    }));

    setErreur("");
    setSucces("");
  }

  async function enregistrerDepense(event) {
    event.preventDefault();
    setErreur("");
    setSucces("");

    if (!lavageId) {
      setErreur("Sélectionne une station de lavage.");
      return;
    }

    if (caisseRequise && !form.caisse_id) {
      setErreur(
        "Sélectionne une caisse pour cette dépense payée en espèces."
      );
      return;
    }

    const montant = Number(form.montant);

    if (!Number.isFinite(montant) || montant <= 0) {
      setErreur("Le montant doit être supérieur à zéro.");
      return;
    }

    setEnregistrement(true);

    try {
      const response = await fetch("/api/lavage/depenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lavage_id: lavageId,
          libelle: form.libelle.trim(),
          categorie: form.categorie,
          montant,
          date_depense: new Date(form.date_depense).toISOString(),
          mode_paiement: form.mode_paiement,
          statut: form.statut,
          caisse_id: caisseRequise ? form.caisse_id : null,
          notes: form.notes.trim() || null,
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Impossible d'enregistrer cette dépense."
        );
      }

      setSucces(
        result.message || "Dépense enregistrée avec succès."
      );
      setForm({
        ...FORM_INITIAL,
        date_depense: dateLocaleInput(),
        caisse_id: caisses.length === 1 ? caisses[0].id : "",
      });
      setAfficherFormulaire(false);

      await chargerDonnees(lavageId);
    } catch (error) {
      setErreur(error.message || "Une erreur est survenue.");
    } finally {
      setEnregistrement(false);
    }
  }

  const depensesFiltrees = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr");

    return depenses.filter((depense) => {
      const correspondRecherche =
        !terme ||
        [depense.libelle, depense.categorie, depense.notes]
          .filter(Boolean)
          .some((valeur) =>
            String(valeur).toLocaleLowerCase("fr").includes(terme)
          );

      const correspondStatut =
        filtreStatut === "toutes" ||
        depense.statut === filtreStatut;

      const correspondCategorie =
        filtreCategorie === "toutes" ||
        depense.categorie === filtreCategorie;

      return (
        correspondRecherche &&
        correspondStatut &&
        correspondCategorie
      );
    });
  }, [depenses, recherche, filtreStatut, filtreCategorie]);

  const statistiques = useMemo(() => {
    const payees = depenses.filter((d) => d.statut === "payee");
    const attente = depenses.filter((d) => d.statut === "en_attente");

    return {
      totalPaye: payees.reduce(
        (total, d) => total + Number(d.montant || 0),
        0
      ),
      totalAttente: attente.reduce(
        (total, d) => total + Number(d.montant || 0),
        0
      ),
      nombre: depenses.length,
    };
  }, [depenses]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/lavage"
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#14233B]"
          >
            <ArrowLeft size={16} />
            Retour au dashboard
          </Link>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#14233B]/5 p-3 text-[#14233B]">
              <Receipt size={25} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[#14233B] md:text-3xl">
                Dépenses
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {station?.nom || "Gestion des dépenses de lavage"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => chargerDonnees(lavageId)}
            disabled={chargement || !lavageId}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#14233B] hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={chargement ? "animate-spin" : ""}
            />
            Actualiser
          </button>

          <button
            type="button"
            onClick={() => setModalNouvelleDepense(true)}
            disabled={!lavageId}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D8BD83] px-4 py-3 text-sm font-bold text-[#14233B] hover:bg-[#e6ce98] disabled:opacity-50"
          >
            {afficherFormulaire ? <X size={17} /> : <Plus size={17} />}
            {afficherFormulaire ? "Fermer" : "Nouvelle dépense"}
          </button>
        </div>
      </div>

      {stations.length > 1 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label
            htmlFor="station"
            className="mb-2 block text-sm font-semibold text-[#14233B]"
          >
            Station de lavage
          </label>
          <select
            id="station"
            value={lavageId}
            onChange={(event) => setLavageId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#D8BD83] md:max-w-md"
          >
            <option value="">Sélectionner une station</option>
            {stations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nom}
              </option>
            ))}
          </select>
        </section>
      )}

      {erreur && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span>{erreur}</span>
        </div>
      )}

      {succes && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <span>{succes}</span>
        </div>
      )}

      {!chargement && stations.length === 0 && !erreur && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Aucune station de lavage active n'est associée à ce compte.
        </div>
      )}

      {chargement && !station ? (
        <div className="flex min-h-40 items-center justify-center gap-3 text-slate-500">
          <LoaderCircle size={20} className="animate-spin" />
          Chargement des données...
        </div>
      ) : station ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Dépenses payées</p>
                <CircleDollarSign size={21} className="text-[#14233B]" />
              </div>
              <p className="mt-3 text-2xl font-bold text-[#14233B]">
                {formatMontant(statistiques.totalPaye, devise)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Total des dépenses au statut payée
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">En attente</p>
                <Clock size={21} className="text-amber-600" />
              </div>
              <p className="mt-3 text-2xl font-bold text-amber-700">
                {formatMontant(statistiques.totalAttente, devise)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Dépenses qui restent à régler
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Nombre de dépenses</p>
                <Wallet size={21} className="text-[#14233B]" />
              </div>
              <p className="mt-3 text-2xl font-bold text-[#14233B]">
                {statistiques.nombre}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Enregistrements de cette station
              </p>
            </div>
          </section>

          {afficherFormulaire && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-[#14233B]">
                  Enregistrer une dépense
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Les dépenses payées en espèces sont déduites de la caisse choisie.
                </p>
              </div>

              <form onSubmit={enregistrerDepense} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Libellé *
                    </label>
                    <input
                      name="libelle"
                      value={form.libelle}
                      onChange={modifierChamp}
                      required
                      maxLength={200}
                      placeholder="Ex. Achat de produits de lavage"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Catégorie *
                    </label>
                    <select
                      name="categorie"
                      value={form.categorie}
                      onChange={modifierChamp}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                    >
                      {CATEGORIES.map((categorie) => (
                        <option key={categorie} value={categorie}>
                          {categorie}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Montant ({devise}) *
                    </label>
                    <input
                      name="montant"
                      type="number"
                      min="1"
                      step="any"
                      value={form.montant}
                      onChange={modifierChamp}
                      required
                      placeholder="Ex. 15000"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Date et heure *
                    </label>
                    <input
                      name="date_depense"
                      type="datetime-local"
                      value={form.date_depense}
                      onChange={modifierChamp}
                      required
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Mode de paiement *
                    </label>
                    <select
                      name="mode_paiement"
                      value={form.mode_paiement}
                      onChange={modifierChamp}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                    >
                      {MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Statut *
                    </label>
                    <select
                      name="statut"
                      value={form.statut}
                      onChange={modifierChamp}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                    >
                      <option value="payee">Payée</option>
                      <option value="en_attente">En attente</option>
                    </select>
                  </div>
                </div>

                {caisseRequise && (
                  <div className="rounded-xl border border-[#D8BD83]/60 bg-amber-50/60 p-4">
                    <label className="mb-2 block text-sm font-semibold text-[#14233B]">
                      Caisse à débiter *
                    </label>
                    {caisses.length === 0 ? (
                      <p className="text-sm text-red-700">
                        Aucune caisse active n'est disponible pour cette station.
                      </p>
                    ) : (
                      <select
                        name="caisse_id"
                        value={form.caisse_id}
                        onChange={modifierChamp}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                      >
                        <option value="">Choisir une caisse</option>
                        {caisses.map((caisse) => (
                          <option key={caisse.id} value={caisse.id}>
                            {caisse.nom} — solde :{" "}
                            {formatMontant(caisse.solde_actuel, devise)}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      Vérifie le solde avant de confirmer la dépense.
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notes (facultatif)
                  </label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={modifierChamp}
                    rows={3}
                    placeholder="Précisions ou référence du justificatif..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#D8BD83]"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setAfficherFormulaire(false)}
                    disabled={enregistrement}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={
                      enregistrement ||
                      (caisseRequise && caisses.length === 0)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-[#14233B] px-5 py-3 text-sm font-bold text-white hover:bg-[#20385B] disabled:opacity-60"
                  >
                    {enregistrement ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    {enregistrement ? "Enregistrement..." : "Enregistrer la dépense"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-bold text-[#14233B]">
                Historique des dépenses
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Consulte et filtre les dépenses enregistrées.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={recherche}
                    onChange={(event) => setRecherche(event.target.value)}
                    placeholder="Rechercher une dépense..."
                    className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-3 text-sm outline-none focus:border-[#D8BD83]"
                  />
                </div>

                <select
                  value={filtreStatut}
                  onChange={(event) => setFiltreStatut(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#D8BD83]"
                >
                  <option value="toutes">Tous les statuts</option>
                  <option value="payee">Payées</option>
                  <option value="en_attente">En attente</option>
                </select>

                <select
                  value={filtreCategorie}
                  onChange={(event) => setFiltreCategorie(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#D8BD83]"
                >
                  <option value="toutes">Toutes les catégories</option>
                  {CATEGORIES.map((categorie) => (
                    <option key={categorie} value={categorie}>
                      {categorie}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {chargement ? (
              <div className="flex justify-center gap-2 p-10 text-sm text-slate-500">
                <LoaderCircle size={18} className="animate-spin" />
                Chargement de l'historique...
              </div>
            ) : depensesFiltrees.length === 0 ? (
              <div className="p-10 text-center">
                <Receipt size={30} className="mx-auto text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">
                  Aucune dépense trouvée
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Modifie les filtres ou enregistre une nouvelle dépense.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-5 py-4">Dépense</th>
                        <th className="px-5 py-4">Date</th>
                        <th className="px-5 py-4">Paiement</th>
                        <th className="px-5 py-4">Caisse</th>
                        <th className="px-5 py-4">Statut</th>
                        <th className="px-5 py-4 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {depensesFiltrees.map((depense) => (
                        <tr key={depense.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-[#14233B]">
                              {depense.libelle}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {depense.categorie}
                              {depense.notes ? ` · ${depense.notes}` : ""}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                            {formatDate(depense.date_depense)}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {MODES.find(
                              (mode) => mode.value === depense.mode_paiement
                            )?.label || depense.mode_paiement}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {depense.caisse?.nom || "—"}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                depense.statut === "payee"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {depense.statut === "payee"
                                ? "Payée"
                                : "En attente"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-[#14233B]">
                            {formatMontant(depense.montant, devise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                  {depensesFiltrees.map((depense) => (
                    <article key={depense.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#14233B]">
                            {depense.libelle}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {depense.categorie}
                          </p>
                        </div>
                        <p className="shrink-0 text-right font-bold text-[#14233B]">
                          {formatMontant(depense.montant, devise)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={14} />
                          {formatDate(depense.date_depense)}
                        </span>
                        <span>
                          {MODES.find(
                            (mode) => mode.value === depense.mode_paiement
                          )?.label || depense.mode_paiement}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {depense.caisse?.nom || "Aucune caisse associée"}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            depense.statut === "payee"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {depense.statut === "payee"
                            ? "Payée"
                            : "En attente"}
                        </span>
                      </div>

                      {depense.notes && (
                        <p className="text-xs text-slate-500">
                          {depense.notes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}

            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {depensesFiltrees.length} dépense(s) affichée(s) · Historique limité aux 1 000 dernières dépenses.
            </div>
          </section>
        </>
      ) : null}
      <NouvelleDepenseModal
        open={modalNouvelleDepense}
        onClose={() => setModalNouvelleDepense(false)}
        lavageId={lavageId}
        devise={devise}
        onSuccess={async () => {
            await chargerDepenses();
        }}
    />
    </main>
  );
}
