
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Package,
  AlertTriangle,
  TrendingDown,
  Search,
  RefreshCw,
  Plus,
  ClipboardList,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const money = (value, devise = "FCFA") =>
  `${Number(value || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} ${devise}`;

const number = (value) =>
  Number(value || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  });

const dateFormat = (value) =>
  value
    ? new Date(value).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

const movementLabels = {
  entree: "Entrée",
  sortie: "Sortie manuelle",
  ajustement: "Ajustement",
  sortie_vente: "Sortie de vente",
};

const getStatus = (product) => {
  const stock = Number(product.stock_actuel || 0);
  const minimum = Number(product.stock_minimum || 0);

  if (stock <= 0) {
    return {
      label: "Rupture",
      className: "bg-red-50 text-red-700",
    };
  }

  if (stock <= minimum) {
    return {
      label: "Stock faible",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Normal",
    className: "bg-emerald-50 text-emerald-700",
  };
};

function StatCard({ title, value, detail, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-2 break-words text-2xl font-bold text-gray-900">
            {value}
          </p>
          {detail && (
            <p className="mt-1 text-xs text-gray-500">{detail}</p>
          )}
        </div>
        <div className={`shrink-0 rounded-xl p-3 ${color}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

export default function StockPage() {
  const [kiosk, setKiosk] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("tous");
  const [movementFilter, setMovementFilter] = useState("tous");
  const [categoryFilter, setCategoryFilter] = useState("tous");
  const [tab, setTab] = useState("stock");
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    produit_id: "",
    type_mouvement: "entree",
    quantite: "",
    motif: "",
  });

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const user = sessionData.session?.user;

      if (!user) {
        throw new Error(
          "Veuillez vous connecter pour consulter le stock."
        );
      }

      
      const response = await fetch("/api/admin/users?action=kiosk", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Impossible de récupérer le kiosque."
        );
      }

      const kioskData = result.kiosk;

      if (!kioskData) {
        setKiosk(null);
        setProducts([]);
        setCategories([]);
        setMovements([]);

        throw new Error(
          "Aucun kiosque actif n'est associé à votre compte."
        );
      }

      setKiosk(kioskData);


      const [
        productsResult,
        categoriesResult,
        movementsResult,
      ] = await Promise.all([
        supabase
          .from("kiosque_produits")
          .select(
            "id, kiosque_id, categorie_id, nom, reference, code_barres, unite, prix_achat, prix_vente, stock_actuel, stock_minimum, actif"
          )
          .eq("kiosque_id", kioskData.id)
          .order("nom", { ascending: true }),

        supabase
          .from("kiosque_categories")
          .select("id, nom, actif")
          .eq("kiosque_id", kioskData.id)
          .eq("actif", true)
          .order("nom", { ascending: true }),

        supabase
          .from("kiosque_mouvements_stock")
          .select(
            "id, produit_id, type_mouvement, quantite, variation, stock_avant, stock_apres, motif, created_at, created_by"
          )
          .eq("kiosque_id", kioskData.id)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (movementsResult.error) throw movementsResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
      setMovements(movementsResult.data || []);
    } catch (err) {
      console.error("Erreur de chargement du stock :", err);
      setError(
        err?.message || "Impossible de charger les données du stock."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.nom])),
    [categories]
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product.actif),
    [products]
  );

  const stats = useMemo(() => {
    const lowStock = activeProducts.filter((product) => {
      const stock = Number(product.stock_actuel || 0);
      const minimum = Number(product.stock_minimum || 0);
      return stock > 0 && stock <= minimum;
    });

    const outOfStock = activeProducts.filter(
      (product) => Number(product.stock_actuel || 0) <= 0
    );

    const totalUnits = activeProducts.reduce(
      (total, product) =>
        total + Number(product.stock_actuel || 0),
      0
    );

    const stockValue = activeProducts.reduce(
      (total, product) =>
        total +
        Number(product.prix_achat || 0) *
          Number(product.stock_actuel || 0),
      0
    );

    return {
      total: activeProducts.length,
      totalUnits,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      stockValue,
    };
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !term ||
        [product.nom, product.reference, product.code_barres]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const matchesCategory =
        categoryFilter === "tous" ||
        product.categorie_id === categoryFilter;

      const current = Number(product.stock_actuel || 0);
      const minimum = Number(product.stock_minimum || 0);

      let matchesStock = true;

      if (stockFilter === "rupture") matchesStock = current <= 0;
      if (stockFilter === "faible") {
        matchesStock = current > 0 && current <= minimum;
      }
      if (stockFilter === "normal") matchesStock = current > minimum;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, stockFilter, categoryFilter]);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const product = productMap.get(movement.produit_id);

      const matchesSearch =
        !term ||
        [
          product?.nom,
          product?.reference,
          movement.motif,
          movement.type_mouvement,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const matchesType =
        movementFilter === "tous" ||
        movement.type_mouvement === movementFilter;

      return matchesSearch && matchesType;
    });
  }, [movements, productMap, search, movementFilter]);

  const devise = kiosk?.devise || "FCFA";
  const selectedProduct = productMap.get(form.produit_id) || null;

  function openModal(product = null, type = "entree") {
    setError("");
    setSuccess("");

    setForm({
      produit_id: product?.id || activeProducts[0]?.id || "",
      type_mouvement: type,
      quantite: "",
      motif: "",
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!kiosk?.id) {
      setError("Le kiosque actif est introuvable.");
      return;
    }

    const product = productMap.get(form.produit_id);
    const quantity = Number(form.quantite);
    const type = form.type_mouvement;

    if (!product || !product.actif) {
      setError("Sélectionnez un produit actif valide.");
      return;
    }

    if (!Number.isFinite(quantity)) {
      setError("Saisissez une quantité valide.");
      return;
    }

    // Pour l'ajustement, zéro est autorisé : il peut s'agir d'une rupture
    // physique constatée pendant l'inventaire.
    if (type === "ajustement" ? quantity < 0 : quantity <= 0) {
      setError(
        type === "ajustement"
          ? "La quantité constatée ne peut pas être négative."
          : "Saisissez une quantité supérieure à zéro."
      );
      return;
    }

    if (!["entree", "sortie", "ajustement"].includes(type)) {
      setError("Le type de mouvement sélectionné est invalide.");
      return;
    }

    if (!form.motif.trim()) {
      setError("Veuillez préciser le motif du mouvement.");
      return;
    }

    if (
      type === "sortie" &&
      quantity > Number(product.stock_actuel || 0)
    ) {
      setError(
        `Stock insuffisant. Quantité disponible : ${number(
          product.stock_actuel
        )} ${product.unite || "unité"}.`
      );
      return;
    }

    if (
      type === "ajustement" &&
      quantity === Number(product.stock_actuel || 0)
    ) {
      setError("Le stock constaté est identique au stock actuel.");
      return;
    }

    setSaving(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        "gerer_mouvement_stock",
        {
          p_kiosque_id: kiosk.id,
          p_produit_id: form.produit_id,
          p_type_mouvement: type,
          p_quantite: quantity,
          p_motif: form.motif.trim(),
        }
      );

      if (rpcError) throw rpcError;

      setShowModal(false);
      setSuccess("Mouvement de stock enregistré avec succès.");

      await loadData(false);
    } catch (err) {
      console.error("Erreur d'enregistrement du mouvement :", err);
      setError(
        err?.message ||
          "Erreur lors de l'enregistrement du mouvement."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !kiosk) {
    return (
      <div className="flex min-h-64 items-center justify-center text-gray-500">
        <RefreshCw className="mr-2 animate-spin" size={20} />
        Chargement du stock...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestion du stock
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {kiosk?.nom || "MonKiosk"} · Consultez vos quantités et suivez chaque mouvement.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>

          <button
            type="button"
            onClick={() => openModal()}
            disabled={activeProducts.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />
            Nouveau mouvement
          </button>
        </div>
      </div>

      {error && !showModal && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Fermer le message d'erreur"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            {success}
          </div>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Fermer le message de confirmation"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Produits actifs"
          value={number(stats.total)}
          detail={`${number(stats.totalUnits)} unités en stock`}
          icon={Package}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Valeur du stock"
          value={money(stats.stockValue, devise)}
          detail="Calculée au prix d'achat"
          icon={Boxes}
          color="bg-violet-50 text-violet-600"
        />
        <StatCard
          title="Stock faible"
          value={number(stats.lowStock)}
          detail="À réapprovisionner"
          icon={AlertTriangle}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="En rupture"
          value={number(stats.outOfStock)}
          detail="Stock nul ou négatif"
          icon={TrendingDown}
          color="bg-red-50 text-red-600"
        />
      </div>

      {/* Alertes */}
      {(stats.lowStock > 0 || stats.outOfStock > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.outOfStock > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-800">
                {stats.outOfStock} produit(s) en rupture
              </p>
              <p className="mt-1 text-sm text-red-700">
                Enregistrez une entrée pour réapprovisionner ces produits.
              </p>
            </div>
          )}
          {stats.lowStock > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-800">
                {stats.lowStock} produit(s) à surveiller
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Le stock est inférieur ou égal au seuil minimum.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Onglets */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("stock")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            tab === "stock"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <Boxes size={16} className="mr-2 inline" />
          État du stock
        </button>

        <button
          type="button"
          onClick={() => setTab("mouvements")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            tab === "mouvements"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <ClipboardList size={16} className="mr-2 inline" />
          Historique ({movements.length})
        </button>
      </div>

      {/* Recherche et filtres */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un produit, une référence ou un motif..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {tab === "stock" ? (
          <>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="tous">Toutes les catégories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nom}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="tous">Tous les stocks</option>
              <option value="normal">Stock normal</option>
              <option value="faible">Stock faible</option>
              <option value="rupture">En rupture</option>
            </select>
          </>
        ) : (
          <select
            value={movementFilter}
            onChange={(event) => setMovementFilter(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="tous">Tous les mouvements</option>
            <option value="entree">Entrées</option>
            <option value="sortie">Sorties manuelles</option>
            <option value="ajustement">Ajustements</option>
            <option value="sortie_vente">Sorties de vente</option>
          </select>
        )}
      </div>

      {/* Tableau des produits */}
      {tab === "stock" ? (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Produit</th>
                  <th className="px-5 py-4 font-semibold">Catégorie</th>
                  <th className="px-5 py-4 font-semibold">Stock actuel</th>
                  <th className="px-5 py-4 font-semibold">Seuil minimum</th>
                  <th className="px-5 py-4 font-semibold">Valeur du stock</th>
                  <th className="px-5 py-4 font-semibold">État</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => {
                  const stock = Number(product.stock_actuel || 0);
                  const minimum = Number(product.stock_minimum || 0);
                  const status = getStatus(product);
                  const ratio =
                    minimum > 0
                      ? Math.min(100, (stock / minimum) * 100)
                      : stock > 0
                        ? 100
                        : 0;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Package size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {product.nom}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {product.reference || product.code_barres || "Sans référence"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {categoryMap.get(product.categorie_id) || "Sans catégorie"}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">
                          {number(stock)}{" "}
                          <span className="font-normal text-gray-500">
                            {product.unite || "unité"}
                          </span>
                        </p>
                        <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${
                              stock <= 0
                                ? "bg-red-500"
                                : stock <= minimum
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {number(minimum)} {product.unite || "unité"}
                      </td>

                      <td className="px-5 py-4 font-semibold text-gray-800">
                        {money(stock * Number(product.prix_achat || 0), devise)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            title="Entrée de stock"
                            onClick={() => openModal(product, "entree")}
                            className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"
                          >
                            <ArrowDownToLine size={17} />
                          </button>
                          <button
                            type="button"
                            title="Sortie de stock"
                            disabled={stock <= 0}
                            onClick={() => openModal(product, "sortie")}
                            className="rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowUpFromLine size={17} />
                          </button>
                          <button
                            type="button"
                            title="Ajuster le stock"
                            onClick={() => openModal(product, "ajustement")}
                            className="rounded-lg p-2 text-violet-700 hover:bg-violet-50"
                          >
                            <SlidersHorizontal size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-gray-500">
              Aucun produit ne correspond aux filtres.
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStockFilter("tous");
                  setCategoryFilter("tous");
                }}
                className="ml-2 font-semibold text-blue-600 hover:underline"
              >
                Réinitialiser
              </button>
            </div>
          )}

          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            {filteredProducts.length} produit(s) affiché(s) sur {products.length}.
          </div>
        </section>
      ) : (
        /* Historique des mouvements */
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Produit</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4 text-right">Variation</th>
                  <th className="px-5 py-4 text-right">Avant</th>
                  <th className="px-5 py-4 text-right">Après</th>
                  <th className="px-5 py-4">Motif</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredMovements.map((movement) => {
                  const product = productMap.get(movement.produit_id);
                  const variation = Number(movement.variation || 0);

                  return (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {dateFormat(movement.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {product?.nom || "Produit supprimé ou inaccessible"}
                        </p>
                        {product?.reference && (
                          <p className="mt-1 text-xs text-gray-500">
                            {product.reference}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {movementLabels[movement.type_mouvement] ||
                          movement.type_mouvement}
                      </td>
                      <td
                        className={`px-5 py-4 text-right font-semibold ${
                          variation > 0
                            ? "text-emerald-600"
                            : variation < 0
                              ? "text-red-600"
                              : "text-gray-600"
                        }`}
                      >
                        {variation > 0 ? "+" : ""}
                        {number(variation)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {number(movement.stock_avant)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium">
                        {number(movement.stock_apres)}
                      </td>
                      <td className="max-w-xs whitespace-normal px-5 py-4 text-gray-600">
                        {movement.motif || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredMovements.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-gray-500">
              Aucun mouvement trouvé.
            </div>
          )}

          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            {filteredMovements.length} mouvement(s) affiché(s). Les 300 derniers sont chargés.
          </div>
        </section>
      )}

      {/* Fenêtre de mouvement */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-modal-title"
            className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2
                  id="stock-modal-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Nouveau mouvement
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enregistrez une entrée, une sortie ou un ajustement.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Fermer"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="stock-product"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Produit
                </label>
                <select
                  id="stock-product"
                  required
                  value={form.produit_id}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      produit_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Sélectionner un produit</option>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.nom} — stock : {number(product.stock_actuel)}{" "}
                      {product.unite || "unité"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="rounded-xl bg-gray-50 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Stock actuel</span>
                    <strong className="text-gray-900">
                      {number(selectedProduct.stock_actuel)}{" "}
                      {selectedProduct.unite || "unité"}
                    </strong>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-gray-500">Stock minimum</span>
                    <span className="text-gray-700">
                      {number(selectedProduct.stock_minimum)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="stock-type"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Type d'opération
                </label>
                <select
                  id="stock-type"
                  value={form.type_mouvement}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      type_mouvement: event.target.value,
                      quantite: "",
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="entree">Entrée de stock</option>
                  <option value="sortie">Sortie manuelle</option>
                  <option value="ajustement">Ajustement après inventaire</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="stock-quantity"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  {form.type_mouvement === "ajustement"
                    ? "Quantité physique constatée"
                    : "Quantité"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  id="stock-quantity"
                  required
                  type="number"
                  min={form.type_mouvement === "ajustement" ? "0" : "0.001"}
                  step="any"
                  value={form.quantite}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      quantite: event.target.value,
                    }))
                  }
                  placeholder={
                    form.type_mouvement === "ajustement"
                      ? "Quantité totale constatée"
                      : "Ex. : 10"
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
                <p className="mt-2 text-xs text-gray-500">
                  {form.type_mouvement === "entree" &&
                    "La quantité saisie sera ajoutée au stock actuel."}
                  {form.type_mouvement === "sortie" &&
                    "La quantité saisie sera retirée du stock disponible."}
                  {form.type_mouvement === "ajustement" &&
                    "Saisissez le stock total réellement constaté, et non la différence. Zéro est autorisé."}
                </p>
              </div>

              {selectedProduct &&
                form.quantite !== "" &&
                Number.isFinite(Number(form.quantite)) &&
                Number(form.quantite) >= 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-800">
                      {form.type_mouvement === "ajustement"
                        ? "Stock après ajustement"
                        : "Stock après opération (estimation)"}
                    </p>
                    <p className="mt-1 text-lg font-bold text-blue-900">
                      {number(
                        form.type_mouvement === "entree"
                          ? Number(selectedProduct.stock_actuel || 0) +
                              Number(form.quantite)
                          : form.type_mouvement === "sortie"
                            ? Number(selectedProduct.stock_actuel || 0) -
                              Number(form.quantite)
                            : Number(form.quantite)
                      )}{" "}
                      <span className="text-sm font-medium">
                        {selectedProduct.unite || "unité"}
                      </span>
                    </p>
                  </div>
                )}

              <div>
                <label
                  htmlFor="stock-reason"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Motif de l'opération
                </label>
                <textarea
                  id="stock-reason"
                  required
                  rows={3}
                  value={form.motif}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      motif: event.target.value,
                    }))
                  }
                  placeholder={
                    form.type_mouvement === "entree"
                      ? "Ex. : Réapprovisionnement fournisseur"
                      : form.type_mouvement === "sortie"
                        ? "Ex. : Casse, perte ou sortie manuelle"
                        : "Ex. : Inventaire physique"
                  }
                  className="w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || activeProducts.length === 0}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Enregistrer le mouvement
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
