
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Tags,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Power,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [kioskId, setKioskId] = useState(null);
  const [kioskName, setKioskName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("toutes");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    nom: "",
    description: "",
    actif: true,
  });

  // Récupération du kiosque appartenant à l'utilisateur connecté
  
  // Récupération du kiosque associé à l'utilisateur connecté
  const loadKiosk = useCallback(async () => {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const authUser = sessionData?.session?.user;

    if (!authUser) {
      throw new Error(
        "Votre session a expiré. Veuillez vous reconnecter."
      );
    }

    const response = await fetch("/api/admin/users?action=kiosk", {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Impossible de récupérer le kiosque associé."
      );
    }

    const kioskData = result.kiosk;

    if (!kioskData?.id) {
      throw new Error(
        "Aucun kiosque actif n'est associé à votre compte."
      );
    }

    setKioskId(kioskData.id);
    setKioskName(kioskData.nom || "Mon kiosque");

    return kioskData.id;
  }, []);


  // Chargement des catégories du kiosque
  const loadCategories = useCallback(async (id) => {
    const { data, error: queryError } = await supabase
      .from("kiosque_categories")
      .select("id, kiosque_id, nom, description, actif, created_at")
      .eq("kiosque_id", id)
      .order("nom", { ascending: true });

    if (queryError) throw queryError;

    setCategories(data || []);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const id = await loadKiosk();
      await loadCategories(id);
    } catch (err) {
      console.error("Erreur chargement catégories :", err);
      setError(err.message || "Impossible de charger les catégories.");
    } finally {
      setLoading(false);
    }
  }, [loadKiosk, loadCategories]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Ouverture du formulaire d'ajout
  const openAddModal = () => {
    setEditingCategory(null);
    setForm({
      nom: "",
      description: "",
      actif: true,
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  // Ouverture du formulaire de modification
  const openEditModal = (category) => {
    setEditingCategory(category);
    setForm({
      nom: category.nom || "",
      description: category.description || "",
      actif: category.actif ?? true,
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  // Enregistrement d'une catégorie
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!kioskId) {
      setError("Aucun kiosque sélectionné.");
      return;
    }

    const nom = form.nom.trim();

    if (!nom) {
      setError("Le nom de la catégorie est obligatoire.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Empêcher les doublons de noms dans le même kiosque
      const { data: duplicate, error: duplicateError } = await supabase
        .from("kiosque_categories")
        .select("id")
        .eq("kiosque_id", kioskId)
        .ilike("nom", nom)
        .limit(1);

      if (duplicateError) throw duplicateError;

      const existingDuplicate = (duplicate || []).find(
        (item) => item.id !== editingCategory?.id
      );

      if (existingDuplicate) {
        setError("Une catégorie portant ce nom existe déjà.");
        return;
      }

      const payload = {
        nom,
        description: form.description.trim() || null,
        actif: form.actif,
      };

      let result;

      if (editingCategory) {
        result = await supabase
          .from("kiosque_categories")
          .update(payload)
          .eq("id", editingCategory.id)
          .eq("kiosque_id", kioskId);
      } else {
        result = await supabase
          .from("kiosque_categories")
          .insert({
            ...payload,
            kiosque_id: kioskId,
          });
      }

      if (result.error) throw result.error;

      setSuccess(
        editingCategory
          ? "Catégorie modifiée avec succès."
          : "Catégorie ajoutée avec succès."
      );

      setModalOpen(false);
      await loadCategories(kioskId);
    } catch (err) {
      console.error("Erreur enregistrement catégorie :", err);
      setError(
        err.message || "Impossible d'enregistrer la catégorie."
      );
    } finally {
      setSaving(false);
    }
  };

  // Activation ou désactivation
  const toggleCategory = async (category) => {
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("kiosque_categories")
        .update({ actif: !category.actif })
        .eq("id", category.id)
        .eq("kiosque_id", kioskId);

      if (updateError) throw updateError;

      setCategories((previous) =>
        previous.map((item) =>
          item.id === category.id
            ? { ...item, actif: !item.actif }
            : item
        )
      );

      setSuccess(
        category.actif
          ? "Catégorie désactivée."
          : "Catégorie activée."
      );
    } catch (err) {
      console.error("Erreur changement statut :", err);
      setError(err.message || "Impossible de modifier le statut.");
    }
  };

  // Suppression avec confirmation
  const deleteCategory = async (category) => {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer la catégorie "${category.nom}" ?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase
        .from("kiosque_categories")
        .delete()
        .eq("id", category.id)
        .eq("kiosque_id", kioskId);

      if (deleteError) throw deleteError;

      setCategories((previous) =>
        previous.filter((item) => item.id !== category.id)
      );

      setSuccess("Catégorie supprimée avec succès.");
    } catch (err) {
      console.error("Erreur suppression catégorie :", err);
      setError(
        "Suppression impossible. Vérifiez si des produits utilisent cette catégorie et si vos droits Supabase autorisent la suppression."
      );
    }
  };

  // Recherche et filtres
  const filteredCategories = categories.filter((category) => {
    const query = search.toLowerCase();

    const matchesSearch =
      (category.nom || "").toLowerCase().includes(query) ||
      (category.description || "").toLowerCase().includes(query);

    const matchesFilter =
      filter === "toutes" ||
      (filter === "actives" && category.actif) ||
      (filter === "inactives" && !category.actif);

    return matchesSearch && matchesFilter;
  });

  const activeCount = categories.filter((item) => item.actif).length;
  const inactiveCount = categories.length - activeCount;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <Tags size={16} />
            <span>Gestion du catalogue</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Gestion des catégories
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Organisez les produits du kiosque de {kioskName || "votre kiosque"}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={initialize}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Actualiser
          </button>

          <button
            type="button"
            onClick={openAddModal}
            disabled={!kioskId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus size={18} />
            Nouvelle catégorie
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Total catégories
            </p>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Tags size={20} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">
            {categories.length}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Toutes les catégories du kiosque
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Catégories actives
            </p>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Disponibles pour le catalogue
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Catégories inactives
            </p>
            <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
              <Power size={20} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">
            {inactiveCount}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Temporairement désactivées
          </p>
        </div>
      </div>

      {/* Liste des catégories */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Mes catégories
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {filteredCategories.length} résultat(s)
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une catégorie..."
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-64"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            >
              <option value="toutes">Toutes les catégories</option>
              <option value="actives">Actives</option>
              <option value="inactives">Inactives</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
            <RefreshCw size={28} className="animate-spin text-emerald-600" />
            <p className="text-sm">Chargement des catégories...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="rounded-2xl bg-gray-100 p-4 text-gray-500">
              <Tags size={30} />
            </div>
            <h3 className="mt-4 font-semibold text-gray-900">
              {categories.length === 0
                ? "Aucune catégorie pour le moment"
                : "Aucun résultat"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              {categories.length === 0
                ? "Créez votre première catégorie pour organiser vos produits."
                : "Essayez une autre recherche ou modifiez le filtre."}
            </p>

            {categories.length === 0 && kioskId && (
              <button
                type="button"
                onClick={openAddModal}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus size={18} />
                Créer une catégorie
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Affichage mobile */}
            <div className="divide-y divide-gray-100 md:hidden">
              {filteredCategories.map((category) => (
                <div key={category.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-900">
                        {category.nom}
                      </p>
                      <p className="mt-1 break-words text-sm text-gray-500">
                        {category.description || "Aucune description"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        category.actif
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {category.actif ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(category)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={15} /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Power size={15} />
                      {category.actif ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(category)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={15} /> Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tableau desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Catégorie</th>
                    <th className="px-6 py-4 font-semibold">Description</th>
                    <th className="px-6 py-4 font-semibold">Statut</th>
                    <th className="px-6 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50/70">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                            <Tags size={19} />
                          </div>
                          <span className="font-semibold text-gray-900">
                            {category.nom}
                          </span>
                        </div>
                      </td>

                      <td className="max-w-xs px-6 py-4 text-gray-500">
                        <p className="truncate">
                          {category.description || "—"}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            category.actif
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              category.actif
                                ? "bg-emerald-500"
                                : "bg-gray-400"
                            }`}
                          />
                          {category.actif ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title="Modifier"
                            onClick={() => openEditModal(category)}
                            className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            title={category.actif ? "Désactiver" : "Activer"}
                            onClick={() => toggleCategory(category)}
                            className="rounded-lg p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-600"
                          >
                            <Power size={17} />
                          </button>

                          <button
                            type="button"
                            title="Supprimer"
                            onClick={() => deleteCategory(category)}
                            className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Fenêtre d'ajout / modification */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setModalOpen(false);
            }
          }}
        >
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingCategory
                    ? "Modifier la catégorie"
                    : "Nouvelle catégorie"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Renseignez les informations de la catégorie.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Nom de la catégorie <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) =>
                    setForm({ ...form, nom: e.target.value })
                  }
                  placeholder="Ex. : Boissons, Snacks, Produits d'entretien..."
                  maxLength={100}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Description facultative de la catégorie..."
                  rows={3}
                  className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Catégorie active
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Autoriser son utilisation dans le catalogue.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.actif}
                  onChange={(e) =>
                    setForm({ ...form, actif: e.target.checked })
                  }
                  className="h-5 w-5 accent-emerald-600"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving && (
                    <RefreshCw size={16} className="animate-spin" />
                  )}
                  {saving
                    ? "Enregistrement..."
                    : editingCategory
                      ? "Enregistrer les modifications"
                      : "Créer la catégorie"} 
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
