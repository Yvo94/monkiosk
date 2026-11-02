"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package,
  Boxes,
  AlertTriangle,
  CircleAlert,
  RefreshCw,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Filter,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

const money = (value, devise = "FCFA") =>
  `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0))} ${devise}`;

const formatDate = (value) => {
  if (!value) return "Date inconnue";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date inconnue";

  return date.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export default function StockPage() {
  const [kiosk, setKiosk] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movementError, setMovementError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setMovementError("");

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

      // Historique facultatif : le schéma exact des mouvements
      // devra être vérifié avant d'ajouter des opérations d'écriture.
      const movementResult = await supabase
        .from("kiosque_mouvements_stock")
        .select("*")
        .eq("kiosque_id", kioskData.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (movementResult.error) {
        console.warn(
          "Historique des mouvements indisponible :",
          movementResult.error
        );
        setMovements([]);
        setMovementError(
          "L'historique n'est pas disponible. Vérifie les colonnes et les politiques RLS de kiosque_mouvements_stock."
        );
      } else {
        setMovements(movementResult.data || []);
      }
    } catch (err) {
      console.error("Erreur chargement stock :", err);
      setError(err.message || "Impossible de charger le stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.actif);

    const outOfStock = active.filter(
      (p) => Number(p.stock_actuel || 0) <= 0
    );

    const lowStock = active.filter(
      (p) =>
        Number(p.stock_actuel || 0) > 0 &&
        Number(p.stock_actuel || 0) <=
          Number(p.stock_minimum || 0)
    );

    const stockValue = active.reduce(
      (sum, p) =>
        sum +
        Number(p.prix_achat || 0) *
          Number(p.stock_actuel || 0),
      0
    );

    const totalUnits = active.reduce(
      (sum, p) => sum + Number(p.stock_actuel || 0),
      0
    );

    return {
      totalProducts: active.length,
      totalUnits,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      stockValue,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((p) => {
      const stock = Number(p.stock_actuel || 0);
      const minimum = Number(p.stock_minimum || 0);

      const matchesSearch =
        !term ||
        p.nom?.toLowerCase().includes(term) ||
        p.reference?.toLowerCase().includes(term) ||
        p.code_barres?.toLowerCase().includes(term);

      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "none" && !p.categorie_id) ||
        p.categorie_id === categoryFilter;

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "available" &&
          p.actif &&
          stock > minimum) ||
        (stockFilter === "low" &&
          p.actif &&
          stock > 0 &&
          stock <= minimum) ||
        (stockFilter === "empty" &&
          p.actif &&
          stock <= 0) ||
        (stockFilter === "inactive" && !p.actif);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, categoryFilter, stockFilter]);

  function getCategoryName(id) {
    if (!id) return "Sans catégorie";

    return (
      categories.find((c) => c.id === id)?.nom ||
      "Catégorie indisponible"
    );
  }

  function getStatus(product) {
    const stock = Number(product.stock_actuel || 0);
    const minimum = Number(product.stock_minimum || 0);

    if (!product.actif) {
      return {
        label: "Inactif",
        className: "bg-gray-100 text-gray-600",
      };
    }

    if (stock <= 0) {
      return {
        label: "Rupture",
        className: "bg-red-100 text-red-700",
      };
    }

    if (stock <= minimum) {
      return {
        label: "Stock faible",
        className: "bg-amber-100 text-amber-800",
      };
    }

    return {
      label: "Disponible",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  function getMovementType(movement) {
    const raw = String(
      movement.type ||
        movement.type_mouvement ||
        movement.motif ||
        movement.operation ||
        ""
    ).toLowerCase();

    if (
      raw.includes("entrée") ||
      raw.includes("entree") ||
      raw.includes("achat") ||
      raw.includes("appro")
    ) {
      return "in";
    }

    if (
      raw.includes("sortie") ||
      raw.includes("vente") ||
      raw.includes("perte")
    ) {
      return "out";
    }

    const quantity = Number(
      movement.quantite ??
        movement.quantite_mouvement ??
        movement.quantite_changee ??
        0
    );

    return quantity < 0 ? "out" : "in";
  }

  function getMovementLabel(movement) {
    return (
      movement.type ||
      movement.type_mouvement ||
      movement.motif ||
      movement.operation ||
      "Mouvement de stock"
    );
  }

  function getMovementQuantity(movement) {
    const quantity = Number(
      movement.quantite ??
        movement.quantite_mouvement ??
        movement.quantite_changee ??
        0
    );

    return Math.abs(quantity);
  }

  if (loading && !kiosk) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Chargement du stock...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {kiosk?.nom || "MonKiosk"} / Inventaire
          </p>

          <h1 className="mt-1 text-2xl font-bold text-[#17243A] md:text-3xl">
            Gestion du stock
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Suis les quantités disponibles, les alertes et les mouvements de stock.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="flex-1 break-words">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Indicateurs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Produits actifs"
          value={stats.totalProducts}
          detail={`${stats.totalUnits} unités au total`}
          color="blue"
        />

        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Stocks faibles"
          value={stats.lowStock}
          detail="À réapprovisionner"
          color="orange"
        />

        <StatCard
          icon={<CircleAlert className="h-5 w-5" />}
          label="Produits en rupture"
          value={stats.outOfStock}
          detail="Stock nul ou négatif"
          color="red"
        />

        <StatCard
          icon={<Boxes className="h-5 w-5" />}
          label="Valeur du stock"
          value={money(stats.stockValue, kiosk?.devise || "FCFA")}
          detail="Calculée au prix d'achat"
          color="green"
        />
      </div>

      {/* Alertes */}
      {(stats.lowStock > 0 || stats.outOfStock > 0) && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="flex-1">
              <h2 className="font-bold text-amber-950">
                Attention à ton stock
              </h2>

              <p className="mt-1 text-sm text-amber-900">
                {stats.outOfStock > 0 &&
                  `${stats.outOfStock} produit(s) en rupture. `}
                {stats.lowStock > 0 &&
                  `${stats.lowStock} produit(s) au seuil d'alerte ou en dessous.`}
              </p>

              <button
                type="button"
                onClick={() => setStockFilter("low")}
                className="mt-3 text-sm font-semibold text-amber-900 underline underline-offset-4"
              >
                Voir les stocks faibles
              </button>

              {stats.outOfStock > 0 && (
                <button
                  type="button"
                  onClick={() => setStockFilter("empty")}
                  className="ml-4 mt-3 text-sm font-semibold text-red-700 underline underline-offset-4"
                >
                  Voir les ruptures
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tableau des stocks */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#17243A]">
              État des stocks
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Quantités et seuils d'alerte par produit.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit, une référence..."
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-8 text-sm outline-none focus:border-blue-500 sm:min-w-48"
              >
                <option value="all">Toutes les catégories</option>
                <option value="none">Sans catégorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nom}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">Tous les états</option>
              <option value="available">Disponible</option>
              <option value="low">Stock faible</option>
              <option value="empty">En rupture</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-sm text-gray-500">
          <span>{filteredProducts.length} produit(s)</span>
          <span>{kiosk?.devise || "FCFA"}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Produit</th>
                <th className="px-5 py-4 font-semibold">Catégorie</th>
                <th className="px-5 py-4 font-semibold">Quantité</th>
                <th className="px-5 py-4 font-semibold">Seuil minimum</th>
                <th className="px-5 py-4 font-semibold">Valeur du stock</th>
                <th className="px-5 py-4 font-semibold">État</th>
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
                          <Package className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="font-semibold text-gray-900">
                            {product.nom}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {product.reference || "Sans référence"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {getCategoryName(product.categorie_id)}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-bold text-gray-900">
                        {stock}{" "}
                        <span className="font-normal text-gray-500">
                          {product.unite || "unité"}
                        </span>
                      </p>

                      <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
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
                      {minimum} {product.unite || "unité"}
                    </td>

                    <td className="px-5 py-4 font-semibold text-gray-800">
                      {money(
                        stock * Number(product.prix_achat || 0),
                        kiosk?.devise || "FCFA"
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center px-5 py-14 text-center">
              <Package className="h-10 w-10 text-gray-300" />
              <h3 className="mt-3 font-semibold text-gray-900">
                Aucun produit trouvé
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Modifie les filtres ou ajoute des produits dans le catalogue.
              </p>

              {(search || categoryFilter !== "all" || stockFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                    setStockFilter("all");
                  }}
                  className="mt-4 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Historique */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-[#17243A]">
              Mouvements récents
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Les derniers mouvements enregistrés dans la base.
            </p>
          </div>
        </div>

        {movementError ? (
          <p className="p-5 text-sm text-amber-800">{movementError}</p>
        ) : movements.length === 0 ? (
          <div className="p-8 text-center">
            <History className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 font-medium text-gray-700">
              Aucun mouvement à afficher
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Les mouvements apparaîtront ici lorsqu'ils seront enregistrés.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {movements.map((movement, index) => {
              const type = getMovementType(movement);

              return (
                <div
                  key={movement.id || index}
                  className="flex items-center gap-3 px-5 py-4"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      type === "in"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-orange-50 text-orange-700"
                    }`}
                  >
                    {type === "in" ? (
                      <ArrowDownToLine className="h-5 w-5" />
                    ) : (
                      <ArrowUpFromLine className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {getMovementLabel(movement)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(
                        movement.created_at ||
                          movement.date_mouvement ||
                          movement.created_on
                      )}
                    </p>
                  </div>

                  <p
                    className={`whitespace-nowrap font-bold ${
                      type === "in"
                        ? "text-emerald-700"
                        : "text-orange-700"
                    }`}
                  >
                    {type === "in" ? "+" : "−"}
                    {getMovementQuantity(movement)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, detail, color }) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    green: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-3 break-words text-2xl font-bold text-gray-900">
            {value}
          </p>
          <p className="mt-2 text-xs text-gray-500">{detail}</p>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${styles[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}