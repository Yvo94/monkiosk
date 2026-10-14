
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function NouvelleVentePage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [kiosk, setKiosk] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);

  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Charger la session, le kiosque et les produits disponibles.
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

      const { data: productData, error: productError } =
        await supabase
          .from("kiosque_produits")
          .select(
            "id, nom, reference, code_barres, unite, prix_vente, stock_actuel, stock_minimum, actif"
          )
          .eq("kiosque_id", kioskData.id)
          .eq("actif", true)
          .order("nom");

      if (productError) throw productError;

      setProducts(productData || []);
    } catch (err) {
      console.error("Erreur chargement nouvelle vente :", err);
      setError(err.message || "Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Rechercher par nom, référence ou code-barres.
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return [];

    return products
      .filter((product) => {
        return (
          product.nom?.toLowerCase().includes(term) ||
          product.reference?.toLowerCase().includes(term) ||
          String(product.code_barres || "")
            .toLowerCase()
            .includes(term)
        );
      })
      .slice(0, 12);
  }, [products, search]);

  // Calcul du montant total.
  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          Number(item.prix_vente) * Number(item.quantite),
        0
      ),
    [cart]
  );

  const paid = Number(amountPaid || 0);

  const change =
    paymentMethod === "credit"
      ? 0
      : Math.max(0, paid - total);

  const remaining =
    paymentMethod === "credit"
      ? Math.max(0, total - paid)
      : 0;

  // Ajouter un produit au panier.
  const addToCart = (product) => {
    setError("");
    setSuccess("");

    if (Number(product.stock_actuel) <= 0) {
      setError(`${product.nom} est en rupture de stock.`);
      return;
    }

    const existing = cart.find(
      (item) => item.id === product.id
    );

    if (
      existing &&
      Number(existing.quantite) + 1 >
        Number(product.stock_actuel)
    ) {
      setError(
        `Stock insuffisant pour ${product.nom}. Disponible : ${product.stock_actuel}.`
      );
      return;
    }

    setCart((current) => {
      const found = current.find(
        (item) => item.id === product.id
      );

      if (found) {
        return current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantite: Number(item.quantite) + 1,
              }
            : item
        );
      }

      return [...current, { ...product, quantite: 1 }];
    });

    setSearch("");
  };

  // Avec un scanner, la touche Entrée ajoute le premier résultat.
  const handleSearchKeyDown = (event) => {
    if (event.key !== "Enter") return;

    event.preventDefault();

    if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0]);
      return;
    }

    const exactMatch = filteredProducts.find((product) => {
      const term = search.trim().toLowerCase();

      return (
        product.reference?.toLowerCase() === term ||
        String(product.code_barres || "").toLowerCase() === term
      );
    });

    if (exactMatch) {
      addToCart(exactMatch);
    } else if (filteredProducts.length > 1) {
      setError(
        "Plusieurs produits correspondent. Sélectionnez le bon produit."
      );
    } else {
      setError("Aucun produit ne correspond à votre recherche.");
    }
  };

  // Modifier la quantité.
  const updateQuantity = (productId, value) => {
    const quantity = Number(value);
    const product = products.find(
      (item) => item.id === productId
    );

    if (
      !product ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
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

    setError("");
  };

  const resetSale = () => {
    setCart([]);
    setSearch("");
    setAmountPaid("");
    setNotes("");
    setPaymentMethod("especes");
  };

  // Enregistrer la vente via la fonction Supabase existante.
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

    if (!Number.isFinite(paid) || paid < 0) {
      setError("Veuillez saisir un montant payé valide.");
      return;
    }

    if (paymentMethod !== "credit" && paid < total) {
      setError(
        "Le montant reçu est inférieur au total de la vente."
      );
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
        `Vente ${data.numero} enregistrée avec succès. Total : ${formatMoney(data.montant_total)}.`
      );

      resetSale();

      // Actualiser les stocks après validation.
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

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-gray-500">
            Chargement du panier...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Nouvelle vente
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {kiosk?.nom || "MonKiosk"} — caisse principale
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard/ventes")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          ← Retour aux ventes
        </button>
      </div>

      {/* Messages */}
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

      {/* Recherche des produits */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="mb-1 text-lg font-bold text-gray-900">
          Ajouter un produit
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Recherchez par nom, référence ou code-barres.
        </p>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setError("");
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Nom, référence ou code-barres..."
            autoComplete="off"
            className="w-full rounded-xl border border-gray-200 py-3.5 pl-12 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {search.trim() !== "" && (
          <div className="mt-3 space-y-2">
            {filteredProducts.length === 0 ? (
              <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">
                Aucun produit trouvé.
              </p>
            ) : (
              filteredProducts.map((product) => {
                const outOfStock =
                  Number(product.stock_actuel) <= 0;

                return (
                  <div
                    key={product.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {product.nom}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Réf. : {product.reference || "—"}
                        {product.code_barres
                          ? ` • Code-barres : ${product.code_barres}`
                          : ""}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Stock : {product.stock_actuel}{" "}
                        {product.unite || "unité"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="font-bold text-emerald-700">
                        {formatMoney(product.prix_vente)}
                      </span>

                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => addToCart(product)}
                        className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {outOfStock ? "Épuisé" : "Ajouter +"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Panier */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              <span className="mr-2" aria-hidden="true">
                🛒
              </span>
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
              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Vider le panier
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="px-4 py-12 text-center sm:py-16">
            <div className="mb-3 text-5xl" aria-hidden="true">
              🛒
            </div>
            <p className="font-semibold text-gray-700">
              Votre panier est vide
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Recherchez un produit ci-dessus pour commencer.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cart.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {item.nom}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatMoney(item.prix_vente)} /{" "}
                      {item.unite || "unité"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (Number(item.quantite) <= 1) {
                            removeFromCart(item.id);
                          } else {
                            updateQuantity(
                              item.id,
                              Number(item.quantite) - 1
                            );
                          }
                        }}
                        className="h-10 w-10 rounded-lg border border-gray-200 font-semibold hover:bg-gray-50"
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
                        className="w-20 rounded-lg border border-gray-200 px-2 py-2.5 text-center text-sm outline-none focus:border-emerald-500"
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
                        className="h-10 w-10 rounded-lg border border-gray-200 font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Augmenter ${item.nom}`}
                      >
                        +
                      </button>
                    </div>

                    <p className="min-w-28 text-right font-bold text-gray-900">
                      {formatMoney(
                        Number(item.prix_vente) *
                          Number(item.quantite)
                      )}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="rounded-lg px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paiement et total */}
        <div className="space-y-5 border-t border-gray-200 bg-gray-50/70 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-medium text-gray-600">
              Total à payer
            </span>
            <span className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              {formatMoney(total)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="paymentMethod"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Mode de paiement
              </label>

              <select
                id="paymentMethod"
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
              <label
                htmlFor="amountPaid"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                {paymentMethod === "credit"
                  ? "Montant déjà payé"
                  : "Montant reçu"}
              </label>

              <input
                id="amountPaid"
                type="number"
                min="0"
                step="1"
                value={amountPaid}
                onChange={(event) =>
                  setAmountPaid(event.target.value)
                }
                placeholder={String(total)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />

              {paymentMethod !== "credit" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAmountPaid(String(total))}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
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
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50"
                      >
                        {amount.toLocaleString("fr-FR")}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {paymentMethod === "credit" ? (
            <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 p-4">
              <span className="text-sm font-semibold text-amber-800">
                Reste à payer
              </span>
              <span className="text-lg font-bold text-amber-900">
                {formatMoney(remaining)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <span className="text-sm font-semibold text-emerald-800">
                Monnaie à rendre
              </span>
              <span className="text-lg font-bold text-emerald-900">
                {formatMoney(change)}
              </span>
            </div>
          )}

          <div>
            <label
              htmlFor="saleNotes"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Note (facultatif)
            </label>

            <textarea
              id="saleNotes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Commentaire sur la vente..."
              className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={submitSale}
            disabled={
              submitting ||
              cart.length === 0 ||
              (paymentMethod !== "credit" && paid < total) ||
              (paymentMethod === "credit" && paid > total)
            }
            className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-base font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Enregistrement en cours..."
              : `Valider la vente — ${formatMoney(total)}`}
          </button>

          <p className="text-center text-xs text-gray-500">
            Le stock sera actualisé après validation de la vente.
          </p>
        </div>
      </section>
    </div>
  );
}
