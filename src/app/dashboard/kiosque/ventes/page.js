"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  X,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Package,
  CreditCard,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

/* ============================================================
   OUTILS
============================================================ */

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
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_money: "MTN Money",
  moov_money: "Moov Money",
  carte: "Carte bancaire",
  virement: "Virement bancaire",
  autre: "Autre",
  credit: "Crédit",
  mixte: "Paiement mixte",
};

const statusLabels = {
  terminee: "Terminée",
  annulee: "Annulée",
  brouillon: "Brouillon",
};

/* Modes proposés pour les nouvelles ventes */
const PAYMENT_OPTIONS = [
  { value: "especes", label: "Espèces" },
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Money" },
  { value: "moov_money", label: "Moov Money" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement bancaire" },
  { value: "autre", label: "Autre" },
];

/* Modes disponibles dans les filtres de l'historique.
   Les anciens modes restent disponibles pour les ventes existantes. */
const HISTORY_PAYMENT_OPTIONS = [
  { value: "especes", label: "Espèces" },
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Money" },
  { value: "moov_money", label: "Moov Money" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement bancaire" },
  { value: "autre", label: "Autre" },
  { value: "credit", label: "Crédit" },
  { value: "mixte", label: "Paiement mixte" },
];

/* ============================================================
   PAGE VENTES
============================================================ */

export default function VentesPage() {
  const [kiosk, setKiosk] = useState(null);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);

  const [salesStats, setSalesStats] = useState({
    completedCount: 0,
    revenue: 0,
    cancelledCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fenêtre spéciale de nouvelle vente
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Filtres de l'historique des ventes
  const [paymentFilter, setPaymentFilter] = useState("tous");
  const [historySearch, setHistorySearch] = useState("");

  /* ============================================================
     CHARGEMENT DES DONNÉES
  ============================================================ */

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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

      // Récupérer le profil et le kiosque via la route API sécurisée.
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

      if (!result.kiosk?.id) {
        throw new Error(
          "Aucun kiosque actif n'est associé à votre compte."
        );
      }

      const kioskData = result.kiosk;

      setKiosk(kioskData);

      const [
        { data: salesData, error: salesError },
        { data: statsData, error: statsError },
        { data: productsData, error: productsError },
      ] = await Promise.all([
        // Historique : les 30 ventes les plus récentes
        supabase
          .from("kiosque_ventes")
          .select(
            "id, numero, date_vente, statut, mode_paiement, montant_total, montant_paye, montant_rendu"
          )
          .eq("kiosque_id", kioskData.id)
          .order("date_vente", { ascending: false })
          .limit(30),

        // Statistiques : toutes les ventes du kiosque
        supabase
          .from("kiosque_ventes")
          .select("statut, montant_total")
          .eq("kiosque_id", kioskData.id),

        // Produits actifs
        supabase
          .from("kiosque_produits")
          .select(
            "id, nom, reference, code_barres, unite, prix_vente, stock_actuel, stock_minimum, actif"
          )
          .eq("kiosque_id", kioskData.id)
          .eq("actif", true)
          .order("nom", { ascending: true }),
      ]);

      if (salesError) throw salesError;
      if (statsError) throw statsError;
      if (productsError) throw productsError;

      const allSales = statsData || [];

      const completedSales = allSales.filter(
        (sale) => sale.statut === "terminee"
      );

      setSales(salesData || []);
      setProducts(productsData || []);

      setSalesStats({
        completedCount: completedSales.length,

        revenue: completedSales.reduce(
          (sum, sale) => sum + Number(sale.montant_total || 0),
          0
        ),

        cancelledCount: allSales.filter(
          (sale) => sale.statut === "annulee"
        ).length,
      });
    } catch (err) {
      console.error("Erreur chargement ventes :", err);

      setError(
        err.message || "Impossible de charger les ventes."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ============================================================
     RAFRAÎCHISSEMENT AU RETOUR SUR LA PAGE
  ============================================================ */

  useEffect(() => {
    const handleFocus = () => {
      loadData(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    };

    window.addEventListener("focus", handleFocus);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener("focus", handleFocus);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadData]);

  /* ============================================================
     RECHERCHE DES PRODUITS
  ============================================================ */

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return products.slice(0, 30);
    }

    return products
      .filter((product) => {
        return (
          product.nom?.toLowerCase().includes(term) ||
          product.reference?.toLowerCase().includes(term) ||
          product.code_barres?.toLowerCase().includes(term)
        );
      })
      .slice(0, 30);
  }, [products, search]);

  /* ============================================================
     FILTRES DE L'HISTORIQUE DES VENTES
  ============================================================ */

  const filteredSales = useMemo(() => {
    const term = historySearch.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesPayment =
        paymentFilter === "tous" ||
        sale.mode_paiement === paymentFilter;

      const matchesSearch =
        !term ||
        String(sale.numero || "").toLowerCase().includes(term);

      return matchesPayment && matchesSearch;
    });
  }, [sales, paymentFilter, historySearch]);

  /* ============================================================
     CALCUL DU PANIER
  ============================================================ */

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

  /* ============================================================
     OUVERTURE / FERMETURE DE LA NOUVELLE VENTE
  ============================================================ */

  function openNewSale() {
    setCart([]);
    setSearch("");
    setPaymentMethod("especes");
    setPaidAmount("");
    setNotes("");
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setError("");
  }

  /* ============================================================
     GESTION DU PANIER
  ============================================================ */

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

  function removeFromCart(productId) {
    setCart((previous) =>
      previous.filter((item) => item.id !== productId)
    );

    setError("");
  }

  /* ============================================================
     VALIDATION DE LA VENTE
  ============================================================ */

  async function handleSubmitSale(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

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
      setError(
        "Le montant payé doit être positif ou nul."
      );
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

      setSuccess(
        `Vente n° ${result.numero} enregistrée avec succès.`
      );

      setModalOpen(false);
      setCart([]);
      setSearch("");
      setPaidAmount("");
      setNotes("");

      // Recharger l'historique, les statistiques et le catalogue.
      await loadData(true);
    } catch (err) {
      console.error("Erreur validation vente :", err);

      setError(
        err.message ||
          "Impossible d'enregistrer cette vente."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     CHARGEMENT INITIAL
  ============================================================ */

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />

          <p className="text-sm text-gray-500">
            Chargement des ventes...
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     INTERFACE
  ============================================================ */

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-10 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ventes
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {kiosk?.nom || "MonKiosk"} — historique des ventes
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing || saving}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              Actualiser
            </span>
          </button>

          <button
            type="button"
            onClick={openNewSale}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            Nouvelle vente
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && !modalOpen && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />

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

      {/* Succès */}
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />

          <p>{success}</p>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-auto"
            aria-label="Fermer le message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Ventes terminées"
          value={salesStats.completedCount}
          description="Toutes les ventes terminées"
        />

        <StatCard
          label="Chiffre d'affaires"
          value={formatMoney(salesStats.revenue)}
          description="Total des ventes terminées"
          valueClass="text-emerald-700"
        />

        <StatCard
          label="Ventes annulées"
          value={salesStats.cancelledCount}
          description="Toutes les ventes annulées"
          valueClass="text-red-600"
        />
      </div>

      {/* Historique des ventes avec filtres */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="space-y-4 border-b border-gray-100 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Historique des ventes
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Les 30 ventes les plus récentes.
            </p>
          </div>

          {/* Filtre par paiement et recherche par numéro */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="history-payment-filter"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Mode de paiement
              </label>

              <select
                id="history-payment-filter"
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(event.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="tous">
                  Tous les modes de paiement
                </option>

                {HISTORY_PAYMENT_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="history-sale-search"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Numéro de vente
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                <input
                  id="history-sale-search"
                  type="search"
                  value={historySearch}
                  onChange={(event) =>
                    setHistorySearch(event.target.value)
                  }
                  placeholder="Rechercher un numéro..."
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          {/* Nombre de résultats et réinitialisation */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              {filteredSales.length} vente(s) affichée(s)
            </p>

            {(paymentFilter !== "tous" ||
              historySearch !== "") && (
              <button
                type="button"
                onClick={() => {
                  setPaymentFilter("tous");
                  setHistorySearch("");
                }}
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>

        {/* Résultats de l'historique */}
        {filteredSales.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingCart className="mx-auto h-10 w-10 text-gray-300" />

            <p className="mt-3 font-medium text-gray-700">
              {sales.length === 0
                ? "Aucune vente enregistrée."
                : "Aucune vente ne correspond aux filtres."}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {sales.length === 0
                ? "Commence par enregistrer ta première vente."
                : "Essaie un autre mode de paiement ou réinitialise les filtres."}
            </p>

            {sales.length === 0 && (
              <button
                type="button"
                onClick={openNewSale}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Créer une vente
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    N° vente
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Date
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Paiement
                  </th>

                  <th className="px-5 py-3 text-right font-semibold">
                    Total
                  </th>

                  <th className="px-5 py-3 text-right font-semibold">
                    Payé
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Statut
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                      {sale.numero || "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {formatDate(sale.date_vente)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {paymentLabels[sale.mode_paiement] ||
                        sale.mode_paiement ||
                        "—"}
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
                        {statusLabels[sale.statut] ||
                          sale.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Fenêtre spéciale de nouvelle vente */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/60 p-3 py-5 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="my-auto flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* En-tête de la fenêtre */}
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
                    Recherche les produits et ajoute-les au panier.
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

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                  {/* Recherche des produits */}
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

                          <p className="mt-1 text-xs text-gray-400">
                            Vérifie le nom, la référence ou le code-barres.
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
                                    {" · "}
                                    Stock : {product.stock_actuel}
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
                      {products.length} produit(s) actif(s) dans le catalogue.
                    </p>
                  </div>

                  {/* Panier et paiement */}
                  <div className="lg:col-span-3">
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-5 w-5 text-emerald-700" />
                          <h3 className="font-bold text-gray-900">
                            Panier
                          </h3>
                        </div>

                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {cart.reduce(
                            (sum, item) =>
                              sum + Number(item.quantite),
                            0
                          )}{" "}
                          article(s)
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
                                <th className="px-3 py-3 font-semibold">
                                  Article
                                </th>

                                <th className="px-3 py-3 text-center font-semibold">
                                  Qté
                                </th>

                                <th className="px-3 py-3 text-right font-semibold">
                                  Total
                                </th>

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
                                      {formatMoney(item.prix_vente)} /{" "}
                                      {item.unite}
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
                                        className="w-12 rounded-lg border border-gray-200 px-1 py-1.5 text-center text-sm outline-none focus:border-emerald-500"
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
                                      onClick={() =>
                                        removeFromCart(item.id)
                                      }
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

                    {/* Paiement */}
                    <div className="mt-5 rounded-xl border border-gray-200 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-emerald-700" />

                        <h3 className="font-bold text-gray-900">
                          Paiement
                        </h3>
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
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500"
                          >
                            {PAYMENT_OPTIONS.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
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
                            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
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
                          onChange={(event) =>
                            setNotes(event.target.value)
                          }
                          placeholder="Commentaire sur la vente..."
                          className="w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pied de la fenêtre */}
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
                  disabled={saving || cart.length === 0}
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
      )}
    </div>
  );
}

/* ============================================================
   CARTE STATISTIQUE
============================================================ */

function StatCard({
  label,
  value,
  description,
  valueClass = "text-gray-900",
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>

      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {description}
      </p>
    </div>
  );
}