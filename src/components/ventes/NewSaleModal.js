
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  X,
  ShoppingCart,
  Trash2,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Package,
  CreditCard,
  RefreshCw,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const PAYMENT_OPTIONS = [
  { value: "especes", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement" },
  { value: "credit", label: "Crédit" },
];

export default function NewSaleModal({
  open,
  onClose,
  onSaved,
}) {
  const [kiosk, setKiosk] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error(
          "Votre session a expiré. Veuillez vous reconnecter."
        );
      }

      const { data: kioskData, error: kioskError } =
        await supabase
          .from("kiosques")
          .select("id, nom, devise")
          .eq("owner_id", user.id)
          .eq("actif", true)
          .maybeSingle();

      if (kioskError) throw kioskError;

      if (!kioskData) {
        throw new Error(
          "Aucun kiosque actif n'est associé à votre compte."
        );
      }

      setKiosk(kioskData);

      const { data, error: productsError } = await supabase
        .from("kiosque_produits")
        .select(
          "id, nom, reference, code_barres, unite, prix_vente, stock_actuel, stock_minimum, actif"
        )
        .eq("kiosque_id", kioskData.id)
        .eq("actif", true)
        .order("nom", { ascending: true });

      if (productsError) throw productsError;

      setProducts(data || []);
    } catch (err) {
      console.error("Erreur chargement nouvelle vente :", err);
      setError(
        err.message || "Impossible de charger les produits."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setCart([]);
      setSearch("");
      setPaymentMethod("especes");
      setPaidAmount("");
      setNotes("");
      setError("");
      loadProducts();
    }
  }, [open, loadProducts]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return products.slice(0, 30);

    return products
      .filter((product) =>
        [
          product.nom,
          product.reference,
          product.code_barres,
        ].some((value) =>
          value?.toLowerCase().includes(term)
        )
      )
      .slice(0, 30);
  }, [products, search]);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          Number(item.prix_vente || 0) *
            Number(item.quantite || 0),
        0
      ),
    [cart]
  );

  const paid = Math.max(0, Number(paidAmount || 0));

  const change =
    paymentMethod !== "credit"
      ? Math.max(0, paid - total)
      : 0;

  const remaining =
    paymentMethod === "credit"
      ? Math.max(0, total - paid)
      : 0;

  function closeModal() {
    if (saving) return;

    setError("");
    onClose?.();
  }

  function addToCart(product) {
    setError("");

    if (Number(product.stock_actuel) <= 0) {
      setError(
        `Le produit « ${product.nom} » est en rupture de stock.`
      );
      return;
    }

    setCart((previous) => {
      const existing = previous.find(
        (item) => item.id === product.id
      );

      if (existing) {
        if (
          Number(existing.quantite) + 1 >
          Number(product.stock_actuel)
        ) {
          setError(
            `Stock insuffisant pour « ${product.nom} ». Stock disponible : ${product.stock_actuel}.`
          );
          return previous;
        }

        return previous.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantite: Number(item.quantite) + 1,
              }
            : item
        );
      }

      return [
        ...previous,
        {
          id: product.id,
          nom: product.nom,
          reference: product.reference,
          unite: product.unite || "unité",
          prix_vente: Number(product.prix_vente || 0),
          stock_actuel: Number(product.stock_actuel || 0),
          quantite: 1,
        },
      ];
    });
  }

  function removeFromCart(productId) {
    setCart((previous) =>
      previous.filter((item) => item.id !== productId)
    );
    setError("");
  }

  function updateQuantity(productId, quantity) {
    const value = Number(quantity);

    if (!Number.isFinite(value) || value <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((previous) =>
      previous.map((item) => {
        if (item.id !== productId) return item;

        if (value > Number(item.stock_actuel)) {
          setError(
            `Stock insuffisant pour « ${item.nom} ». Stock disponible : ${item.stock_actuel}.`
          );
          return item;
        }

        setError("");

        return {
          ...item,
          quantite: value,
        };
      })
    );
  }

  async function handleSubmitSale(event) {
    event.preventDefault();
    setError("");

    if (!kiosk) {
      setError("Aucun kiosque sélectionné.");
      return;
    }

    if (cart.length === 0) {
      setError("Ajoute au moins un produit au panier.");
      return;
    }

    for (const item of cart) {
      if (
        !Number.isFinite(Number(item.quantite)) ||
        Number(item.quantite) <= 0
      ) {
        setError(`Quantité invalide pour « ${item.nom} ».`);
        return;
      }

      if (
        Number(item.quantite) > Number(item.stock_actuel)
      ) {
        setError(`Stock insuffisant pour « ${item.nom} ».`);
        return;
      }
    }

    if (!Number.isFinite(paid) || paid < 0) {
      setError("Le montant payé doit être positif ou nul.");
      return;
    }

    if (paymentMethod !== "credit" && paid < total) {
      setError(
        "Le montant payé doit être supérieur ou égal au total de la vente."
      );
      return;
    }

    if (paymentMethod === "credit" && paid > total) {
      setError(
        "Pour une vente à crédit, le montant payé ne peut pas dépasser le total."
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
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

      if (rpcError) throw rpcError;

      const result = Array.isArray(data) ? data[0] : data;

      if (
        !result ||
        result.success !== true ||
        !result.numero
      ) {
        throw new Error(
          result?.message ||
            "La vente n'a pas pu être confirmée."
        );
      }

      setCart([]);
      setSearch("");
      setPaidAmount("");
      setNotes("");

      onClose?.();
      await onSaved?.(result);
    } catch (err) {
      console.error("Erreur validation vente :", err);
      setError(
        err.message || "Impossible d'enregistrer cette vente."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-gray-950/60 p-3 py-5 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div className="my-auto flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShoppingCart className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Nouvelle vente
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {kiosk?.nom || "MonKiosk"} — sélectionne les produits.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Fermer la fenêtre"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmitSale}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="break-words">{error}</p>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="ml-auto"
                  aria-label="Fermer l'erreur"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
                  <p className="mt-3 text-sm text-gray-500">
                    Chargement des produits...
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Rechercher un produit
                  </label>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      autoFocus
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Nom, référence ou code-barres..."
                      className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {filteredProducts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                        <Package className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-2 text-sm font-medium text-gray-600">
                          Aucun produit trouvé
                        </p>
                      </div>
                    ) : (
                      filteredProducts.map((product) => {
                        const outOfStock =
                          Number(product.stock_actuel) <= 0;

                        return (
                          <button
                            type="button"
                            key={product.id}
                            disabled={outOfStock || saving}
                            onClick={() => addToCart(product)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                                <Package className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">
                                  {product.nom}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {product.reference || "Sans référence"}
                                  {" · "}Stock : {product.stock_actuel}
                                </p>
                                <p className="mt-1 text-sm font-bold text-emerald-700">
                                  {formatMoney(product.prix_vente)}
                                </p>
                                {outOfStock && (
                                  <p className="mt-1 text-xs text-red-600">
                                    Rupture de stock
                                  </p>
                                )}
                              </div>
                            </div>
                            <Plus className="h-5 w-5 shrink-0 text-emerald-600" />
                          </button>
                        );
                      })
                    )}
                  </div>

                  <p className="mt-3 text-xs text-gray-400">
                    {products.length} produit(s) actif(s).
                  </p>
                </div>

                <div className="lg:col-span-3">
                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-emerald-700" />
                        <h3 className="font-bold text-gray-900">Panier</h3>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {cart.reduce(
                          (sum, item) => sum + Number(item.quantite),
                          0
                        )} article(s)
                      </span>
                    </div>

                    {cart.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <ShoppingCart className="mx-auto h-10 w-10 text-gray-300" />
                        <p className="mt-3 font-medium text-gray-600">
                          Ton panier est vide
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          Clique sur un produit pour l'ajouter.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="sticky top-0 bg-white text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-3 py-3 font-semibold">Article</th>
                              <th className="px-2 py-3 text-center font-semibold">Qté</th>
                              <th className="px-3 py-3 text-right font-semibold">Total</th>
                              <th className="px-2 py-3" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {cart.map((item) => (
                              <tr key={item.id}>
                                <td className="px-3 py-3">
                                  <p className="font-medium text-gray-900">
                                    {item.nom}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {formatMoney(item.prix_vente)} / {item.unite}
                                  </p>
                                </td>
                                <td className="px-2 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() =>
                                        updateQuantity(
                                          item.id,
                                          Number(item.quantite) - 1
                                        )
                                      }
                                      className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-100 disabled:opacity-50"
                                      aria-label={`Diminuer la quantité de ${item.nom}`}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      max={item.stock_actuel}
                                      step="1"
                                      value={item.quantite}
                                      disabled={saving}
                                      onChange={(event) =>
                                        updateQuantity(
                                          item.id,
                                          event.target.value
                                        )
                                      }
                                      className="w-12 rounded-lg border border-gray-200 px-1 py-1.5 text-center text-sm"
                                      aria-label={`Quantité de ${item.nom}`}
                                    />
                                    <button
                                      type="button"
                                      disabled={
                                        saving ||
                                        Number(item.quantite) >=
                                          Number(item.stock_actuel)
                                      }
                                      onClick={() =>
                                        updateQuantity(
                                          item.id,
                                          Number(item.quantite) + 1
                                        )
                                      }
                                      className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-100 disabled:opacity-50"
                                      aria-label={`Augmenter la quantité de ${item.nom}`}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-900">
                                  {formatMoney(
                                    Number(item.prix_vente) *
                                      Number(item.quantite)
                                  )}
                                </td>
                                <td className="px-2 py-3">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => removeFromCart(item.id)}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    aria-label={`Supprimer ${item.nom} du panier`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">
                          Total à payer
                        </span>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatMoney(total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-gray-200 p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-emerald-700" />
                      <h3 className="font-bold text-gray-900">Paiement</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Mode de paiement
                        </label>
                        <select
                          value={paymentMethod}
                          disabled={saving}
                          onChange={(event) => {
                            setPaymentMethod(event.target.value);
                            setPaidAmount("");
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                        >
                          {PAYMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          {paymentMethod === "credit"
                            ? "Montant versé (FCFA)"
                            : "Montant reçu (FCFA)"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={paidAmount}
                          disabled={saving}
                          onChange={(event) =>
                            setPaidAmount(event.target.value)
                          }
                          placeholder="0"
                          className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm"
                        />
                      </div>
                    </div>

                    {paymentMethod !== "credit" && (
                      <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                        <span className="text-sm font-medium text-emerald-800">
                          Monnaie à rendre
                        </span>
                        <span className="font-bold text-emerald-800">
                          {formatMoney(change)}
                        </span>
                      </div>
                    )}

                    {paymentMethod === "credit" && (
                      <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                        <span className="text-sm font-medium text-amber-800">
                          Reste à payer
                        </span>
                        <span className="font-bold text-amber-800">
                          {formatMoney(remaining)}
                        </span>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Notes (facultatif)
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        disabled={saving}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Commentaire sur la vente..."
                        className="w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={saving || loading || cart.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Valider la vente — {formatMoney(total)}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
