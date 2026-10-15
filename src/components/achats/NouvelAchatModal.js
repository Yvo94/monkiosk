
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  ShoppingBag,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const fcfa = (value) =>
  `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)} FCFA`;

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const inputClass =
  "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#D9A45B] focus:ring-2 focus:ring-[#D9A45B]/20";

export default function NouvelAchatModal({ fournisseurs, onClose, onSaved }) {
  const [kioskId, setKioskId] = useState("");
  const [userId, setUserId] = useState("");
  const [produits, setProduits] = useState([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [dateAchat, setDateAchat] = useState(today());
  const [montantPaye, setMontantPaye] = useState("0");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState([
    { produit_id: "", quantite: "1", prix_unitaire: "0" },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session) {
          window.location.replace("/login");
          return;
        }

        const { data: kiosk, error: kioskError } = await supabase
          .from("kiosques")
          .select("id, owner_id, actif")
          .eq("owner_id", session.user.id)
          .eq("actif", true)
          .maybeSingle();

        if (kioskError) throw kioskError;
        if (!kiosk) throw new Error("Aucun kiosque actif trouvé.");

        const { data, error: productsError } = await supabase
          .from("kiosque_produits")
          .select("id, nom, reference, unite, prix_achat, stock_actuel")
          .eq("kiosque_id", kiosk.id)
          .eq("actif", true)
          .order("nom", { ascending: true });

        if (productsError) throw productsError;

        if (!cancelled) {
          setKioskId(kiosk.id);
          setUserId(session.user.id);
          setProduits(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Impossible de charger les produits.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(
    () =>
      lignes.reduce(
        (sum, ligne) =>
          sum +
          Math.max(0, Number(ligne.quantite) || 0) *
            Math.max(0, Number(ligne.prix_unitaire) || 0),
        0
      ),
    [lignes]
  );

  const paye = Math.max(0, Number(montantPaye) || 0);
  const reste = Math.max(0, total - paye);

  function updateLigne(index, field, value) {
    setLignes((previous) =>
      previous.map((ligne, i) => {
        if (i !== index) return ligne;

        const updated = { ...ligne, [field]: value };

        if (field === "produit_id") {
          const produit = produits.find((p) => p.id === value);
          updated.prix_unitaire = String(produit?.prix_achat ?? 0);
        }

        return updated;
      })
    );
  }

  function ajouterLigne() {
    setLignes((previous) => [
      ...previous,
      { produit_id: "", quantite: "1", prix_unitaire: "0" },
    ]);
  }

  function supprimerLigne(index) {
    setLignes((previous) => previous.filter((_, i) => i !== index));
  }

  async function enregistrer(e) {
    e.preventDefault();
    setError("");

    if (!kioskId) {
      setError("Le kiosque actif est introuvable.");
      return;
    }

    const lignesValides = lignes.filter(
      (ligne) => ligne.produit_id && Number(ligne.quantite) > 0
    );

    if (lignesValides.length === 0) {
      setError("Ajoute au moins un produit avec une quantité valide.");
      return;
    }

    if (paye > total) {
      setError("Le montant payé ne peut pas dépasser le total de l'achat.");
      return;
    }

    setSaving(true);

    try {
      const numero =
        `ACH-${Date.now().toString().slice(-10)}`;

      // Créer l'en-tête de l'achat.
      
      const {
            data: { user: utilisateur },
            error: erreurAuth,
            } = await supabase.auth.getUser();

            if (erreurAuth) throw erreurAuth;

            if (!utilisateur || utilisateur.id !== userId) {
            throw new Error(
                "La session utilisateur a changé. Recharge la page et réessaie."
            );
            }
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

        if (sessionError) throw sessionError;

      const { data: kiosqueVerifie, error: verificationError } =
            await supabase
                .from("kiosques")
                .select("id, owner_id, actif")
                .eq("id", kioskId)
                .eq("owner_id", utilisateur.id)
                .eq("actif", true)
                .maybeSingle();

            if (verificationError) throw verificationError;

            if (!kiosqueVerifie) {
            throw new Error(
                "Le kiosque utilisé n'appartient pas à l'utilisateur connecté ou n'est pas actif."
            );
            }
      const { data: achat, error: achatError } = await supabase
        .from("kiosque_achats")
        .insert({
          kiosque_id: kioskId,
          fournisseur_id: fournisseurId || null,
          numero,
          date_achat: new Date(`${dateAchat}T12:00:00`).toISOString(),
          statut: "recu",
          montant_total: total,
          montant_paye: paye,
          notes: notes.trim() || null,
          created_by: userId,
        })
        .select("id")
        .single();

      if (achatError) throw achatError;

      // Enregistrer les lignes d'achat.
      const details = lignesValides.map((ligne) => ({
        kiosque_id: kioskId,
        achat_id: achat.id,
        produit_id: ligne.produit_id,
        quantite: Number(ligne.quantite),
        prix_unitaire: Number(ligne.prix_unitaire),
        }));

      const { error: detailsError } = await supabase
        .from("kiosque_achat_details")
        .insert(details);

      if (detailsError) {
        throw new Error(
          `L'achat ${numero} a été créé, mais ses lignes n'ont pas été enregistrées. ${detailsError.message}`
        );
      }

      // Mettre à jour le stock et le prix d'achat des produits reçus.
      // Regrouper les lignes si un même produit apparaît plusieurs fois.
      const quantites = new Map();

      for (const ligne of lignesValides) {
        const ancienne = quantites.get(ligne.produit_id) || {
          quantite: 0,
          prixPondere: 0,
        };
        const qte = Number(ligne.quantite);
        const prix = Number(ligne.prix_unitaire);

        quantites.set(ligne.produit_id, {
          quantite: ancienne.quantite + qte,
          prixPondere: ancienne.prixPondere + qte * prix,
        });
      }

      for (const [produitId, info] of quantites) {
        const produit = produits.find((p) => p.id === produitId);
        if (!produit) continue;

        const stockAvant = Number(produit.stock_actuel) || 0;
        const stockApres = stockAvant + info.quantite;
        const prixMoyen = info.prixPondere / info.quantite;

        const { error: stockError } = await supabase
          .from("kiosque_produits")
          .update({
            stock_actuel: stockApres,
            prix_achat: prixMoyen,
            updated_at: new Date().toISOString(),
          })
          .eq("id", produitId)
          .eq("kiosque_id", kioskId);

        if (stockError) {
          throw new Error(
            `L'achat ${numero} est enregistré, mais le stock de ${produit.nom} n'a pas pu être mis à jour. ${stockError.message}`
          );
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("Erreur enregistrement achat :", err);
      setError(err?.message || "Impossible d'enregistrer l'achat.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="nouvel-achat-title"
        className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-[#A16D2B]">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="nouvel-achat-title"
                className="text-lg font-bold text-[#14233B]"
              >
                Nouvel achat
              </h2>
              <p className="text-sm text-slate-500">
                Enregistrer un approvisionnement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fermer la fenêtre"
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={enregistrer} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Chargement des produits...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Fournisseur
                    <select
                      value={fournisseurId}
                      onChange={(e) => setFournisseurId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Sans fournisseur</option>
                      {fournisseurs.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nom}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Date d'achat
                    <input
                      type="date"
                      required
                      value={dateAchat}
                      onChange={(e) => setDateAchat(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[#14233B]">
                        Produits achetés
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Le stock sera augmenté à l'enregistrement.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={ajouterLigne}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </button>
                  </div>

                  <div className="space-y-3">
                    {lignes.map((ligne, index) => {
                      const produit = produits.find(
                        (p) => p.id === ligne.produit_id
                      );
                      const sousTotal =
                        (Number(ligne.quantite) || 0) *
                        (Number(ligne.prix_unitaire) || 0);

                      return (
                        <div
                          key={index}
                          className="rounded-xl border border-slate-200 p-3 sm:p-4"
                        >
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                            <label className="text-xs font-semibold text-slate-600 sm:col-span-5">
                              Produit
                              <select
                                required
                                value={ligne.produit_id}
                                onChange={(e) =>
                                  updateLigne(
                                    index,
                                    "produit_id",
                                    e.target.value
                                  )
                                }
                                className={inputClass}
                              >
                                <option value="">Choisir un produit</option>
                                {produits.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nom}
                                    {p.reference ? ` (${p.reference})` : ""}
                                  </option>
                                ))}
                              </select>
                              {produit && (
                                <span className="mt-1 block font-normal text-slate-400">
                                  Stock actuel : {produit.stock_actuel ?? 0}{" "}
                                  {produit.unite || ""}
                                </span>
                              )}
                            </label>

                            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                              Quantité
                              <input
                                required
                                min="0.001"
                                step="0.001"
                                type="number"
                                value={ligne.quantite}
                                onChange={(e) =>
                                  updateLigne(
                                    index,
                                    "quantite",
                                    e.target.value
                                  )
                                }
                                className={inputClass}
                              />
                            </label>

                            <label className="text-xs font-semibold text-slate-600 sm:col-span-3">
                              Prix unitaire
                              <input
                                required
                                min="0"
                                step="0.01"
                                type="number"
                                value={ligne.prix_unitaire}
                                onChange={(e) =>
                                  updateLigne(
                                    index,
                                    "prix_unitaire",
                                    e.target.value
                                  )
                                }
                                className={inputClass}
                              />
                            </label>

                            <div className="flex items-end justify-between gap-3 sm:col-span-2 sm:flex-col sm:items-end sm:justify-center">
                              <div>
                                <p className="text-xs text-slate-500">
                                  Sous-total
                                </p>
                                <p className="mt-1 text-sm font-bold text-[#14233B]">
                                  {fcfa(sousTotal)}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={lignes.length === 1}
                                onClick={() => supprimerLigne(index)}
                                title="Supprimer cette ligne"
                                className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Montant payé (FCFA)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={montantPaye}
                      onChange={(e) => setMontantPaye(e.target.value)}
                      className={inputClass}
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Notes (facultatif)
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Référence du reçu, remarques..."
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="rounded-2xl bg-[#14233B] p-5 text-white">
                  <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                    <span>Montant total</span>
                    <span className="font-semibold text-white">
                      {fcfa(total)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-300">
                    <span>Montant payé</span>
                    <span>{fcfa(paye)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/15 pt-3">
                    <span className="font-semibold">Reste à payer</span>
                    <span className="text-xl font-bold text-amber-300">
                      {fcfa(reste)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || saving || produits.length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#14233B] px-5 text-sm font-semibold text-white hover:bg-[#203653] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Enregistrer l'achat
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
