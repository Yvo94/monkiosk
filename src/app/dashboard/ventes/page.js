
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const paymentLabels = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  carte: "Carte bancaire",
  virement: "Virement",
  credit: "Crédit",
};

export default function VentesPage() {
  const [user, setUser] = useState(null);
  const [kiosk, setKiosk] = useState(null);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("toutes");
  const [categories, setCategories] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("vente");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authUser) {
        throw new Error(
          "Votre session a expiré. Veuillez vous reconnecter."
        );
      }

      setUser(authUser);

      const { data: kioskData, error: kioskError } = await supabase
        .from("kiosques")
        .select("id, nom, devise")
        .eq("owner_id", authUser.id)
        .eq("actif", true)
        .maybeSingle();

      if (kioskError) throw kioskError;

      if (!kioskData) {
        throw new Error(
          "Aucun kiosque actif n'est associé à votre compte."
        );
      }

      setKiosk(kioskData);

      const [
        { data: productData, error: productError },
        { data: categoryData, error: categoryError },
        { data: salesData, error: salesError },
      ] = await Promise.all([
        supabase
          .from("kiosque_produits")
          .select(
            "id, nom, reference, code_barres, unite, prix_achat, prix_vente, stock_actuel, stock_minimum, categorie_id, actif"
          )
          .eq("kiosque_id", kioskData.id)
          .eq("actif", true)
          .order("nom"),

        supabase
          .from("kiosque_categories")
          .select("id, nom")
          .eq("kiosque_id", kioskData.id)
          .eq("actif", true)
          .order("nom"),

        supabase
          .from("kiosque_ventes")
          .select(
            "id, numero, date_vente, statut, mode_paiement, montant_total, montant_paye, montant_rendu, notes"
          )
          .eq("kiosque_id", kioskData.id)
          .order("date_vente", { ascending: false })
          .limit(30),
      ]);

      if (productError) throw productError;
      if (categoryError) throw categoryError;
      if (salesError) throw salesError;

      setProducts(productData || []);
      setCategories(categoryData || []);
      setSales(salesData || []);
    } catch (err) {
      console.error("Erreur chargement ventes :", err);
      setError(err.message || "Impossible de charger les données.");
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
        categoryFilter === "toutes" ||
        product.categorie_id === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + Number(item.prix_vente) * Number(item.quantite),
        0
      ),
    [cart]
  );

  const paid = Number(amountPaid || 0);

  const change =
    paymentMethod === "credit" ? 0 : Math.max(0, paid - total);

  const remaining =
    paymentMethod === "credit" ? Math.max(0, total - paid) : 0;

  const addToCart = (product) => {
    setError("");
    setSuccess("");

    if (Number(product.stock_actuel) <= 0) {
      setError(`${product.nom} est en rupture de stock.`);
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.id === product.id
      );

      if (existing) {
        if (
          Number(existing.quantite) + 1 >
          Number(product.stock_actuel)
        ) {
          setError(
            `Stock insuffisant pour ${product.nom}. Disponible : ${product.stock_actuel}.`
          );
          return current;
        }

        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantite: Number(item.quantite) + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          ...product,
          quantite: 1,
        },
      ];
    });
  };

  const updateQuantity = (productId, value) => {
    const product = products.find((item) => item.id === productId);
    const quantity = Number(value);

    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (quantity > Number(product.stock_actuel)) {
      setError(
        `Stock insuffisant pour ${product.nom}. Disponible : ${product.stock_actuel}.`
      );
      return;
    }

    setError("");

    setCart((current) =>
      current.map((item) =>
        item.id === productId
          ? { ...item, quantite: quantity }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((current) =>
      current.filter((item) => item.id !== productId)
    );
  };

  const resetSale = () => {
    setCart([]);
    setAmountPaid("");
    setNotes("");
    setPaymentMethod("especes");
  };

  const submitSale = async () => {
    setError("");
    setSuccess("");

    if (!user || !kiosk) {
      setError("Votre session ou votre kiosque est introuvable.");
      return;
    }

    if (cart.length === 0) {
      setError("Ajoutez au moins un produit au panier.");
      return;
    }

    if (paymentMethod !== "credit" && paid < total) {
      setError("Le montant reçu est inférieur au total de la vente.");
      return;
    }

    if (paymentMethod === "credit" && paid > total) {
      setError(
        "Pour une vente à crédit, le montant payé ne peut dépasser le total."
      );
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: saleError } = await supabase.rpc(
        "monkiosk_valider_vente",
        {
          p_kiosque_id: kiosk.id,
          p_items: cart.map((item) => ({
            produit_id: item.id,
            quantite: Number(item.quantite),
          })),
          p_mode_paiement: paymentMethod,
          p_montant_paye: paid,
          p_notes: notes.trim() || null,
        }
      );

      if (saleError) throw saleError;

      if (!data?.success) {
        throw new Error(
          data?.message || "La vente n'a pas pu être validée."
        );
      }

      setSuccess(
        `Vente ${data.numero} enregistrée. Total : ${formatMoney(data.montant_total)}.`
      );

      resetSale();
      await loadData();
    } catch (err) {
      console.error("Erreur validation vente :", err);
      setError(
        err.message ||
          "Une erreur est survenue lors de la validation de la vente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const todaySales = useMemo(() => {
    const today = new Date();

    return sales.filter((sale) => {
      const date = new Date(sale.date_vente);

      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate() &&
        sale.statut === "terminee"
      );
    });
  }, [sales]);

  const todayTotal = todaySales.reduce(
    (sum, sale) => sum + Number(sale.montant_total || 0),
    0
  );

  const todayCount = todaySales.length;

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-gray-500">
            Chargement de la caisse...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ventes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {kiosk?.nom || "MonKiosk"} — caisse principale
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Actualiser
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="font-bold"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="font-bold"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Ventes aujourd'hui</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {todayCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Chiffre d'affaires du jour
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatMoney(todayTotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Produits disponibles</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {products.length}
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("vente")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            activeTab === "vente"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          Nouvelle vente
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("historique")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${
            activeTab === "historique"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          Historique
        </button>
      </div>

      {activeTab === "vente" ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Catalogue des produits
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Sélectionnez un produit pour l'ajouter au panier.
              </p>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un produit, une référence..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500"
              >
                <option value="toutes">Toutes les catégories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nom}
                  </option>
                ))}
              </select>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-8 text-center">
                <p className="font-medium text-gray-700">
                  Aucun produit trouvé
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Modifiez votre recherche ou vérifiez votre catalogue.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredProducts.map((product) => {
                  const outOfStock =
                    Number(product.stock_actuel) <= 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={outOfStock}
                      onClick={() => addToCart(product)}
                      className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">
                            {product.nom}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {product.reference || "Sans référence"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                            outOfStock
                              ? "bg-red-100 text-red-700"
                              : Number(product.stock_actuel) <=
                                  Number(product.stock_minimum)
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          Stock {product.stock_actuel}
                        </span>
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-lg font-bold text-emerald-700">
                            {formatMoney(product.prix_vente)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Par {product.unite || "unité"}
                          </p>
                        </div>

                        <span className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white">
                          Ajouter +
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Panier
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {cart.length} article(s) différent(s)
                </p>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={resetSale}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Vider
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="rounded-xl bg-gray-50 px-4 py-10 text-center">
                <div className="mb-3 text-3xl">🛒</div>
                <p className="font-medium text-gray-700">
                  Votre panier est vide
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Cliquez sur un produit pour commencer la vente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-100 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          {item.nom}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {formatMoney(item.prix_vente)} /{" "}
                          {item.unite || "unité"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-sm font-medium text-red-600"
                      >
                        Retirer
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              Number(item.quantite) - 1
                            )
                          }
                          className="h-9 w-9 rounded-lg border border-gray-200 font-semibold"
                          aria-label={`Diminuer ${item.nom}`}
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min="0.001"
                          max={item.stock_actuel}
                          step="any"
                          value={item.quantite}
                          onChange={(event) =>
                            updateQuantity(
                              item.id,
                              event.target.value
                            )
                          }
                          className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm"
                          aria-label={`Quantité de ${item.nom}`}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              Number(item.quantite) + 1
                            )
                          }
                          disabled={
                            Number(item.quantite) >=
                            Number(item.stock_actuel)
                          }
                          className="h-9 w-9 rounded-lg border border-gray-200 font-semibold disabled:opacity-40"
                          aria-label={`Augmenter ${item.nom}`}
                        >
                          +
                        </button>
                      </div>

                      <p className="font-bold text-gray-900">
                        {formatMoney(
                          Number(item.prix_vente) *
                            Number(item.quantite)
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 space-y-4 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Total à payer
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatMoney(total)}
                </span>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Mode de paiement
                </label>

                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="especes">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="carte">Carte bancaire</option>
                  <option value="virement">Virement</option>
                  <option value="credit">Crédit</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {paymentMethod === "credit"
                    ? "Montant déjà payé"
                    : "Montant reçu"}
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amountPaid}
                  onChange={(event) =>
                    setAmountPaid(event.target.value)
                  }
                  placeholder={
                    paymentMethod === "credit"
                      ? "0"
                      : String(total)
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                {paymentMethod !== "credit" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAmountPaid(String(total))}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                    >
                      Montant exact
                    </button>

                    {[500, 1000, 2000, 5000, 10000].map(
                      (amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() =>
                            setAmountPaid(String(amount))
                          }
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                        >
                          {amount.toLocaleString("fr-FR")}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {paymentMethod === "credit" ? (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3">
                  <span className="text-sm font-medium text-amber-800">
                    Reste à payer
                  </span>
                  <span className="font-bold text-amber-900">
                    {formatMoney(remaining)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3">
                  <span className="text-sm font-medium text-emerald-800">
                    Monnaie à rendre
                  </span>
                  <span className="font-bold text-emerald-900">
                    {formatMoney(change)}
                  </span>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Note (facultatif)
                </label>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Commentaire sur la vente..."
                  className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={submitSale}
                disabled={
                  submitting ||
                  cart.length === 0 ||
                  (paymentMethod !== "credit" && paid < total)
                }
                className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Enregistrement en cours..."
                  : "Valider et enregistrer la vente"}
              </button>

              <p className="text-center text-xs text-gray-500">
                Le stock sera mis à jour après validation.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Historique des ventes
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Les 30 ventes les plus récentes.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Actualiser
            </button>
          </div>

          {sales.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              Aucune vente enregistrée pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">N° vente</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Paiement</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Total
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Payé
                    </th>
                    <th className="px-5 py-3 font-semibold">Statut</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                        {sale.numero}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {formatDate(sale.date_vente)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {paymentLabels[sale.mode_paiement] ||
                          sale.mode_paiement}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-900">
                        {formatMoney(sale.montant_total)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600">
                        {formatMoney(sale.montant_paye)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            sale.statut === "terminee"
                              ? "bg-emerald-100 text-emerald-700"
                              : sale.statut === "annulee"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {sale.statut === "terminee"
                            ? "Terminée"
                            : sale.statut === "annulee"
                              ? "Annulée"
                              : "Brouillon"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
