
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  CircleDollarSign,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
  Trash2,
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


function getTodayAbidjan() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  // Format compatible avec un champ HTML datetime-local
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function getDateServicePourEnvoi(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  const [, date, heure, minute, seconde = "00"] = match;

  return `${date}T${heure}:${minute}:${seconde}`;
}

const EMPTY_FORM = {
  lavage_id: "",
  date_service: getTodayAbidjan(),
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

function paymentLabel(value) {
  return (
    PAYMENT_MODES.find(([code]) => code === value)?.[1] ||
    (value ? value.replaceAll("_", " ") : "Non renseigné")
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizedStatus(value) {
  return String(value || "")
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "_");
}

function isCompleted(operation) {
  return ["termine", "terminee", "termine avec succes"].includes(
    normalizedStatus(operation.statut)
  );
}

function isCancelled(operation) {
  return ["annule", "annulee", "cancelled", "canceled"].includes(
    normalizedStatus(operation.statut)
  );
}

function statusLabel(value) {
  const status = normalizedStatus(value);

  if (isCompleted({ statut: value })) return "Terminée";
  if (isCancelled({ statut: value })) return "Annulée";

  return value || "Non défini";
}

function statusClass(value) {
  if (isCompleted({ statut: value })) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (isCancelled({ statut: value })) {
    return "bg-red-50 text-red-700";
  }

  return "bg-amber-50 text-amber-700";
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
  min,
  max,
  step,
  disabled = false,
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30 disabled:bg-slate-100"
    />
  );
}

function Select({ value, onChange, required = false, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
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

function StatCard({ label, value, description, icon: Icon, valueColor }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
            <p
              className="mt-2 break-words text-2xl font-extrabold"
              style={{ color: valueColor || "#14233B" }}
            >
              {value}
            </p>
          <p className="mt-2 text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D8BD83]/20 text-[#14233B]">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

export default function ServicesPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [quantite, setQuantite] = useState(0);
  const [step, setStep] = useState(1);

  const [stations, setStations] = useState([]);
  const [types, setTypes] = useState([]);
  const [prestations, setPrestations] = useState([]);
  const [laveurs, setLaveurs] = useState([]);
  const [tarifs, setTarifs] = useState([]);
  const [caisses, setCaisses] = useState([]);
  const [operations, setOperations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [operationToDelete, setOperationToDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [vehicleSearch, setVehicleSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState("today");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyPayment, setHistoryPayment] = useState("all");
  const [historySort, setHistorySort] = useState("date_desc");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [currentDate, setCurrentDate] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [filterLaveur, setFilterLaveur] = useState("");
  const [filterTypeVehicule, setFilterTypeVehicule] = useState("");

  const [tempDateFrom, setTempDateFrom] = useState("");
  const [tempDateTo, setTempDateTo] = useState("");
  const [tempLaveur, setTempLaveur] = useState("");
  const [tempTypeVehicule, setTempTypeVehicule] = useState("");

  useEffect(() => {
    setCurrentDate(new Date());
    }, []);

  const update = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setSuccess("");
  }, []);

  const station = stations.find((s) => s.id === form.lavage_id) || null;

  const selectedType =
    types.find((x) => x.id === form.type_vehicule_id) || null;

  const selectedPrestation =
    prestations.find((x) => x.id === form.prestation_id) || null;

  const selectedLaveur =
    laveurs.find((x) => x.id === form.laveur_id) || null;

  const selectedCaisse =
    caisses.find((x) => x.id === form.caisse_id) || null;

  const tarif = useMemo(
    () =>
      tarifs.find(
        (t) =>
          t.type_vehicule_id === form.type_vehicule_id &&
          t.prestation_id === form.prestation_id &&
          t.actif === true
      ) || null,
    [tarifs, form.type_vehicule_id, form.prestation_id]
  );

  const prixUnitaire = Number(tarif?.prix || 0);
  const montantTotal = prixUnitaire * (Number(quantite) || 0);

  const filteredTypes = useMemo(() => {
    const q = vehicleSearch.trim().toLocaleLowerCase("fr");

    return types.filter((t) =>
      String(t.nom || "").toLocaleLowerCase("fr").includes(q)
    );
  }, [types, vehicleSearch]);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();

      if (authError || !auth?.user) {
        throw new Error("Connecte-toi pour accéder au module Lavage.");
      }

      const response = await fetch("/api/lavage/services", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Chargement des stations impossible.");
      }

      const list = result.stations || [];
      setStations(list);

      if (!list.length) {
        throw new Error("Aucune station active n'est disponible.");
      }

      setForm((prev) => ({
        ...prev,
        lavage_id: list.some((s) => s.id === prev.lavage_id)
          ? prev.lavage_id
          : list[0].id,
      }));
    } catch (e) {
      setError(e.message || "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalogue = useCallback(async (lavageId) => {
    if (!lavageId) return;

    setLoadingCatalogue(true);

    try {
      const requests = await Promise.all([
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

      const failed = requests.find((r) => r.error);
      if (failed) throw new Error(failed.error.message);

      const [
        typeResult,
        prestationResult,
        laveurResult,
        tarifResult,
        caisseResult,
      ] = requests;

      const nextTypes = typeResult.data || [];
      const nextPrestations = prestationResult.data || [];
      const nextLaveurs = laveurResult.data || [];
      const nextTarifs = tarifResult.data || [];
      const nextCaisses = caisseResult.data || [];

      setTypes(nextTypes);
      setPrestations(nextPrestations);
      setLaveurs(nextLaveurs);
      setTarifs(nextTarifs);
      setCaisses(nextCaisses);

      const caissePrincipale = nextCaisses.find(
        (c) =>
          String(c.code || "").trim().toUpperCase() === "PRINCIPALE"
      );

      setForm((prev) => ({
        ...prev,
        lavage_id: lavageId,

        type_vehicule_id: nextTypes.some(
          (x) => x.id === prev.type_vehicule_id
        )
          ? prev.type_vehicule_id
          : "",

        prestation_id: nextPrestations.some(
          (x) => x.id === prev.prestation_id
        )
          ? prev.prestation_id
          : "",

        laveur_id: nextLaveurs.some(
          (x) => x.id === prev.laveur_id
        )
          ? prev.laveur_id
          : "",

        caisse_id:
          caissePrincipale?.id ||
          nextCaisses[0]?.id ||
          "",
      }));
    } catch (e) {
      setError(e.message || "Impossible de charger le catalogue.");
    } finally {
      setLoadingCatalogue(false);
    }
  }, []);

  const loadOperations = useCallback(async (lavageId) => {
    if (!lavageId) {
      setOperations([]);
      return;
    }

    setLoadingOperations(true);

    try {
      const response = await fetch(
        `/api/lavage/services?lavage_id=${encodeURIComponent(lavageId)}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Impossible de charger l'historique."
        );
      }

      setOperations(
        Array.isArray(result.operations) ? result.operations : []
      );
    } catch (e) {
      setError(e.message || "Erreur de chargement de l'historique.");
    } finally {
      setLoadingOperations(false);
    }
  }, []);

  const refreshPage = useCallback(async (lavageId) => {
    if (!lavageId) return;

    await Promise.all([
      loadCatalogue(lavageId),
      loadOperations(lavageId),
    ]);
  }, [loadCatalogue, loadOperations]);

  function openDeleteModal(operation) {
    setError("");
    setSuccess("");
    setDeleteError("");
    setDeleteReason("");
    setOperationToDelete(operation);
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deleting) return;

    setDeleteModalOpen(false);
    setOperationToDelete(null);
    setDeleteReason("");
    setDeleteError("");
  }

  async function deleteOperation() {
    if (!station?.id || !operationToDelete?.id) {
      setDeleteError("Station ou opération introuvable.");
      return;
    }

    const motif = deleteReason.trim();

    if (motif.length < 3) {
      setDeleteError(
        "Le motif de suppression doit contenir au moins 3 caractères."
      );
      return;
    }

    setDeleting(true);
    setDeleteError("");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/lavage/services", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lavage_id: station.id,
          service_id: operationToDelete.id,
          motif,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Impossible de supprimer cette opération."
        );
      }

      setDeleteModalOpen(false);
      setOperationToDelete(null);
      setDeleteReason("");

      setSuccess(
        result.message ||
          "Opération archivée et supprimée avec succès."
      );

      await refreshPage(station.id);
    } catch (e) {
      setDeleteError(
        e.message || "Une erreur est survenue pendant la suppression."
      );
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  useEffect(() => {
    if (!form.lavage_id) return;

    loadCatalogue(form.lavage_id);
    loadOperations(form.lavage_id);
  }, [form.lavage_id, loadCatalogue, loadOperations]);

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) {
        setModalOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen, submitting]);

  function openModal() {
    setError("");
    setSuccess("");
    setStep(1);
    setQuantite(0);
    setVehicleSearch("");

    setForm((prev) => ({
      ...EMPTY_FORM,
      lavage_id: prev.lavage_id,
      date_service: getTodayAbidjan(),
      caisse_id:
        caisses.find(
          (c) => String(c.code || "").trim().toUpperCase() === "PRINCIPALE"
        )?.id || caisses[0]?.id || "",
    }));

    setModalOpen(true);
  }

  function changeStation(value) {
    const caissePrincipale = caisses.find(
      (c) =>
        c.lavage_id === value &&
        String(c.code || "").trim().toUpperCase() === "PRINCIPALE"
    );

    setForm({
      ...EMPTY_FORM,
      lavage_id: value,
      caisse_id: caissePrincipale?.id || "",
    });

    setOperations([]);
    setStep(1);
    setQuantite(1);
    setError("");
    setSuccess("");
  }

  function nextStep() {
    setError("");

    if (step === 1) {
      if (!form.date_service) {
        setError("Sélectionne la date de l'opération.");
        return;
      }

      if (form.date_service > getTodayAbidjan()) {
        setError("La date de l'opération ne peut pas être dans le futur.");
        return;
      }
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

  function previousStep() {
    setError("");
    setStep((current) => Math.max(1, current - 1));
  }

  function changeQuantity(value) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed)) return;

    setQuantite(Math.min(50, Math.max(1, parsed)));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!station) {
      setError("Sélectionne une station.");
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

    if (!selectedCaisse) {
      setError("Sélectionne une caisse active.");
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

    const quantiteFinale = Number(quantite);

    const dateService = getDateServicePourEnvoi(form.date_service);

    if (!dateService) {
      setError("La date et l'heure de l'opération sont obligatoires.");
      setStep(1);
      return;
    }

    if (dateService > getTodayAbidjan()) {
      setError("La date de l'opération ne peut pas être dans le futur.");
      setStep(1);
      return;
    }

    const payload = {
      date_service: dateService,
      type_vehicule_id: form.type_vehicule_id,
      laveur_id: form.laveur_id,
      caisse_id: form.caisse_id,
      mode_paiement: form.mode_paiement || null,
      reference_paiement: form.reference_paiement.trim() || null,
      notes: form.notes.trim() || null,
      quantite_operations: quantiteFinale,
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
        throw new Error(result.error || "Échec de l'enregistrement.");
      }

      setModalOpen(false);
      setSuccess(
        result.message ||
          `${quantiteFinale} opération(s) enregistrée(s) avec succès.`
      );

      setForm((prev) => ({
        ...EMPTY_FORM,
        lavage_id: prev.lavage_id,
        caisse_id: prev.caisse_id,
      }));

      setStep(1);
      setQuantite(1);

      await refreshPage(station.id);
    } catch (e) {
      setError(e.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  }

    function openFilterModal() {
      setTempDateFrom(historyDateFrom);
      setTempDateTo(historyDateTo);
      setTempLaveur(filterLaveur);
      setTempTypeVehicule(filterTypeVehicule);
      setFilterModalOpen(true);
    }

    function applyFilters() {
      if (tempDateFrom && tempDateTo && tempDateFrom > tempDateTo) {
        setError("La date de début doit être antérieure ou égale à la date de fin.");
        return;
      }

      setHistoryDateFrom(tempDateFrom);
      setHistoryDateTo(tempDateTo);
      setFilterLaveur(tempLaveur);
      setFilterTypeVehicule(tempTypeVehicule);

      // La période de la modale devient le filtre de dates principal.
      setHistoryPeriod(
        tempDateFrom || tempDateTo ? "custom" : "all"
      );

      setFilterModalOpen(false);
      setError("");
    }

  const filteredOperations = useMemo(() => {
    if (!currentDate) return [];

    const query = historySearch.trim().toLocaleLowerCase("fr");
    const now = currentDate;

    let from = null;
    let to = null;

    const startOfDay = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const endOfDay = (date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    if (historyPeriod === "today") {
      from = startOfDay(now);
      to = endOfDay(now);
    } else if (historyPeriod === "week") {
      from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      to = endOfDay(now);
    } else if (historyPeriod === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = endOfDay(now);
    } else if (historyPeriod === "custom") {
      if (historyDateFrom) {
        from = startOfDay(new Date(`${historyDateFrom}T00:00:00`));
      }

      if (historyDateTo) {
        to = endOfDay(new Date(`${historyDateTo}T00:00:00`));
      }
    }

    const result = operations.filter((op) => {
      const date = new Date(op.date_service || op.created_at);

      if (from && date < from) return false;
      if (to && date > to) return false;

            // Filtre par laveur
      if (
        filterLaveur &&
        String(op.laveur?.id || op.laveur_id || "") !== filterLaveur
      ) {
        return false;
      }

      
      // Filtre par type de véhicule
      if (filterTypeVehicule) {
        const selectedType = types.find(
          (type) =>
            String(type.id).trim().toLowerCase() ===
            String(filterTypeVehicule).trim().toLowerCase()
        );

        const operationTypeId =
          op.vehicule?.type_vehicule_id ??
          op.type_vehicule_id ??
          "";

        const matchesType =
          String(operationTypeId).trim().toLowerCase() ===
          String(filterTypeVehicule).trim().toLowerCase();

        if (!matchesType) return false;
      }

      const completed = isCompleted(op);
      const cancelled = isCancelled(op);

      if (historyStatus === "completed" && !completed) return false;
      if (historyStatus === "cancelled" && !cancelled) return false;

      if (
        historyStatus === "other" &&
        (completed || cancelled)
      ) {
        return false;
      }

      const mode = op.encaissement?.mode_paiement || "";

      if (historyPayment !== "all" && mode !== historyPayment) {
        return false;
      }

      const searchable = [
        op.vehicule?.immatriculation,
        op.client?.nom,
        op.client?.telephone,
        op.prestation?.nom,
        op.laveur?.nom,
        op.vehicule?.marque,
        op.vehicule?.modele,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr");

      return !query || searchable.includes(query);
    });

    result.sort((a, b) => {
      if (historySort === "amount_desc") {
        return Number(b.montant_total || 0) - Number(a.montant_total || 0);
      }

      if (historySort === "amount_asc") {
        return Number(a.montant_total || 0) - Number(b.montant_total || 0);
      }

      const dateA = new Date(a.date_service || a.created_at).getTime();
      const dateB = new Date(b.date_service || b.created_at).getTime();

      return historySort === "date_asc"
        ? dateA - dateB
        : dateB - dateA;
    });

    return result;
  }, [
    operations,
    historySearch,
    historyPeriod,
    historyStatus,
    historyPayment,
    historySort,
    historyDateFrom,
    historyDateTo,
    currentDate,
    filterLaveur,
    filterTypeVehicule,
    types,
  ]);

  const completedOperations = filteredOperations.filter(isCompleted);

  const chiffreAffaires = completedOperations.reduce(
    (total, op) => total + Number(op.montant_total || 0),
    0
  );

  const nombreOperations = completedOperations.length;

  const totalCommissionsLaveurs = completedOperations.reduce(
    (total, op) => total + Number(op.commission_laveur || 0),
    0
   );

   
  // Résultat après commissions, hors autres dépenses de la station.
  const beneficeNet = chiffreAffaires - totalCommissionsLaveurs;


  const ticketMoyen = nombreOperations
    ? chiffreAffaires / nombreOperations
    : 0;

    function resetFilters() {
    setHistorySearch("");
    setHistoryPeriod("today");
    setHistoryStatus("all");
    setHistoryPayment("all");
    setHistorySort("date_desc");
    setHistoryDateFrom("");
    setHistoryDateTo("");
    setFilterLaveur("");
    setFilterTypeVehicule("");
    setTempDateFrom("");
    setTempDateTo("");
    setTempLaveur("");
    setTempTypeVehicule("");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-[#14233B]" size={32} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F6F8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* BARRE DE NAVIGATION */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/lavage"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#14233B]"
          >
            <ArrowLeft size={17} />
            Retour au tableau de bord
          </Link>

          <button
            type="button"
            onClick={() => refreshPage(form.lavage_id)}
            disabled={loadingCatalogue || loadingOperations || !form.lavage_id}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                loadingCatalogue || loadingOperations ? "animate-spin" : ""
              }
            />
            Actualiser
          </button>
        </div>

        {/* EN-TÊTE */}
        <header className="mb-6 rounded-3xl bg-[#14233B] p-6 text-white sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="mb-3 text-xs font-bold tracking-widest text-[#D8BD83]">
                MAAX BUSINESS · LAVAGE
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Opérations de lavage
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Suis les prestations, les recettes et l'activité de ta station.
              </p>
            </div>

            <button
              type="button"
              onClick={openModal}
              disabled={!station || loadingCatalogue}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#D8BD83] px-5 py-3 font-bold text-[#14233B] transition hover:bg-[#e6d09f] disabled:opacity-50"
            >
              <Plus size={19} />
              Nouvelle opération
            </button>
          </div>
        </header>

        {stations.length > 1 && (
          <div className="mb-5 max-w-lg rounded-2xl border border-slate-200 bg-white p-4">
            <Field label="Station de lavage" required>
              <Select
                value={form.lavage_id}
                onChange={changeStation}
                required
              >
                <option value="">Sélectionner une station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {error && !modalOpen && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <CheckCircle2 size={19} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* RÉSUMÉ DE LA STATION */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Station sélectionnée
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-[#14233B]">
                {station?.nom || "Station de lavage"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {types.length} types de véhicules · {prestations.length} prestations ·{" "}
                {laveurs.length} laveurs · {caisses.length} caisses
              </p>
            </div>

            <button
              type="button"
              onClick={() => refreshPage(form.lavage_id)}
              disabled={loadingOperations || loadingCatalogue}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#14233B] hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  loadingOperations || loadingCatalogue ? "animate-spin" : ""
                }
              />
              Actualiser les données
            </button>
          </div>
        </section>

        {/* STATISTIQUES */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Chiffre d'affaires"
            value={money(chiffreAffaires, station?.devise)}
            description="Prestations terminées selon les filtres"
            icon={Banknote}
          />
          <StatCard
            label="Opérations terminées"
            value={nombreOperations.toLocaleString("fr-FR")}
            description="Prestations réalisées"
            icon={ClipboardCheck}
          />
          <StatCard
            label="Commissions des laveurs"
            value={money(totalCommissionsLaveurs, station?.devise)}
            description="Commissions des opérations terminées selon les filtres"
            icon={Wallet}
          />
          <StatCard
            label="Bénéfice net"
            value={money(beneficeNet, station?.devise)}
            description="CA − commissions, hors autres dépenses"
            icon={Wallet}
            valueColor="#1100ac"
          />
          {/*<StatCard
            label="Ticket moyen"
            value={money(ticketMoyen, station?.devise)}
            description="CA divisé par les opérations terminées"
            icon={CircleDollarSign}
          />*/}
        </div>

        {/* HISTORIQUE */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-extrabold text-[#14233B]">
                Historique des opérations
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredOperations.length} résultat(s) · {operations.length} opération(s) chargée(s)
              </p>
            </div>

            <button
              type="button"
              onClick={openFilterModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14233B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#203754]"
            >
              <CalendarDays size={16} />
              Filtrer
            </button>
          </div>

          {/* FILTRES */}
          <div className="space-y-4 border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Rechercher client, immatriculation, prestation, laveur…"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Période">
                <Select
                  value={historyPeriod}
                  onChange={setHistoryPeriod}
                >
                  <option value="today">Aujourd'hui</option>
                  <option value="week">7 derniers jours</option>
                  <option value="month">Ce mois-ci</option>
                  <option value="all">Toutes les dates</option>
                  <option value="custom">Période personnalisée</option>
                </Select>
              </Field>

              <Field label="Statut">
                <Select
                  value={historyStatus}
                  onChange={setHistoryStatus}
                >
                  <option value="all">Tous les statuts</option>
                  <option value="completed">Terminées</option>
                  <option value="cancelled">Annulées</option>
                  <option value="other">Autres statuts</option>
                </Select>
              </Field>

              <Field label="Mode de paiement">
                <Select
                  value={historyPayment}
                  onChange={setHistoryPayment}
                >
                  <option value="all">Tous les modes</option>
                  {PAYMENT_MODES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Trier par">
                <Select value={historySort} onChange={setHistorySort}>
                  <option value="date_desc">Plus récentes</option>
                  <option value="date_asc">Plus anciennes</option>
                  <option value="amount_desc">Montant décroissant</option>
                  <option value="amount_asc">Montant croissant</option>
                </Select>
              </Field>
            </div>

            {historyPeriod === "custom" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date de début">
                  <Input
                    type="date"
                    value={historyDateFrom}
                    onChange={setHistoryDateFrom}
                  />
                </Field>
                <Field label="Date de fin">
                  <Input
                    type="date"
                    value={historyDateTo}
                    onChange={setHistoryDateTo}
                  />
                </Field>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Les statistiques suivent les filtres actifs. Le chiffre d'affaires exclut les opérations annulées et non terminées.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-[#14233B] underline underline-offset-4"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>

          {/* TABLEAU DES OPÉRATIONS */}
          {loadingOperations ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle size={22} className="animate-spin text-[#14233B]" />
              Chargement de l'historique…
            </div>
          ) : filteredOperations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D8BD83]/20 text-[#14233B]">
                <CalendarDays size={26} />
              </div>
              <h3 className="mt-4 font-bold text-[#14233B]">
                Aucune opération trouvée
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Modifie les filtres ou enregistre une nouvelle prestation pour afficher les opérations ici.
              </p>
              <button
                type="button"
                onClick={openModal}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#14233B] px-4 py-3 text-sm font-bold text-white"
              >
                <Plus size={17} />
                Nouvelle opération
              </button>
            </div>
          ) : (
            <>
              {/* Affichage mobile en cartes */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredOperations.map((op) => (
                  <article key={op.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[#14233B]">
                          {op.vehicule?.immatriculation || "Sans immatriculation"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(op.date_service || op.created_at)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(op.statut)}`}
                      >
                        {statusLabel(op.statut)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Client</p>
                        <p className="mt-1 font-medium text-slate-800">
                          {op.client?.nom || "Client de passage"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Prestation</p>
                        <p className="mt-1 font-medium text-slate-800">
                          {op.prestation?.nom || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Laveur</p>
                        <p className="mt-1 font-medium text-slate-800">
                          {op.laveur?.nom || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Paiement</p>
                        <p className="mt-1 font-medium text-slate-800">
                          {paymentLabel(op.encaissement?.mode_paiement)}
                        </p>
                      </div>
                    </div>

                    
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="min-w-0">
                        <span className="text-xs text-slate-500">Montant</span>
                        <p className="text-lg font-extrabold text-[#14233B]">
                          {money(op.montant_total, station?.devise)}
                        </p>
                      </div>

                      {isCompleted(op) && (
                        <button
                          type="button"
                          onClick={() => openDeleteModal(op)}
                          disabled={deleting}
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          aria-label="Supprimer cette opération"
                        >
                          <Trash2 size={16} />
                          Supprimer
                        </button>
                      )}
                    </div>

                  </article>
                ))}
              </div>

              {/* Tableau desktop */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Date</th>
                      <th className="px-4 py-4 font-semibold">Véhicule</th>
                      <th className="px-4 py-4 font-semibold">Client</th>
                      <th className="px-4 py-4 font-semibold">Prestation</th>
                      <th className="px-4 py-4 font-semibold">Laveur</th>
                      <th className="px-4 py-4 font-semibold">Paiement</th>
                      <th className="px-4 py-4 text-right font-semibold">Montant</th>
                      <th className="px-4 py-4 font-semibold">Statut</th>
                      <th className="px-4 py-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOperations.map((op) => (
                      <tr key={op.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          {formatDate(op.date_service || op.created_at)}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-[#14233B]">
                            {op.vehicule?.immatriculation || "—"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[op.vehicule?.marque, op.vehicule?.modele]
                              .filter(Boolean)
                              .join(" ") || "Véhicule"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-800">
                            {op.client?.nom || "Client de passage"}
                          </p>
                          {op.client?.telephone && (
                            <p className="mt-1 text-xs text-slate-500">
                              {op.client.telephone}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-700">
                          {op.prestation?.nom || "—"}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {op.laveur?.nom || "—"}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {paymentLabel(op.encaissement?.mode_paiement)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-extrabold text-[#14233B]">
                          {money(op.montant_total, station?.devise)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(op.statut)}`}
                          >
                            {statusLabel(op.statut)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {isCompleted(op) && (
                            <button
                              type="button"
                              onClick={() => openDeleteModal(op)}
                              disabled={deleting}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                              aria-label="Supprimer cette opération"
                            >
                              <Trash2 size={15} />
                              Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                {filteredOperations.length} opération(s) affichée(s). Les résultats correspondent aux données renvoyées par l'API.
              </div>
            </>
          )}
        </section>
      </div>

      
      {/* MODALE : FILTRER LES PRESTATIONS */}
      {filterModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFilterModalOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="filters-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 bg-[#14233B] px-5 py-4 text-white">
              <div>
                <h2 id="filters-title" className="font-bold">
                  Filtrer les prestations
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  Choisis une période, un laveur et un véhicule.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                aria-label="Fermer les filtres"
                className="rounded-lg p-2 text-white hover:bg-white/10"
              >
                <X size={19} />
              </button>
            </header>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Date de début">
                  <Input
                    type="date"
                    value={tempDateFrom}
                    max={tempDateTo || undefined}
                    onChange={setTempDateFrom}
                  />
                </Field>

                <Field label="Date de fin">
                  <Input
                    type="date"
                    value={tempDateTo}
                    min={tempDateFrom || undefined}
                    onChange={setTempDateTo}
                  />
                </Field>
              </div>

              <Field label="Laveur">
                <Select
                  value={tempLaveur}
                  onChange={setTempLaveur}
                >
                  <option value="">Tous les laveurs</option>
                  {laveurs.map((laveur) => (
                    <option key={laveur.id} value={laveur.id}>
                      {laveur.nom}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Type de véhicule">
                <Select
                  value={tempTypeVehicule}
                  onChange={setTempTypeVehicule}
                >
                  <option value="">Tous les véhicules</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.nom}
                    </option>
                  ))}
                </Select>
              </Field>

              <p className="text-xs leading-5 text-slate-500">
                Les filtres s’appliquent ensemble à l’historique et aux statistiques.
                Laisse un champ vide pour ne pas limiter ce critère.
              </p>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setTempDateFrom("");
                    setTempDateTo("");
                    setTempLaveur("");
                    setTempTypeVehicule("");
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Effacer les champs
                </button>

                <button
                  type="button"
                  onClick={() => setFilterModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={applyFilters}
                  className="rounded-lg bg-[#14233B] px-4 py-2 text-sm font-bold text-white hover:bg-[#203754]"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </section>
        </div>
      )}


      {/* MODAL : CONFIRMATION DE SUPPRESSION */}
      {deleteModalOpen && operationToDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !deleting
            ) {
              closeDeleteModal();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-operation-title"
            className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <header className="flex items-center gap-3 bg-red-50 px-5 py-5 sm:px-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <Trash2 size={22} />
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  id="delete-operation-title"
                  className="text-lg font-extrabold text-[#14233B]"
                >
                  Supprimer l’opération ?
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Cette action sera archivée et régularisée en caisse.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                aria-label="Fermer"
                className="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </header>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-500">Véhicule</span>
                  <strong className="text-right text-[#14233B]">
                    {operationToDelete.vehicule?.immatriculation ||
                      "Sans immatriculation"}
                  </strong>
                </div>

                <div className="mt-3 flex justify-between gap-3 text-sm">
                  <span className="text-slate-500">Client</span>
                  <strong className="text-right text-[#14233B]">
                    {operationToDelete.client?.nom || "Client de passage"}
                  </strong>
                </div>

                <div className="mt-3 flex justify-between gap-3 text-sm">
                  <span className="text-slate-500">Prestation</span>
                  <strong className="text-right text-[#14233B]">
                    {operationToDelete.prestation?.nom || "—"}
                  </strong>
                </div>

                <div className="mt-3 flex justify-between gap-3 text-sm">
                  <span className="text-slate-500">Date</span>
                  <strong className="text-right text-[#14233B]">
                    {formatDate(
                      operationToDelete.date_service ||
                        operationToDelete.created_at
                    )}
                  </strong>
                </div>

                <div className="mt-3 flex justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
                  <span className="text-slate-600">Montant</span>
                  <strong className="text-right text-lg text-[#14233B]">
                    {money(
                      operationToDelete.montant_total,
                      station?.devise
                    )}
                  </strong>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
                L’opération sera conservée dans les archives avec son motif.
                Les encaissements seront régularisés dans la caisse.
                Une opération dont la commission est déjà payée ne pourra pas être supprimée.
              </div>

              <div>
                <label
                  htmlFor="delete-operation-reason"
                  className="mb-2 block text-sm font-bold text-[#14233B]"
                >
                  Motif de suppression <span className="text-red-600">*</span>
                </label>

                <textarea
                  id="delete-operation-reason"
                  value={deleteReason}
                  onChange={(event) => {
                    setDeleteReason(event.target.value);
                    setDeleteError("");
                  }}
                  placeholder="Ex. : opération enregistrée par erreur…"
                  rows={3}
                  maxLength={500}
                  required
                  disabled={deleting}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30 disabled:bg-slate-100"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Au moins 3 caractères · {deleteReason.trim().length}/500
                </p>
              </div>

              {deleteError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {deleteError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={deleteOperation}
                  disabled={deleting || deleteReason.trim().length < 3}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <LoaderCircle size={17} className="animate-spin" />
                      Suppression en cours…
                    </>
                  ) : (
                    <>
                      <Trash2 size={17} />
                      Confirmer la suppression
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}


      {/* MODAL : NOUVELLE OPÉRATION */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setModalOpen(false);
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
                  {station?.nom || "Station"} · Étape {step} sur 3
                </p>
              </div>

              <button
                type="button"
                onClick={() => !submitting && setModalOpen(false)}
                disabled={submitting}
                aria-label="Fermer la fenêtre"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
              >
                <X size={21} />
              </button>
            </header>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
                <StepIndicator step={step} />

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                  >
                    {error}
                  </div>
                )}

                
                {/* ÉTAPE 1 : VÉHICULE */}
                {step === 1 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">

                    {/* EN-TÊTE : TITRE À GAUCHE, DATE À DROITE */}
                    <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                      {/* TITRE */}
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#14233B] text-[#D8BD83]">
                          <CarFront size={24} />
                        </div>

                        <div>
                          <h2 className="text-xl font-bold text-[#14233B]">
                            Choisir le véhicule
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            Sélectionne le type de véhicule à laver.
                          </p>
                        </div>
                      </div>

                      {/* DATE À DROITE */}
                      <div className="w-full sm:w-64 lg:w-72 sm:shrink-0">
                        <Field label="Date de l'opération">
                          <input
                            type="datetime-local"
                            value={form.date_service || ""}
                            max={getTodayAbidjan()}
                            onChange={(e) => {
                              update("date_service", e.target.value);
                              setError("");
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30"
                          />
                        </Field>

                        <p className="mt-1.5 text-xs text-slate-500">
                          Date passée autorisée, date future interdite.
                        </p>
                      </div>
                    </div>

                    {/* RECHERCHE DU VÉHICULE */}
                    <div className="mb-4">
                      <Field label="Rechercher un type de véhicule">
                        <div className="relative">
                          <Search
                            size={17}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            value={vehicleSearch}
                            onChange={(e) => setVehicleSearch(e.target.value)}
                            placeholder="Voiture, moto, camion…"
                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/30"
                          />
                        </div>
                      </Field>
                    </div>

                    {/* LISTE DES VÉHICULES */}
                    {filteredTypes.length === 0 ? (
                      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                        Aucun type de véhicule actif trouvé. Vérifie le catalogue.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {filteredTypes.map((item) => (
                          <VehicleCard
                            key={item.id}
                            item={item}
                            active={form.type_vehicule_id === item.id}
                            onClick={() => update("type_vehicule_id", item.id)}
                          />
                        ))}
                      </div>
                    )}

                    {/* VÉHICULE SÉLECTIONNÉ */}
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

                  </div>
                )}


                {/* ÉTAPE 2 : LAVEUR ET PRESTATION */}
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
                        <p className="text-xs text-slate-500">Type de véhicule</p>
                        <p className="font-bold text-[#14233B]">{selectedType?.nom}</p>
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
                          onChange={(v) => update("laveur_id", v)}
                          required
                        >
                          <option value="">Sélectionner un laveur</option>
                          {laveurs.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nom}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      {laveurs.length === 0 && (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                          Aucun laveur actif. Ajoute d'abord un laveur dans le catalogue.
                        </p>
                      )}
                    </Section>

                    <Section
                      icon={Wallet}
                      title="Choisir le type de lavage"
                      description="Le tarif du véhicule est calculé automatiquement."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        {prestations.map((p) => {
                          const active = form.prestation_id === p.id;

                          const matchingTariff = tarifs.find(
                            (t) =>
                              t.type_vehicule_id === form.type_vehicule_id &&
                              t.prestation_id === p.id &&
                              t.actif === true &&
                              Number(t.prix) > 0
                          );

                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => update("prestation_id", p.id)}
                              className={`rounded-xl border-2 p-4 text-left transition ${
                                active
                                  ? "border-[#D8BD83] bg-[#D8BD83]/10"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-[#14233B]">{p.nom}</p>
                                  {p.description && (
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                      {p.description}
                                    </p>
                                  )}
                                  <p className="mt-3 text-sm font-semibold">
                                    {matchingTariff
                                      ? money(matchingTariff.prix, station?.devise)
                                      : "Tarif non défini"}
                                  </p>
                                </div>
                                {active && (
                                  <CheckCircle2 size={19} className="shrink-0 text-[#14233B]" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {prestations.length === 0 && (
                        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                          Aucun type de lavage actif n'est disponible.
                        </p>
                      )}

                      {form.prestation_id && !tarif && (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                          Aucun tarif actif n'est configuré pour cette combinaison.
                        </p>
                      )}
                    </Section>

                    {tarif && (
                      <div className="rounded-2xl bg-[#14233B] p-4 text-white">
                        <p className="text-sm text-slate-300">Tarif unitaire sélectionné</p>
                        <p className="mt-1 text-2xl font-extrabold text-[#D8BD83]">
                          {money(prixUnitaire, station?.devise)}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* ÉTAPE 3 : RÉCAPITULATIF */}
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
                              className="h-full max-h-40 w-full object-contain p-2"
                            />
                          ) : (
                            <CarFront size={48} className="text-slate-300" />
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-slate-500">Véhicule</p>
                            <p className="font-bold text-[#14233B]">{selectedType?.nom || "—"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-slate-500">Prestation</p>
                              <p className="font-semibold text-[#14233B]">{selectedPrestation?.nom || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Laveur</p>
                              <p className="font-semibold text-[#14233B]">{selectedLaveur?.nom || "—"}</p>
                            </div>
                          </div>
                          <p className="text-xl font-extrabold text-[#14233B]">
                            {money(prixUnitaire, station?.devise)} / prestation
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
                        <Field label="Nombre de prestations" required hint="Minimum 1, maximum 50.">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => changeQuantity(Number(quantite) - 1)}
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
                              onChange={(e) => {
                                if (e.target.value === "") {
                                  setQuantite("");
                                  return;
                                }
                                const parsed = Number(e.target.value);
                                if (Number.isInteger(parsed)) {
                                  setQuantite(Math.min(50, Math.max(1, parsed)));
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
                              onClick={() => changeQuantity(Number(quantite) + 1)}
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
                            {Number(quantite) || 0} × {money(prixUnitaire, station?.devise)}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">Montant total</p>
                          <p className="mt-1 break-words text-2xl font-extrabold text-[#D8BD83]">
                            {money(montantTotal, station?.devise)}
                          </p>
                        </div>
                      </div>

                      {Number(quantite) > 1 && (
                        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                          La validation créera {quantite} prestations distinctes associées au laveur sélectionné.
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
                            onChange={(v) => update("immatriculation", v.toUpperCase())}
                            placeholder="Ex. : AB 1234 CI"
                          />
                        </Field>
                        <Field label="Marque">
                          <Input
                            value={form.marque}
                            onChange={(v) => update("marque", v)}
                            placeholder="Ex. : Toyota"
                          />
                        </Field>
                        <Field label="Modèle">
                          <Input
                            value={form.modele}
                            onChange={(v) => update("modele", v)}
                            placeholder="Ex. : Corolla"
                          />
                        </Field>
                        <Field label="Couleur">
                          <Input
                            value={form.couleur}
                            onChange={(v) => update("couleur", v)}
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
                            onChange={(v) => update("client_nom", v)}
                            placeholder="Nom et prénom"
                          />
                        </Field>
                        <Field label="Téléphone">
                          <Input
                            value={form.client_telephone}
                            onChange={(v) => update("client_telephone", v)}
                            placeholder="Numéro du client"
                          />
                        </Field>
                        <Field label="E-mail">
                          <Input
                            type="email"
                            value={form.client_email}
                            onChange={(v) => update("client_email", v)}
                            placeholder="client@exemple.com"
                          />
                        </Field>
                      </div>
                    </Section>

                    <Section
                      icon={Banknote}
                      title="Encaissement"
                      description="Choisis la caisse et renseigne le mode de paiement si connu."
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Caisse" required>
                          <Select
                            value={form.caisse_id}
                            onChange={(v) => update("caisse_id", v)}
                            required
                          >
                            <option value="">Sélectionner une caisse</option>
                            {caisses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nom} ({c.code})
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Mode de paiement">
                          <Select
                            value={form.mode_paiement}
                            onChange={(v) => update("mode_paiement", v)}
                          >
                            <option value="">Non renseigné</option>
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
                            onChange={(v) => update("reference_paiement", v)}
                            placeholder="Référence de transaction"
                          />
                        </Field>

                        <Field label="Notes">
                          <Input
                            value={form.notes}
                            onChange={(v) => update("notes", v)}
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
                          <p className="font-bold text-[#14233B]">Vérification finale</p>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {[
                              ["Véhicule", selectedType?.nom],
                              ["Service", selectedPrestation?.nom],
                              ["Laveur", selectedLaveur?.nom],
                              ["Quantité", quantite],
                              ["Caisse", selectedCaisse?.nom],
                              ["Paiement", paymentLabel(form.mode_paiement)],
                            ].map(([label, value]) => (
                              <div key={label} className="flex justify-between gap-3">
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
              </div>

              {/* NAVIGATION DU FORMULAIRE */}
              <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-xs text-slate-500">
                  {step === 1
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
                        setModalOpen(false);
                      } else {
                        previousStep();
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
                      disabled={loadingCatalogue}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#14233B] px-5 py-3 text-sm font-bold text-white hover:bg-[#203754] disabled:opacity-50 sm:flex-none"
                    >
                      Suivant
                      <ArrowRight size={17} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={
                        submitting ||
                        loadingCatalogue ||
                        !selectedType ||
                        !selectedLaveur ||
                        !selectedPrestation ||
                        !selectedCaisse ||
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
      )}
    </main>
  );
}
