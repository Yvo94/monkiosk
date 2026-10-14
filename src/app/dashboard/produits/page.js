
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Package,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Boxes,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const EMPTY_FORM = {
  nom: "",
  reference: "",
  code_barres: "",
  description: "",
  categorie_id: "",
  unite: "unité",
  prix_achat: "0",
  prix_vente: "",
  stock_actuel: "0",
  stock_minimum: "0",
  actif: true,
};

const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0)) + " FCFA";

export default function ProduitsPage() {
  const [kiosk, setKiosk] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const authUser = session?.user;

      if (!authUser) {
        throw new Error(
          "Session expirée. Connecte-toi à nouveau à MonKiosk."
        );
      }

      const { data: kioskData, error: kioskError } = await supabase
        .from("kiosques")
        .select("id, nom, devise")
        .eq("owner_id", authUser.id)
        .eq("actif", true)
        .maybeSingle();

      if (kioskError) throw kioskError;

      if (!kioskData) {
        throw new Error(
          "Aucun kiosque actif n'est associé à ton compte."
        );
      }

      setKiosk(kioskData);

      const [productsResult, categoriesResult] = await Promise.all([
        supabase
          .from("kiosque_produits")
          .select("*")
          .eq("kiosque_id", kioskData.id)
          .order("nom", { ascending: true }),

        supabase
          .from("kiosque_categories")
          .select("id, nom, actif")
          .eq("kiosque_id", kioskData.id)
          .eq("actif", true)
          .order("nom", { ascending: true }),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
    } catch (err) {
      console.error("Erreur chargement produits :", err);
      setError(err.message || "Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !term ||
        product.nom?.toLowerCase().includes(term) ||
        product.reference?.toLowerCase().includes(term) ||
        product.code_barres?.toLowerCase().includes(term);

      const matchesCategory =
        categoryFilter === "all" ||
        product.categorie_id === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.actif) ||
        (statusFilter === "inactive" && !product.actif) ||
        (statusFilter === "low" &&
          product.actif &&
          Number(product.stock_actuel) <=
            Number(product.stock_minimum));

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.actif);
    const lowStock = active.filter(
      (p) => Number(p.stock_actuel) <= Number(p.stock_minimum)
    );

    const stockValue = active.reduce(
      (sum, p) =>
        sum +
        Number(p.prix_achat || 0) * Number(p.stock_actuel || 0),
      0
    );

    return {
      total: products.length,
      active: active.length,
      lowStock: lowStock.length,
      stockValue,
    };
  }, [products]);

  function openCreateModal() {
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(product) {
    setEditingProduct(product);
    setForm({
      nom: product.nom || "",
      reference: product.reference || "",
      code_barres: product.code_barres || "",
      description: product.description || "",
      categorie_id: product.categorie_id || "",
      unite: product.unite || "unité",
      prix_achat: String(product.prix_achat ?? 0),
      prix_vente: String(product.prix_vente ?? ""),
      stock_actuel: String(product.stock_actuel ?? 0),
      stock_minimum: String(product.stock_minimum ?? 0),
      actif: product.actif ?? true,
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!kiosk) {
      setError("Aucun kiosque sélectionné.");
      return;
    }

    if (!form.nom.trim()) {
      setError("Le nom du produit est obligatoire.");
      return;
    }

    const prixAchat = Number(form.prix_achat);
    const prixVente = Number(form.prix_vente);
    const stockActuel = Number(form.stock_actuel);
    const stockMinimum = Number(form.stock_minimum);

    if (
      !Number.isFinite(prixAchat) ||
      !Number.isFinite(prixVente) ||
      !Number.isFinite(stockActuel) ||
      !Number.isFinite(stockMinimum) ||
      prixAchat < 0 ||
      prixVente < 0 ||
      stockActuel < 0 ||
      stockMinimum < 0
    ) {
      setError("Vérifie les prix et les quantités : ils doivent être positifs.");
      return;
    }

    if (form.prix_vente.trim() === "") {
      setError("Le prix de vente est obligatoire.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        kiosque_id: kiosk.id,
        categorie_id: form.categorie_id || null,
        nom: form.nom.trim(),
        reference: form.reference.trim() || null,
        code_barres: form.code_barres.trim() || null,
        description: form.description.trim() || null,
        unite: form.unite.trim() || "unité",
        prix_achat: prixAchat,
        prix_vente: prixVente,
        stock_actuel: stockActuel,
        stock_minimum: stockMinimum,
        actif: form.actif,
        updated_at: new Date().toISOString(),
      };

      let result;

      if (editingProduct) {
        result = await supabase
          .from("kiosque_produits")
          .update(payload)
          .eq("id", editingProduct.id)
          .eq("kiosque_id", kiosk.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("kiosque_produits")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setSuccess(
        editingProduct
          ? "Produit modifié avec succès."
          : "Produit ajouté avec succès."
      );

      setModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Erreur enregistrement produit :", err);

      if (err.code === "42501") {
        setError(
          "Accès refusé par Supabase. Vérifie les politiques RLS."
        );
      } else if (err.code === "23503") {
        setError(
          "La catégorie sélectionnée n'est pas valide pour ce kiosque."
        );
      } else if (err.code === "23505") {
        setError(
          "Une valeur unique existe déjà. Vérifie la référence ou le code-barres."
        );
      } else {
        setError(err.message || "Impossible d'enregistrer le produit.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleProduct(product) {
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("kiosque_produits")
        .update({
          actif: !product.actif,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id)
        .eq("kiosque_id", kiosk.id);

      if (updateError) throw updateError;

      setSuccess(
        product.actif
          ? "Produit désactivé."
          : "Produit réactivé."
      );

      await loadData();
    } catch (err) {
      console.error("Erreur statut produit :", err);
      setError(err.message || "Impossible de modifier le statut.");
    }
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(
      `Supprimer le produit « ${product.nom} » ?\n\n` +
        "Cette opération peut être refusée si le produit est déjà utilisé dans des ventes ou des mouvements de stock."
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase
        .from("kiosque_produits")
        .delete()
        .eq("id", product.id)
        .eq("kiosque_id", kiosk.id);

      if (deleteError) throw deleteError;

      setSuccess("Produit supprimé.");
      await loadData();
    } catch (err) {
      console.error("Erreur suppression produit :", err);
      setError(
        "Suppression impossible. Le produit est peut-être utilisé dans des ventes ou des mouvements de stock. Désactive-le plutôt."
      );
    }
  }

  function getCategoryName(categoryId) {
    if (!categoryId) return "Sans catégorie";

    return (
      categories.find((category) => category.id === categoryId)?.nom ||
      "Catégorie indisponible"
    );
  }

  function getStockStatus(product) {
    const stock = Number(product.stock_actuel);
    const minimum = Number(product.stock_minimum);

    if (stock <= minimum) {
      return {
        label: "Stock faible",
        className: "bg-red-50 text-red-700",
      };
    }

    return {
      label: "Disponible",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (loading && !kiosk) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Chargement des produits...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {kiosk?.nom || "MonKiosk"} / Catalogue
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">
            Gestion des produits
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Gère les articles, les prix et les niveaux de stock.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Actualiser
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Nouveau produit
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="break-words">{error}</p>
          <button
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Fermer l'erreur"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{success}</p>
          <button
            onClick={() => setSuccess("")}
            className="ml-auto"
            aria-label="Fermer le message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Total produits"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Produits actifs"
          value={stats.active}
          color="green"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Stocks à surveiller"
          value={stats.lowStock}
          color="orange"
        />
        <StatCard
          icon={<Boxes className="h-5 w-5" />}
          label="Valeur du stock au prix d'achat"
          value={money(stats.stockValue)}
          color="purple"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit, une référence ou un code-barres..."
              className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-8 text-sm outline-none focus:border-blue-500 sm:min-w-44"
              >
                <option value="all">Toutes les catégories</option>
                <option value="uncategorized">Sans catégorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nom}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
              <option value="low">Stock faible</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-sm text-gray-500">
          <span>
            {filteredProducts.length} produit(s) affiché(s)
          </span>
          <span className="hidden sm:inline">
            Devise : {kiosk?.devise || "XOF"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Produit</th>
                <th className="px-5 py-4 font-semibold">Catégorie</th>
                <th className="px-5 py-4 font-semibold">Prix d'achat</th>
                <th className="px-5 py-4 font-semibold">Prix de vente</th>
                <th className="px-5 py-4 font-semibold">Marge unitaire</th>
                <th className="px-5 py-4 font-semibold">Stock</th>
                <th className="px-5 py-4 font-semibold">Statut</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product);
                const margin =
                  Number(product.prix_vente || 0) -
                  Number(product.prix_achat || 0);

                const matchesUncategorized =
                  categoryFilter !== "uncategorized" ||
                  !product.categorie_id;

                if (!matchesUncategorized) return null;

                return (
                  <tr
                    key={product.id}
                    className="transition hover:bg-gray-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {product.nom}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Réf. : {product.reference || "Non définie"}
                          </p>
                          {product.code_barres && (
                            <p className="mt-1 text-xs text-gray-400">
                              Code : {product.code_barres}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {getCategoryName(product.categorie_id)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-gray-600">
                      {money(product.prix_achat)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap font-semibold text-gray-900">
                      {money(product.prix_vente)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={
                          margin >= 0
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-red-600"
                        }
                      >
                        {money(margin)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {Number(product.stock_actuel)}{" "}
                        <span className="font-normal text-gray-500">
                          {product.unite}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Minimum : {Number(product.stock_minimum)}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium ${stockStatus.className}`}
                      >
                        {stockStatus.label}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <button
                        onClick={() => toggleProduct(product)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          product.actif
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {product.actif ? "Actif" : "Inactif"}
                      </button>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(product)}
                          title="Modifier"
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product)}
                          title="Supprimer"
                          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <Package className="h-8 w-8" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">
                Aucun produit trouvé
              </h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                Ajoute ton premier produit ou modifie les filtres de recherche.
              </p>
              <button
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Ajouter un produit
              </button>
            </div>
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/50 p-3 py-6 sm:p-6">
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-7">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProduct ? "Modifier le produit" : "Nouveau produit"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Les champs marqués d'un * sont obligatoires.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-7">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Nom du produit *
                  </label>
                  <input
                    required
                    value={form.nom}
                    onChange={(e) => updateField("nom", e.target.value)}
                    placeholder="Ex. : Eau minérale 1,5 L"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Référence
                  </label>
                  <input
                    value={form.reference}
                    onChange={(e) =>
                      updateField("reference", e.target.value)
                    }
                    placeholder="Ex. : BOI-001"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Code-barres
                  </label>
                  <input
                    value={form.code_barres}
                    onChange={(e) =>
                      updateField("code_barres", e.target.value)
                    }
                    placeholder="Code-barres du produit"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Catégorie
                  </label>
                  <select
                    value={form.categorie_id}
                    onChange={(e) =>
                      updateField("categorie_id", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="">Sans catégorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nom}
                      </option>
                    ))}
                  </select>
                  {categories.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Aucune catégorie active. Tu peux en créer dans la page Catégories.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Unité
                  </label>
                  <select
                    value={form.unite}
                    onChange={(e) => updateField("unite", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="unité">Unité</option>
                    <option value="pièce">Pièce</option>
                    <option value="carton">Carton</option>
                    <option value="paquet">Paquet</option>
                    <option value="bouteille">Bouteille</option>
                    <option value="kg">Kilogramme (kg)</option>
                    <option value="g">Gramme (g)</option>
                    <option value="litre">Litre</option>
                    <option value="mL">Millilitre (mL)</option>
                    <option value="sachet">Sachet</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Prix d'achat (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={form.prix_achat}
                    onChange={(e) =>
                      updateField("prix_achat", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Prix de vente (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={form.prix_vente}
                    onChange={(e) =>
                      updateField("prix_vente", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                  />
                  {form.prix_vente !== "" && (
                    <p className="mt-2 text-xs text-gray-500">
                      Marge unitaire estimée :{" "}
                      <span
                        className={
                          Number(form.prix_vente) -
                            Number(form.prix_achat) >=
                          0
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-red-600"
                        }
                      >
                        {money(
                          Number(form.prix_vente) -
                            Number(form.prix_achat)
                        )}
                      </span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Stock actuel *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={form.stock_actuel}
                    onChange={(e) =>
                      updateField("stock_actuel", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Seuil d'alerte du stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={form.stock_minimum}
                    onChange={(e) =>
                      updateField("stock_minimum", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      updateField("description", e.target.value)
                    }
                    placeholder="Informations complémentaires sur le produit..."
                    className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.actif}
                    onChange={(e) =>
                      updateField("actif", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">
                      Produit actif
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      Un produit inactif est conservé dans le catalogue, mais peut être masqué des ventes selon les règles du module de caisse.
                    </span>
                  </span>
                </label>
              </div>

              {error && (
                <div className="mx-5 mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-7">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  )}
                  {saving
                    ? "Enregistrement..."
                    : editingProduct
                    ? "Enregistrer les modifications"
                    : "Créer le produit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            {value}
          </p>
        </div>
        <div className={`rounded-xl p-3 ${styles[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
