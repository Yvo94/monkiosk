
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  RefreshCw,
  AlertTriangle,
  Package,
  CheckCircle2,
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

export default function NewProductModal({
  open,
  onClose,
  onSaved,
}) {
  const [kiosk, setKiosk] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadFormData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        throw new Error(
          "Session expirée. Connecte-toi à nouveau."
        );
      }

      // Même logique de récupération du kiosque que le dashboard.
      const response = await fetch(
        "/api/admin/users?action=kiosk",
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Impossible de récupérer le kiosque."
        );
      }

      const currentKiosk = result.kiosk;

      if (!currentKiosk?.id) {
        throw new Error(
          "Aucun kiosque n'est associé à ce compte."
        );
      }

      setKiosk(currentKiosk);

      const { data, error: categoryError } = await supabase
        .from("kiosque_categories")
        .select("id, nom, actif")
        .eq("kiosque_id", currentKiosk.id)
        .eq("actif", true)
        .order("nom", { ascending: true });

      if (categoryError) throw categoryError;

      setCategories(data || []);
    } catch (err) {
      console.error(
        "Erreur de préparation du formulaire produit :",
        err
      );
      setError(
        err.message || "Impossible de préparer le formulaire."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    setForm({ ...EMPTY_FORM });
    setSuccess("");
    setError("");
    loadFormData();
  }, [open, loadFormData]);

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function handleClose() {
    if (saving) return;

    setError("");
    setSuccess("");
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (loading) {
      setError("Attends la fin du chargement du formulaire.");
      return;
    }

    if (!kiosk?.id) {
      setError("Aucun kiosque sélectionné.");
      return;
    }

    if (!form.nom.trim()) {
      setError("Le nom du produit est obligatoire.");
      return;
    }

    if (form.prix_vente.trim() === "") {
      setError("Le prix de vente est obligatoire.");
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
      setError(
        "Vérifie les prix et les quantités : ils doivent être positifs."
      );
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

      const { error: insertError } = await supabase
        .from("kiosque_produits")
        .insert(payload);

      if (insertError) throw insertError;

      setSuccess("Produit ajouté avec succès.");

      // Actualiser le dashboard et fermer la fenêtre.
      if (onSaved) {
        await onSaved();
      }

      onClose();
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
        setError(
          err.message || "Impossible d'enregistrer le produit."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-gray-950/50 p-3 py-6 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-product-title"
        className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Package className="h-5 w-5" />
            </div>

            <div>
              <h2
                id="new-product-title"
                className="text-xl font-bold text-gray-900"
              >
                Nouveau produit
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {kiosk?.nom || "Catalogue produits"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 p-8 text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Chargement du formulaire...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-7">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Nom du produit *
                </label>
                <input
                  required
                  maxLength={200}
                  value={form.nom}
                  onChange={(e) =>
                    updateField("nom", e.target.value)
                  }
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
                    Aucune catégorie active. Le produit pourra être créé sans catégorie.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Unité
                </label>
                <select
                  value={form.unite}
                  onChange={(e) =>
                    updateField("unite", e.target.value)
                  }
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
                  Prix d'achat (FCFA)
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
                          Number(form.prix_achat) >= 0
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
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-800">
                    Produit actif
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    Le produit est disponible dans le catalogue actif.
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <div
                role="alert"
                className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-7"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {success && (
              <div className="mx-5 mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 sm:mx-7">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={saving || loading || !kiosk}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                {saving ? "Enregistrement..." : "Créer le produit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
