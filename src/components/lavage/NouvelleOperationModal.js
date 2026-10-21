
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CarFront,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const PAYMENT_MODES = [
  ["especes", "Espèces"],
  ["wave", "Wave"],
  ["orange_money", "Orange Money"],
  ["mtn_money", "MTN Money"],
  ["moov_money", "Moov Money"],
  ["carte", "Carte bancaire"],
  ["virement", "Virement bancaire"],
  ["autre", "Autre"],
];

const EMPTY_FORM = {
  lavage_id: "",
  type_vehicule_id: "",
  prestation_id: "",
  laveur_id: "",
  caisse_id: "",
  mode_paiement: "especes",
  reference_paiement: "",
  immatriculation: "",
  marque: "",
  modele: "",
  couleur: "",
  client_nom: "",
  client_telephone: "",
  client_email: "",
  notes: "",
};

function money(value, devise = "FCFA") {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))} ${devise || "FCFA"}`;
}

function Field({ label, required, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30 disabled:bg-slate-100"
    />
  );
}

function Select({ value, onChange, required = false, children }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30"
    >
      {children}
    </select>
  );
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#14233B] text-[#D8BD83]">
          <Icon size={19} />
        </div>
        <div>
          <h3 className="font-bold text-[#14233B]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function StepIndicator({ step }) {
  const labels = ["Véhicule", "Service", "Récapitulatif"];

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        {labels.map((label, index) => {
          const number = index + 1;
          const active = step === number;
          const completed = step > number;

          return (
            <div key={label} className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active
                    ? "bg-[#14233B] text-white ring-2 ring-[#D8BD83]"
                    : completed
                      ? "bg-[#D8BD83] text-[#14233B]"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {completed ? <Check size={16} /> : number}
              </span>
              <span
                className={`hidden text-xs font-semibold sm:inline ${
                  active ? "text-[#14233B]" : "text-slate-500"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[#D8BD83] transition-all"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
    </div>
  );
}

function VehicleCard({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group overflow-hidden rounded-xl border-2 text-left transition ${
        active
          ? "border-[#D8BD83] bg-[#D8BD83]/10 ring-2 ring-[#D8BD83]/20"
          : "border-slate-200 bg-white hover:border-[#D8BD83]"
      }`}
    >
      <div className="relative flex h-20 items-center justify-center overflow-hidden bg-slate-50 sm:h-24">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.nom}
            loading="lazy"
            className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
          />
        ) : (
          <CarFront size={30} className="text-slate-300" />
        )}

        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#14233B] text-[#D8BD83]">
            <Check size={14} />
          </span>
        )}
      </div>

      <div className="flex min-h-10 items-center justify-between gap-1.5 px-2 py-2">
        <span className="text-xs font-semibold leading-4 text-[#14233B] sm:text-sm">
          {item.nom}
        </span>
        {active && (
          <CheckCircle2 size={15} className="shrink-0 text-[#14233B]" />
        )}
      </div>
    </button>
  );
}

export default function NouvelleOperationModal({
  open,
  onClose,
  onSuccess,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState(1);
  const [quantite, setQuantite] = useState(0);

  const [stations, setStations] = useState([]);
  const [types, setTypes] = useState([]);
  const [prestations, setPrestations] = useState([]);
  const [laveurs, setLaveurs] = useState([]);
  const [tarifs, setTarifs] = useState([]);
  const [caisses, setCaisses] = useState([]);

  const [vehicleSearch, setVehicleSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = useCallback((key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError("");
  }, []);

  const station = stations.find((item) => item.id === form.lavage_id) || null;

  const selectedType =
    types.find((item) => item.id === form.type_vehicule_id) || null;

  const selectedPrestation =
    prestations.find((item) => item.id === form.prestation_id) || null;

  const selectedLaveur =
    laveurs.find((item) => item.id === form.laveur_id) || null;

  const selectedCaisse =
    caisses.find((item) => item.id === form.caisse_id) || null;

  const tarif = useMemo(
    () =>
      tarifs.find(
        (item) =>
          item.type_vehicule_id === form.type_vehicule_id &&
          item.prestation_id === form.prestation_id &&
          item.actif === true
      ) || null,
    [tarifs, form.type_vehicule_id, form.prestation_id]
  );

  const prixUnitaire = Number(tarif?.prix || 0);
  const montantTotal = prixUnitaire * (Number(quantite) || 0);

  const filteredTypes = useMemo(() => {
    const query = vehicleSearch.trim().toLocaleLowerCase("fr");

    return types.filter((item) =>
      String(item.nom || "").toLocaleLowerCase("fr").includes(query)
    );
  }, [types, vehicleSearch]);

  const resetForm = useCallback((lavageId = "") => {
    setForm({
      ...EMPTY_FORM,
      lavage_id: lavageId,
    });
    setStep(1);
    setQuantite(0);
    setVehicleSearch("");
    setError("");
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth?.user) {
        throw new Error("Connecte-toi pour accéder au module Lavage.");
      }

      const response = await fetch("/api/lavage/services", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Impossible de charger les stations."
        );
      }

      const stationList = result.stations || [];

      if (!stationList.length) {
        throw new Error("Aucune station active n'est disponible.");
      }

      setStations(stationList);

      const preferredStation =
        stationList.find((item) => item.id === form.lavage_id) ||
        stationList[0];

      const lavageId = preferredStation.id;

      const results = await Promise.all([
        supabase
          .from("lavage_types_vehicule")
          .select("id, lavage_id, nom, description, actif, image_url")
          .eq("lavage_id", lavageId)
          .eq("actif", true)
          .order("nom"),

        supabase
          .from("lavage_prestations")
          .select("id, lavage_id, nom, description, actif")
          .eq("lavage_id", lavageId)
          .eq("actif", true)
          .order("nom"),

        supabase
          .from("lavage_laveurs")
          .select("id, lavage_id, nom, telephone, actif")
          .eq("lavage_id", lavageId)
          .eq("actif", true)
          .order("nom"),

        supabase
          .from("lavage_tarifs")
          .select(
            "id, lavage_id, type_vehicule_id, prestation_id, prix, commission_laveur, actif"
          )
          .eq("lavage_id", lavageId)
          .eq("actif", true),

        supabase
          .from("lavage_caisses")
          .select("id, lavage_id, code, nom, solde_actuel, actif")
          .eq("lavage_id", lavageId)
          .eq("actif", true)
          .order("nom"),
      ]);

      const failed = results.find((item) => item.error);

      if (failed) {
        throw new Error(failed.error.message);
      }

      const nextTypes = results[0].data || [];
      const nextPrestations = results[1].data || [];
      const nextLaveurs = results[2].data || [];
      const nextTarifs = results[3].data || [];
      const nextCaisses = results[4].data || [];

      setTypes(nextTypes);
      setPrestations(nextPrestations);
      setLaveurs(nextLaveurs);
      setTarifs(nextTarifs);
      setCaisses(nextCaisses);

      setForm((previous) => ({
        ...EMPTY_FORM,
        lavage_id: lavageId,
        type_vehicule_id: nextTypes.some(
          (item) => item.id === previous.type_vehicule_id
        )
          ? previous.type_vehicule_id
          : "",
        prestation_id: nextPrestations.some(
          (item) => item.id === previous.prestation_id
        )
          ? previous.prestation_id
          : "",
        laveur_id: nextLaveurs.some(
          (item) => item.id === previous.laveur_id
        )
          ? previous.laveur_id
          : "",
        caisse_id: nextCaisses.some(
          (item) => item.id === previous.caisse_id
        )
          ? previous.caisse_id
          : nextCaisses.length === 1
            ? nextCaisses[0].id
            : "",
      }));
    } catch (exception) {
      setError(exception.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, [form.lavage_id]);

  useEffect(() => {
    if (open) {
      resetForm(form.lavage_id);
      loadData();
    }
    // Chargement à chaque ouverture de la fenêtre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !submitting) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, submitting, onClose]);

  function closeModal() {
    if (submitting) return;
    setError("");
    onClose?.();
  }

  function nextStep() {
    setError("");

    if (step === 1) {
      if (!selectedType) {
        setError("Sélectionne un type de véhicule.");
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (!selectedLaveur) {
        setError("Sélectionne un laveur.");
        return;
      }

      if (!selectedPrestation) {
        setError("Sélectionne un type de lavage.");
        return;
      }

      if (!tarif || prixUnitaire <= 0) {
        setError("Aucun tarif actif valide pour cette combinaison.");
        return;
      }

      setStep(3);
    }
  }
    
  function changeQuantity(value) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed)) return;

    setQuantite(Math.min(50, Math.max(1, parsed)));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    // Ne jamais enregistrer depuis les étapes 1 et 2.
    if (step !== 3 || submitting) {
        return;
    }
    setError("");

    if (!station) {
      setError("Sélectionne une station de lavage.");
      setStep(1);
      return;
    }

    if (!selectedType) {
      setError("Sélectionne un type de véhicule.");
      setStep(1);
      return;
    }

    if (!selectedLaveur || !selectedPrestation) {
      setError("Sélectionne le laveur et le type de lavage.");
      setStep(2);
      return;
    }

    if (!tarif || prixUnitaire <= 0) {
      setError("Aucun tarif actif valide pour cette combinaison.");
      setStep(2);
      return;
    }

    if (!selectedCaisse) {
      setError("Sélectionne une caisse active.");
      return;
    }

    if (!PAYMENT_MODES.some(([code]) => code === form.mode_paiement)) {
      setError("Sélectionne un mode de paiement valide.");
      return;
    }
    if (Number(quantite) === 0) {
        setQuantite(1);;
        return;
    }

    if (
      !Number.isInteger(Number(quantite)) ||
      Number(quantite) < 1 ||
      Number(quantite) > 50
    ) {
      setError("La quantité doit être comprise entre 1 et 50.");
      return;
    }

    /*if (!form.immatriculation.trim() && !form.client_nom.trim()) {
      setError("Renseigne l'immatriculation ou le nom du client.");
      return;
    }*/

    if (
      form.client_email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email.trim())
    ) {
      setError("L'adresse e-mail n'est pas valide.");
      return;
    }

    const quantity = Number(quantite);

    // IMPORTANT :
    // Une seule prestation dans details, quantité 1.
    // quantite_operations indique combien d'opérations distinctes créer.
    const payload = {
      type_vehicule_id: form.type_vehicule_id,
      laveur_id: form.laveur_id,
      caisse_id: form.caisse_id,
      mode_paiement: form.mode_paiement,
      reference_paiement: form.reference_paiement.trim() || null,
      notes: form.notes.trim() || null,
      quantite_operations: quantity,
      details: [
        {
          prestation_id: form.prestation_id,
          quantite: 1,
        },
      ],
      client: {
        nom: form.client_nom.trim() || null,
        telephone: form.client_telephone.trim() || null,
        email: form.client_email.trim() || null,
      },
      vehicule: {
        immatriculation: form.immatriculation.trim() || null,
        marque: form.marque.trim() || null,
        modele: form.modele.trim() || null,
        couleur: form.couleur.trim() || null,
      },
    };

    setSubmitting(true);

    try {
      const response = await fetch("/api/lavage/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lavage_id: station.id,
          payload,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Échec de l'enregistrement de l'opération."
        );
      }

      const stationId = station.id;
      const message =
        result.message ||
        `${quantity} opération(s) enregistrée(s) avec succès.`;

      resetForm(stationId);
      onClose?.();
      onSuccess?.(message);
    } catch (exception) {
      setError(exception.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          closeModal();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-wash-title"
        className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-[#F5F6F8] shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 bg-[#14233B] px-5 py-4 text-white sm:px-7">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#D8BD83]">
              MAAX BUSINESS · LAVAGE
            </p>
            <h2 id="new-wash-title" className="mt-1 text-xl font-bold">
              Nouvelle opération
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {station?.nom || "Station de lavage"} · Étape {step} sur 3
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={submitting}
            aria-label="Fermer la fenêtre"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
          >
            <X size={21} />
          </button>
        </header>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {loading ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-slate-500">
                <LoaderCircle
                  size={30}
                  className="animate-spin text-[#14233B]"
                />
                Chargement des stations et du catalogue…
              </div>
            ) : (
              <>
                {stations.length > 1 && (
                  <Section
                    icon={CarFront}
                    title="Station de lavage"
                    description="Choisis la station concernée par cette opération."
                  >
                    <Select
                      value={form.lavage_id}
                      onChange={(value) => {
                        resetForm(value);
                        setError(
                          "Ferme puis rouvre la fenêtre pour charger le catalogue de cette station."
                        );
                      }}
                      required
                    >
                      {stations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nom}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-2 text-xs text-slate-500">
                      Le catalogue est chargé pour la station sélectionnée à
                      l'ouverture de la fenêtre.
                    </p>
                  </Section>
                )}

                <StepIndicator step={step} />

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                  >
                    {error}
                  </div>
                )}

                {step === 1 && (
                  <Section
                    icon={CarFront}
                    title="Choisir le véhicule"
                    description="Sélectionne le type de véhicule à laver."
                  >
                    <Field label="Rechercher un véhicule">
                      <div className="relative">
                        <Search
                          size={17}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          value={vehicleSearch}
                          onChange={(event) =>
                            setVehicleSearch(event.target.value)
                          }
                          placeholder="Voiture, moto, camion…"
                          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30"
                        />
                      </div>
                    </Field>

                    <div className="mt-4">
                      {filteredTypes.length === 0 ? (
                        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                          Aucun type de véhicule actif trouvé.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                          {filteredTypes.map((item) => (
                            <VehicleCard
                              key={item.id}
                              item={item}
                              active={form.type_vehicule_id === item.id}
                              onClick={() =>
                                update("type_vehicule_id", item.id)
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedType && (
                      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#D8BD83]/50 bg-[#D8BD83]/10 p-3">
                        <CheckCircle2
                          size={20}
                          className="shrink-0 text-[#14233B]"
                        />
                        <div>
                          <p className="text-xs text-slate-500">
                            Véhicule sélectionné
                          </p>
                          <p className="font-bold text-[#14233B]">
                            {selectedType.nom}
                          </p>
                        </div>
                      </div>
                    )}
                  </Section>
                )}

                {step === 2 && (
                  <>
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3">
                      {selectedType?.image_url ? (
                        <img
                          src={selectedType.image_url}
                          alt={selectedType.nom}
                          className="h-20 w-28 rounded-xl object-contain"
                        />
                      ) : (
                        <div className="flex h-20 w-28 items-center justify-center rounded-xl bg-slate-100">
                          <CarFront size={32} className="text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          Type de véhicule
                        </p>
                        <p className="font-bold text-[#14233B]">
                          {selectedType?.nom}
                        </p>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="mt-2 text-xs font-semibold text-slate-600 underline"
                        >
                          Modifier le véhicule
                        </button>
                      </div>
                    </div>

                    <Section
                      icon={UserRound}
                      title="Choisir le laveur"
                      description="Désigne le laveur responsable de cette opération."
                    >
                      <Field label="Laveur responsable" required>
                        <Select
                          value={form.laveur_id}
                          onChange={(value) => update("laveur_id", value)}
                          required
                        >
                          <option value="">Sélectionner un laveur</option>
                          {laveurs.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nom}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      {laveurs.length === 0 && (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                          Aucun laveur actif. Ajoute d'abord un laveur au
                          catalogue.
                        </p>
                      )}
                    </Section>

                    <Section
                      icon={Wallet}
                      title="Choisir le type de lavage"
                      description="Le tarif correspondant au véhicule est calculé automatiquement."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        {prestations.map((item) => {
                          const active = form.prestation_id === item.id;

                          const matchingTariff = tarifs.find(
                            (tarifItem) =>
                              tarifItem.type_vehicule_id ===
                                form.type_vehicule_id &&
                              tarifItem.prestation_id === item.id &&
                              tarifItem.actif === true &&
                              Number(tarifItem.prix) > 0
                          );

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                update("prestation_id", item.id)
                              }
                              className={`rounded-xl border-2 p-4 text-left transition ${
                                active
                                  ? "border-[#D8BD83] bg-[#D8BD83]/10"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-[#14233B]">
                                    {item.nom}
                                  </p>
                                  {item.description && (
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                      {item.description}
                                    </p>
                                  )}
                                  <p className="mt-3 text-sm font-semibold">
                                    {matchingTariff
                                      ? money(
                                          matchingTariff.prix,
                                          station?.devise
                                        )
                                      : "Tarif non défini"}
                                  </p>
                                </div>
                                {active && (
                                  <CheckCircle2
                                    size={19}
                                    className="shrink-0 text-[#14233B]"
                                  />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {prestations.length === 0 && (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                          Aucun type de lavage actif n'est disponible.
                        </p>
                      )}

                      {form.prestation_id && !tarif && (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                          Aucun tarif actif n'est configuré pour cette
                          combinaison.
                        </p>
                      )}
                    </Section>

                    {tarif && (
                      <div className="rounded-2xl bg-[#14233B] p-4 text-white">
                        <p className="text-sm text-slate-300">
                          Tarif unitaire sélectionné
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-[#D8BD83]">
                          {money(prixUnitaire, station?.devise)}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {step === 3 && (
                  <>
                    <Section
                      icon={ClipboardCheck}
                      title="Récapitulatif du service"
                      description="Vérifie les informations avant d'enregistrer."
                    >
                      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                        <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          {selectedType?.image_url ? (
                            <img
                              src={selectedType.image_url}
                              alt={selectedType.nom}
                              className="max-h-40 w-full object-contain p-2"
                            />
                          ) : (
                            <CarFront size={48} className="text-slate-300" />
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-slate-500">Véhicule</p>
                            <p className="font-bold text-[#14233B]">
                              {selectedType?.nom || "—"}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-slate-500">
                                Prestation
                              </p>
                              <p className="font-semibold text-[#14233B]">
                                {selectedPrestation?.nom || "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Laveur</p>
                              <p className="font-semibold text-[#14233B]">
                                {selectedLaveur?.nom || "—"}
                              </p>
                            </div>
                          </div>
                          <p className="text-xl font-extrabold text-[#14233B]">
                            {money(prixUnitaire, station?.devise)} /
                            prestation
                          </p>
                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            className="text-xs font-semibold text-slate-600 underline"
                          >
                            Modifier le service
                          </button>
                        </div>
                      </div>
                    </Section>

                    <Section
                      icon={CircleDollarSign}
                      title="Quantité et montant"
                      description="Enregistre de 1 à 50 prestations identiques."
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Nombre de prestations"
                          required
                          hint="Minimum 1, maximum 50."
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                changeQuantity(Number(quantite) - 1)
                              }
                              disabled={Number(quantite) <= 1}
                              aria-label="Diminuer la quantité"
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white disabled:opacity-40"
                            >
                              <Minus size={18} />
                            </button>

                            <input
                              type="number"
                              min={1}
                              max={50}
                              step={1}
                              value={quantite}
                              onChange={(event) => {
                                if (event.target.value === "") {
                                  setQuantite("");
                                  return;
                                }

                                const parsed = Number(event.target.value);

                                if (Number.isInteger(parsed)) {
                                  setQuantite(
                                    Math.min(50, Math.max(1, parsed))
                                  );
                                }
                              }}
                              onBlur={() => {
                                const value = Number(quantite);
                                setQuantite(
                                  Number.isInteger(value)
                                    ? Math.min(50, Math.max(1, value))
                                    : 1
                                );
                              }}
                              className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-center text-lg font-extrabold text-[#14233B] outline-none focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                changeQuantity(Number(quantite) + 1)
                              }
                              disabled={Number(quantite) >= 50}
                              aria-label="Augmenter la quantité"
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white disabled:opacity-40"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </Field>

                        <div className="rounded-xl bg-[#14233B] p-4 text-white">
                          <p className="text-xs text-slate-300">
                            {Number(quantite) || 0} ×{" "}
                            {money(prixUnitaire, station?.devise)}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            Montant total
                          </p>
                          <p className="mt-1 break-words text-2xl font-extrabold text-[#D8BD83]">
                            {money(montantTotal, station?.devise)}
                          </p>
                        </div>
                      </div>

                      {Number(quantite) > 1 && (
                        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                          La validation demandera la création de {quantite}{" "}
                          opérations distinctes associées au laveur sélectionné.
                        </p>
                      )}
                    </Section>

                    <Section
                      icon={CarFront}
                      title="Informations du véhicule"
                      description="L'immatriculation ou le nom du client doit être renseigné."
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Immatriculation">
                          <Input
                            value={form.immatriculation}
                            onChange={(value) =>
                              update("immatriculation", value.toUpperCase())
                            }
                            placeholder="Ex. : AB 1234 CI"
                          />
                        </Field>
                        <Field label="Marque">
                          <Input
                            value={form.marque}
                            onChange={(value) => update("marque", value)}
                            placeholder="Ex. : Toyota"
                          />
                        </Field>
                        <Field label="Modèle">
                          <Input
                            value={form.modele}
                            onChange={(value) => update("modele", value)}
                            placeholder="Ex. : Corolla"
                          />
                        </Field>
                        <Field label="Couleur">
                          <Input
                            value={form.couleur}
                            onChange={(value) => update("couleur", value)}
                            placeholder="Ex. : Noir"
                          />
                        </Field>
                      </div>
                    </Section>

                    <Section
                      icon={UserRound}
                      title="Informations du client"
                      description="Les coordonnées du client sont facultatives."
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Nom du client">
                          <Input
                            value={form.client_nom}
                            onChange={(value) =>
                              update("client_nom", value)
                            }
                            placeholder="Nom et prénom"
                          />
                        </Field>
                        <Field label="Téléphone">
                          <Input
                            value={form.client_telephone}
                            onChange={(value) =>
                              update("client_telephone", value)
                            }
                            placeholder="Numéro du client"
                          />
                        </Field>
                        <Field label="E-mail">
                          <Input
                            type="email"
                            value={form.client_email}
                            onChange={(value) =>
                              update("client_email", value)
                            }
                            placeholder="client@exemple.com"
                          />
                        </Field>
                      </div>
                    </Section>

                    <Section
                      icon={Banknote}
                      title="Encaissement"
                      description="Sélectionne la caisse et le mode de paiement."
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Caisse" required>
                          <Select
                            value={form.caisse_id}
                            onChange={(value) => update("caisse_id", value)}
                            required
                          >
                            <option value="">Sélectionner une caisse</option>
                            {caisses.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.nom} ({item.code})
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Mode de paiement" required>
                          <Select
                            value={form.mode_paiement}
                            onChange={(value) =>
                              update("mode_paiement", value)
                            }
                            required
                          >
                            <option value="">Sélectionner un mode</option>
                            {PAYMENT_MODES.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Référence de paiement">
                          <Input
                            value={form.reference_paiement}
                            onChange={(value) =>
                              update("reference_paiement", value)
                            }
                            placeholder="Référence de transaction"
                          />
                        </Field>

                        <Field label="Notes">
                          <Input
                            value={form.notes}
                            onChange={(value) => update("notes", value)}
                            placeholder="Observations éventuelles"
                          />
                        </Field>
                      </div>
                    </Section>

                    <div className="rounded-2xl border border-[#D8BD83]/50 bg-white p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D8BD83]/20 text-[#14233B]">
                          <ShieldCheck size={21} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#14233B]">
                            Vérification finale
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {[
                              ["Véhicule", selectedType?.nom],
                              ["Service", selectedPrestation?.nom],
                              ["Laveur", selectedLaveur?.nom],
                              ["Quantité", quantite],
                              ["Caisse", selectedCaisse?.nom],
                              [
                                "Paiement",
                                PAYMENT_MODES.find(
                                  ([code]) => code === form.mode_paiement
                                )?.[1],
                              ],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="flex justify-between gap-3"
                              >
                                <span>{label}</span>
                                <strong className="text-right text-[#14233B]">
                                  {value || "—"}
                                </strong>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 border-t border-slate-200 pt-4">
                            <p className="text-xs font-semibold text-slate-500">
                              TOTAL DE L'OPÉRATION
                            </p>
                            <p className="mt-1 break-words text-3xl font-extrabold text-[#14233B]">
                              {money(montantTotal, station?.devise)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-slate-500">
              {loading
                ? "Chargement du catalogue…"
                : step === 1
                  ? "Étape 1/3 · Sélection du véhicule"
                  : step === 2
                    ? "Étape 2/3 · Choix du service"
                    : "Étape 3/3 · Vérification avant validation"}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (submitting) return;

                  if (step === 1) {
                    closeModal();
                  } else {
                    setError("");
                    setStep((current) => Math.max(1, current - 1));
                  }
                }}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
              >
                {step === 1 ? (
                  "Annuler"
                ) : (
                  <>
                    <ChevronLeft size={17} />
                    Précédent
                  </>
                )}
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={
                    loading ||
                    submitting ||
                    (step === 1 && !selectedType)
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#14233B] px-5 py-3 text-sm font-bold text-white hover:bg-[#203754] disabled:opacity-50 sm:flex-none"
                >
                  Suivant
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    loading ||
                    submitting ||
                    !selectedType ||
                    !selectedLaveur ||
                    !selectedPrestation ||
                    !selectedCaisse ||
                    !form.mode_paiement ||
                    !tarif ||
                    prixUnitaire <= 0 ||
                    !Number.isInteger(Number(quantite)) ||
                    Number(quantite) < 1 ||
                    Number(quantite) > 50
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#14233B] px-5 py-3 text-sm font-bold text-white hover:bg-[#203754] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle size={17} className="animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={17} />
                      Enregistrer
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
