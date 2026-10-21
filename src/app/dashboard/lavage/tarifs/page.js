
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Edit,
  Plus,
  Search,
  Tags,
  ToggleLeft,
  ToggleRight,
  Truck,
  X,
} from "lucide-react";

const formatMoney = (value, devise = "FCFA") =>
  `${Number(value || 0).toLocaleString("fr-FR")} ${devise || "FCFA"}`;

const initialForm = {
  id: "",
  type_vehicule_id: "",
  prestation_id: "",
  prix: "",
  commission_laveur: "0",
};

export default function TarifsLavagePage() {
  const [items, setItems] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [prestations, setPrestations] = useState([]);
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("tous");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initialForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/lavage/tarifs", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible de charger les tarifs.");
      }

      setItems(data.items || []);
      setVehicules(data.vehicules || []);
      setPrestations(data.prestations || []);
      setStation(data.lavage || null);
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const actifs = items.filter((item) => item.actif);
    return {
      total: items.length,
      actifs: actifs.length,
      inactifs: items.length - actifs.length,
      prixMoyen: actifs.length
        ? actifs.reduce((total, item) => total + Number(item.prix || 0), 0) /
          actifs.length
        : 0,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const terme = search.trim().toLowerCase();

    return items.filter((item) => {
      const correspondRecherche =
        !terme ||
        item.type_vehicule_nom?.toLowerCase().includes(terme) ||
        item.prestation_nom?.toLowerCase().includes(terme);

      const correspondStatut =
        filter === "tous" ||
        (filter === "actifs" && item.actif) ||
        (filter === "inactifs" && !item.actif);

      return correspondRecherche && correspondStatut;
    });
  }, [items, search, filter]);

  function openCreate() {
    setForm(initialForm);
    setEditing(false);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEdit(item) {
    setForm({
      id: item.id,
      type_vehicule_id: item.type_vehicule_id,
      prestation_id: item.prestation_id,
      prix: String(item.prix ?? ""),
      commission_laveur: String(item.commission_laveur ?? 0),
    });
    setEditing(true);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/lavage/tarifs", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: form.id } : {}),
          type_vehicule_id: form.type_vehicule_id,
          prestation_id: form.prestation_id,
          prix: form.prix,
          commission_laveur: form.commission_laveur,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'enregistrer le tarif.");
      }

      setModalOpen(false);
      setSuccess(editing ? "Tarif modifié avec succès." : "Tarif créé avec succès.");
      await loadData();
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/lavage/tarifs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, actif: !item.actif }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible de modifier le statut.");
      }

      setSuccess(
        item.actif ? "Tarif désactivé." : "Tarif activé."
      );
      await loadData();
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/dashboard/lavage"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Retour au dashboard Lavage
        </Link>

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-600">
              Configuration de la station
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Tarifs
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Définis le prix de chaque lavage selon le véhicule et la
              commission attribuée au laveur.
            </p>
            {station?.nom && (
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Station : {station.nom}
              </p>
            )}
          </div>

          <button
            onClick={openCreate}
            disabled={!vehicules.length || !prestations.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />
            Nouveau tarif
          </button>
        </header>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <X size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Tags size={21} />}
            label="Tarifs configurés"
            value={stats.total}
            detail="Toutes combinaisons"
          />
          <StatCard
            icon={<CheckCircle2 size={21} />}
            label="Tarifs actifs"
            value={stats.actifs}
            detail="Utilisables pour les prestations"
          />
          <StatCard
            icon={<ToggleLeft size={21} />}
            label="Tarifs inactifs"
            value={stats.inactifs}
            detail="Conservés dans l'historique"
          />
          <StatCard
            icon={<CircleDollarSign size={21} />}
            label="Prix moyen actif"
            value={formatMoney(stats.prixMoyen, station?.devise)}
            detail="Moyenne des tarifs actifs"
          />
        </section>

        {(!vehicules.length || !prestations.length) && !loading && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
            <p className="font-semibold text-slate-900">
              Configuration préalable nécessaire
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Pour créer un tarif, configure d'abord au moins un type de
              véhicule et un type de lavage actif.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
              <Link
                href="/dashboard/lavage/configuration/vehicules"
                className="text-amber-700 underline underline-offset-4"
              >
                Configurer les véhicules
              </Link>
              <Link
                href="/dashboard/lavage/configuration/types-lavage"
                className="text-amber-700 underline underline-offset-4"
              >
                Configurer les types de lavage
              </Link>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Grille tarifaire</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredItems.length} tarif(s) affiché(s)
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher un tarif..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 sm:w-64"
                />
              </div>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              >
                <option value="tous">Tous les statuts</option>
                <option value="actifs">Actifs</option>
                <option value="inactifs">Inactifs</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Type de véhicule</th>
                  <th className="px-5 py-4 font-semibold">Type de lavage</th>
                  <th className="px-5 py-4 text-right font-semibold">Prix client</th>
                  <th className="px-5 py-4 text-right font-semibold">Commission</th>
                  <th className="px-5 py-4 text-center font-semibold">Statut</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      Chargement des tarifs...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <Banknote size={30} className="mb-3 text-slate-300" />
                        <p className="font-semibold text-slate-700">
                          Aucun tarif trouvé
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Crée un tarif ou modifie les critères de recherche.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <Truck size={18} />
                          </span>
                          <span className="font-semibold text-slate-800">
                            {item.type_vehicule_nom}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {item.prestation_nom}
                      </td>
                      <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-900">
                        {formatMoney(item.prix, station?.devise)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium tabular-nums text-amber-700">
                        {formatMoney(item.commission_laveur, station?.devise)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            item.actif
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.actif ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            title="Modifier le tarif"
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(item)}
                            title={item.actif ? "Désactiver" : "Activer"}
                            className={`rounded-lg border p-2 transition ${
                              item.actif
                                ? "border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {item.actif ? (
                              <ToggleRight size={16} />
                            ) : (
                              <ToggleLeft size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500">
            Les tarifs désactivés sont conservés. La commission affichée
            correspond à la commission prévue pour cette combinaison.
          </div>
        </section>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
            <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">
                    Configuration
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {editing ? "Modifier le tarif" : "Nouveau tarif"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Définis le prix client et la commission du laveur.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Type de véhicule *
                  </label>
                  <select
                    required
                    value={form.type_vehicule_id}
                    onChange={(event) =>
                      updateField("type_vehicule_id", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">Sélectionner un véhicule</option>
                    {vehicules.map((vehicule) => (
                      <option key={vehicule.id} value={vehicule.id}>
                        {vehicule.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Type de lavage *
                  </label>
                  <select
                    required
                    value={form.prestation_id}
                    onChange={(event) =>
                      updateField("prestation_id", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">Sélectionner un lavage</option>
                    {prestations.map((prestation) => (
                      <option key={prestation.id} value={prestation.id}>
                        {prestation.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Prix facturé au client ({station?.devise || "FCFA"}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.prix}
                    onChange={(event) => updateField("prix", event.target.value)}
                    placeholder="Ex. 5000"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Commission du laveur ({station?.devise || "FCFA"})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.commission_laveur}
                    onChange={(event) =>
                      updateField("commission_laveur", event.target.value)
                    }
                    placeholder="Ex. 500"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    Cette commission sera utilisée dans les statistiques de
                    rémunération. Elle ne représente pas, à elle seule, le
                    bénéfice net de la station.
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? "Enregistrement..."
                      : editing
                        ? "Enregistrer les modifications"
                        : "Créer le tarif"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
