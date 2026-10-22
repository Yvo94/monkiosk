
"use client";

import { useEffect, useState } from "react";
import {
  X,
  Wallet,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const MODES_PAIEMENT = [
  { value: "especes", label: "Espèces" },
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Money" },
  { value: "moov_money", label: "Moov Money" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement" },
  { value: "autre", label: "Autre" },
];

const CATEGORIES = [
  "Produits de nettoyage",
  "Eau",
  "Électricité",
  "Salaires",
  "Entretien matériel",
  "Transport",
  "Loyer",
  "Fournitures",
  "Autre",
];

function dateLocaleAbidjan() {
  const maintenant = new Date();

  const parties = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(maintenant);

  const valeur = (type) =>
    parties.find((partie) => partie.type === type)?.value;

  return `${valeur("year")}-${valeur("month")}-${valeur("day")}T${valeur("hour")}:${valeur("minute")}`;
}

const champ =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-[#14233B] outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30";

const labelClasse = "mb-1.5 block text-sm font-medium text-slate-700";

export default function NouvelleDepenseModal({
  open,
  onClose,
  onSuccess,
  lavageId,
  devise = "FCFA",
}) {
  const [form, setForm] = useState({
    libelle: "",
    categorie: "Produits de nettoyage",
    montant: "",
    date_depense: "",
    mode_paiement: "especes",
    statut: "payee",
    caisse_id: "",
    notes: "",
  });

  const [caisses, setCaisses] = useState([]);
  const [chargementCaisses, setChargementCaisses] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const paiementEspeces = form.mode_paiement === "especes";
  const depensePayee = form.statut === "payee";
  const caisseObligatoire = paiementEspeces && depensePayee;

  useEffect(() => {
    if (!open) return;

    setErreur("");
    setSucces("");

    setForm({
      libelle: "",
      categorie: "Produits de nettoyage",
      montant: "",
      date_depense: dateLocaleAbidjan(),
      mode_paiement: "especes",
      statut: "payee",
      caisse_id: "",
      notes: "",
    });

    let annule = false;

    async function chargerCaisses() {
      if (!lavageId) {
        setCaisses([]);
        setErreur("La station de lavage n'est pas identifiée.");
        return;
      }

      setChargementCaisses(true);

      try {
        const response = await fetch(
          `/api/lavage/depenses?lavage_id=${encodeURIComponent(lavageId)}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Impossible de charger les caisses."
          );
        }

        if (!annule) {
          setCaisses(result.caisses || []);
        }
      } catch (error) {
        if (!annule) {
          setErreur(error.message || "Erreur de chargement des caisses.");
        }
      } finally {
        if (!annule) setChargementCaisses(false);
      }
    }

    chargerCaisses();

    return () => {
      annule = true;
    };
  }, [open, lavageId]);

  useEffect(() => {
    if (!open) return;

    function gererClavier(event) {
      if (event.key === "Escape" && !enregistrement) {
        onClose();
      }
    }

    window.addEventListener("keydown", gererClavier);

    return () => {
      window.removeEventListener("keydown", gererClavier);
    };
  }, [open, enregistrement, onClose]);

  if (!open) return null;

  function modifier(champNom, valeur) {
    setForm((precedent) => ({
      ...precedent,
      [champNom]: valeur,
    }));

    setErreur("");
    setSucces("");
  }

  async function enregistrer(event) {
    event.preventDefault();
    setErreur("");
    setSucces("");

    if (!lavageId) {
      setErreur("Aucune station de lavage sélectionnée.");
      return;
    }

    if (!form.libelle.trim()) {
      setErreur("Le libellé est obligatoire.");
      return;
    }

    const montant = Number(form.montant);

    if (!Number.isFinite(montant) || montant <= 0) {
      setErreur("Saisis un montant supérieur à zéro.");
      return;
    }

    if (!form.date_depense) {
      setErreur("La date de la dépense est obligatoire.");
      return;
    }

    if (caisseObligatoire && !form.caisse_id) {
      setErreur("Sélectionne la caisse à débiter.");
      return;
    }

    setEnregistrement(true);

    try {
      const response = await fetch("/api/lavage/depenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lavage_id: lavageId,
          libelle: form.libelle.trim(),
          categorie: form.categorie,
          montant,
          date_depense: new Date(form.date_depense).toISOString(),
          mode_paiement: form.mode_paiement,
          statut: form.statut,
          caisse_id: caisseObligatoire ? form.caisse_id : null,
          notes: form.notes.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Impossible d'enregistrer la dépense."
        );
      }

      setSucces("Dépense enregistrée avec succès.");

      await onSuccess?.(result);

      onClose();
    } catch (error) {
      setErreur(
        error.message || "Une erreur est survenue lors de l'enregistrement."
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0B1424]/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !enregistrement) {
          onClose();
        }
      }}
    >
     <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nouvelle-depense-titre"
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        >
        {/* En-tête fixe */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#14233B] px-5 py-4 text-white sm:px-7">
            {/* Conserve ici le contenu actuel de ton en-tête */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#D8BD83]/15 p-2.5 text-[#D8BD83]">
              <Wallet size={22} />
            </div>

            <div>
              <h2
                id="nouvelle-depense-titre"
                className="text-lg font-bold"
              >
                Nouvelle dépense
              </h2>
              <p className="mt-0.5 text-xs text-slate-300">
                Enregistrement d'une dépense · {devise}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={enregistrement}
            aria-label="Fermer"
            className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X size={21} />
          </button>
        </div>

        {/* Contenu défilant */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={enregistrer} className="space-y-5 p-5 sm:p-7">
            {erreur && (
                <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p>{erreur}</p>
                </div>
            )}

            {succes && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 size={18} />
                {succes}
                </div>
            )}

            <div>
                <label className={labelClasse} htmlFor="depense-date">
                Date et heure <span className="text-red-500">*</span>
                </label>
                <input
                id="depense-date"
                className={champ}
                type="datetime-local"
                value={form.date_depense}
                onChange={(event) =>
                    modifier("date_depense", event.target.value)
                }
                required
                />
                <p className="mt-1 text-xs text-slate-500">
                Heure locale de Côte d'Ivoire.
                </p>
            </div>
            <div>
                <label className={labelClasse} htmlFor="depense-libelle">
                Libellé <span className="text-red-500">*</span>
                </label>
                <input
                id="depense-libelle"
                className={champ}
                value={form.libelle}
                onChange={(event) => modifier("libelle", event.target.value)}
                placeholder="Ex. Achat de produits de nettoyage"
                maxLength={200}
                required
                autoFocus
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                <label className={labelClasse} htmlFor="depense-categorie">
                    Catégorie
                </label>
                <select
                    id="depense-categorie"
                    className={champ}
                    value={form.categorie}
                    onChange={(event) => modifier("categorie", event.target.value)}
                >
                    {CATEGORIES.map((categorie) => (
                    <option key={categorie} value={categorie}>
                        {categorie}
                    </option>
                    ))}
                </select>
                </div>

                <div>
                <label className={labelClasse} htmlFor="depense-montant">
                    Montant ({devise}) <span className="text-red-500">*</span>
                </label>
                <input
                    id="depense-montant"
                    className={champ}
                    type="number"
                    min="1"
                    step="any"
                    inputMode="decimal"
                    value={form.montant}
                    onChange={(event) => modifier("montant", event.target.value)}
                    placeholder="Ex. 10000"
                    required
                />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className={labelClasse} htmlFor="depense-paiement">
                    Mode de paiement
                    </label>
                    <select
                    id="depense-paiement"
                    className={champ}
                    value={form.mode_paiement}
                    onChange={(event) =>
                        modifier("mode_paiement", event.target.value)
                    }
                    >
                    {MODES_PAIEMENT.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                        {mode.label}
                        </option>
                    ))}
                    </select>
                </div>


                {caisseObligatoire && (
                    <div>
                    <label className={labelClasse} htmlFor="depense-caisse">
                        Caisse à débiter <span className="text-red-500">*</span>
                    </label>

                    <select
                        id="depense-caisse"
                        className={champ}
                        value={form.caisse_id}
                        onChange={(event) => modifier("caisse_id", event.target.value)}
                        required
                        disabled={chargementCaisses || caisses.length === 0}
                    >
                        <option value="">
                        {chargementCaisses
                            ? "Chargement des caisses..."
                            : caisses.length === 0
                            ? "Aucune caisse active disponible"
                            : "Sélectionner une caisse"}
                        </option>

                        {caisses.map((caisse) => (
                        <option key={caisse.id} value={caisse.id}>
                            {caisse.nom} — {Number(caisse.solde_actuel || 0).toLocaleString("fr-FR")} {devise}
                        </option>
                        ))}
                    </select>

                    <p className="mt-1 text-xs text-slate-500">
                        Le solde de cette caisse sera mis à jour lors de l'enregistrement.
                    </p>
                    </div>
                )}
            </div>

            <div>
                <label className={labelClasse} htmlFor="depense-notes">
                Notes (facultatif)
                </label>
                <textarea
                id="depense-notes"
                className={champ}
                rows={3}
                value={form.notes}
                onChange={(event) => modifier("notes", event.target.value)}
                placeholder="Informations complémentaires..."
                maxLength={2000}
                />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                type="button"
                onClick={onClose}
                disabled={enregistrement}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                Annuler
                </button>

                <button
                type="submit"
                disabled={
                    enregistrement ||
                    chargementCaisses ||
                    (caisseObligatoire && caisses.length === 0)
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-[#14233B] px-5 py-3 text-sm font-bold text-[#D8BD83] transition hover:bg-[#20385B] disabled:cursor-not-allowed disabled:opacity-60"
                >
                {enregistrement && (
                    <LoaderCircle size={17} className="animate-spin" />
                )}
                {enregistrement ? "Enregistrement..." : "Enregistrer la dépense"}
                </button>
            </div>
            </form>
        </div>
      </div>
    </div>
  );
}
