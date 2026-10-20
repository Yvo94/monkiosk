
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  LoaderCircle,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
  X,
  AlertCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

const CATEGORIES = [
  "Achats de marchandises",
  "Approvisionnement",
  "Transport",
  "Loyer",
  "Électricité",
  "Eau",
  "Internet et téléphone",
  "Entretien et réparation",
  "Salaires",
  "Fournitures",
  "Taxes et impôts",
  "Autre",
];

const PAYMENT_MODES = [
  { value: "especes", label: "Espèces" },
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Money" },
  { value: "moov_money", label: "Moov Money" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement bancaire" },
  { value: "autre", label: "Autre" },
];

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR").format(Number(value) || 0);

const formatMoney = (value, currency = "FCFA") =>
  `${formatNumber(value)} ${currency}`;

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getLocalDateValue = (date) => {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getLocalTimeValue = (date) => {
  if (!date) return "";

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
};

const getPaymentLabel = (mode) => {
  const labels = {
    especes: "Espèces",
    wave: "Wave",
    orange_money: "Orange Money",
    mtn_money: "MTN Money",
    moov_money: "Moov Money",
    mobile_money: "Mobile Money",
    carte: "Carte bancaire",
    virement: "Virement bancaire",
    autre: "Autre",
  };

  return labels[mode] || mode || "—";
};

const getStatusLabel = (status) => {
  const labels = {
    payee: "Payée",
    en_attente: "En attente",
    annulee: "Annulée",
  };

  return labels[status] || status || "—";
};

const initialForm = {
  libelle: "",
  categorie: "Autre",
  montant: "",
  date: "",
  heure: "",
  mode_paiement: "especes",
  statut: "payee",
  notes: "",
};

export default function DepensesPage() {
  const [currentDate, setCurrentDate] = useState(null);

  const [kiosk, setKiosk] = useState(null);
  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("toutes");
  const [periodFilter, setPeriodFilter] = useState("mois");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [paymentFilter, setPaymentFilter] = useState("tous");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  // Chargement des données.
  // Retourne true si le chargement est réussi, sinon false.
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        window.location.href = "/login";
        return false;
      }

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

      const kioskData = result.kiosk;

      if (!kioskData) {
        setKiosk(null);
        setExpenses([]);
        setError("Aucun kiosque actif n'a été trouvé.");
        return false;
      }

      setKiosk(kioskData);

      const { data: expenseData, error: expenseError } = await supabase
        .from("kiosque_depenses")
        .select(
          "id, kiosque_id, session_id, libelle, categorie, montant, date_depense, mode_paiement, statut, notes, created_by, created_at"
        )
        .eq("kiosque_id", kioskData.id)
        .order("date_depense", { ascending: false })
        .limit(500);

      if (expenseError) throw expenseError;

      setExpenses(expenseData || []);

      return true;
    } catch (err) {
      console.error("Erreur de chargement des dépenses :", err);

      setError(
        err?.message || "Impossible de charger les dépenses."
      );

      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const now = new Date();

    setCurrentDate(now);

    setForm((previous) => ({
      ...previous,
      date: getLocalDateValue(now),
      heure: getLocalTimeValue(now),
    }));

    loadData();
  }, [loadData]);

  // Bornes de dates.
  const dateBounds = useMemo(() => {
    if (!currentDate) return null;

    const startToday = new Date(currentDate);
    startToday.setHours(0, 0, 0, 0);

    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);

    const startMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );

    const endMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1
    );

    const start7Days = new Date(startToday);
    start7Days.setDate(start7Days.getDate() - 6);

    const start30Days = new Date(startToday);
    start30Days.setDate(start30Days.getDate() - 29);

    return {
      startToday,
      endToday,
      startMonth,
      endMonth,
      start7Days,
      start30Days,
      now: currentDate,
    };
  }, [currentDate]);

  const validExpenses = useMemo(
    () => expenses.filter((expense) => expense.statut !== "annulee"),
    [expenses]
  );

  const todayExpenses = useMemo(() => {
    if (!dateBounds) return [];

    return validExpenses.filter((expense) => {
      const date = new Date(expense.date_depense);

      return (
        date >= dateBounds.startToday &&
        date < dateBounds.endToday
      );
    });
  }, [validExpenses, dateBounds]);

  const monthExpenses = useMemo(() => {
    if (!dateBounds) return [];

    return validExpenses.filter((expense) => {
      const date = new Date(expense.date_depense);

      return (
        date >= dateBounds.startMonth &&
        date < dateBounds.endMonth
      );
    });
  }, [validExpenses, dateBounds]);

  const paidTodayTotal = useMemo(
    () =>
      todayExpenses
        .filter((expense) => expense.statut === "payee")
        .reduce(
          (total, expense) => total + Number(expense.montant || 0),
          0
        ),
    [todayExpenses]
  );

  const paidMonthTotal = useMemo(
    () =>
      monthExpenses
        .filter((expense) => expense.statut === "payee")
        .reduce(
          (total, expense) => total + Number(expense.montant || 0),
          0
        ),
    [monthExpenses]
  );

  const pendingTotal = useMemo(
    () =>
      validExpenses
        .filter((expense) => expense.statut === "en_attente")
        .reduce(
          (total, expense) => total + Number(expense.montant || 0),
          0
        ),
    [validExpenses]
  );

  const filteredExpenses = useMemo(() => {
    if (!dateBounds) return [];

    const term = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        !term ||
        [
          expense.libelle,
          expense.categorie,
          expense.notes,
          getPaymentLabel(expense.mode_paiement),
          expense.mode_paiement,
          getStatusLabel(expense.statut),
          expense.statut,
          expense.montant,
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(term)
        );

      const matchesCategory =
        categoryFilter === "toutes" ||
        expense.categorie === categoryFilter;

      const matchesStatus =
        statusFilter === "tous" ||
        expense.statut === statusFilter;
    
      const matchesPayment =
        paymentFilter === "tous" ||
        expense.mode_paiement === paymentFilter;

      const date = new Date(expense.date_depense);

      let matchesPeriod = true;

      if (periodFilter === "aujourd_hui") {
        matchesPeriod =
          date >= dateBounds.startToday &&
          date < dateBounds.endToday;
      } else if (periodFilter === "7_jours") {
        matchesPeriod =
          date >= dateBounds.start7Days &&
          date <= dateBounds.now;
      } else if (periodFilter === "30_jours") {
        matchesPeriod =
          date >= dateBounds.start30Days &&
          date <= dateBounds.now;
      } else if (periodFilter === "mois") {
        matchesPeriod =
          date >= dateBounds.startMonth &&
          date < dateBounds.endMonth;
      }

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesPayment &&
        matchesPeriod
      );
    });
  }, [
    expenses,
    search,
    categoryFilter,
    statusFilter,
    paymentFilter,
    periodFilter,
    dateBounds,
  ]);

  const openForm = () => {
    const now = new Date();

    setError("");
    setSuccess("");

    setForm({
      ...initialForm,
      date: getLocalDateValue(now),
      heure: getLocalTimeValue(now),
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!kiosk) {
      setError("Aucun kiosque n'est sélectionné.");
      return;
    }

    const amount = Number(form.montant);

    if (!form.libelle.trim()) {
      setError("Veuillez saisir le libellé de la dépense.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Le montant doit être supérieur à zéro.");
      return;
    }

    if (!form.date || !form.heure) {
      setError("Veuillez renseigner la date et l'heure.");
      return;
    }

    const expenseDate = new Date(
      `${form.date}T${form.heure}:00`
    );

    if (Number.isNaN(expenseDate.getTime())) {
      setError("La date ou l'heure saisie est invalide.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        window.location.href = "/login";
        return;
      }

      // La fonction SQL effectue l'enregistrement transactionnel.
      const { error: insertError } = await supabase.rpc(
        "enregistrer_depense",
        {
          p_kiosque_id: kiosk.id,
          p_libelle: form.libelle.trim(),
          p_categorie: form.categorie,
          p_montant: amount,
          p_date_depense: expenseDate.toISOString(),
          p_mode_paiement: form.mode_paiement,
          p_statut: form.statut,
          p_notes: form.notes.trim() || null,
        }
      );

      if (insertError) throw insertError;

      // Fermer le formulaire et supprimer les anciens filtres.
      setShowForm(false);
      setSearch("");
      setCategoryFilter("toutes");
      setStatusFilter("tous");
      setPaymentFilter("tous");

      // Une date passée ne doit pas masquer la nouvelle dépense.
      setPeriodFilter("tous");

      const refreshed = await loadData(true);

      if (refreshed) {
        setSuccess(
          "La dépense a été enregistrée et la liste a été actualisée."
        );
      } else {
        setSuccess(
          "La dépense a été enregistrée, mais la liste n'a pas pu être actualisée. Utilisez le bouton Actualiser."
        );
      }
    } catch (err) {
      console.error(
        "Erreur d'enregistrement de la dépense :",
        err
      );

      setError(
        err?.message || "Impossible d'enregistrer cette dépense."
      );
    } finally {
      setSaving(false);
    }
  };

  const currency = kiosk?.devise || "FCFA";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <LoaderCircle className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm">Chargement des dépenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link
              href="/dashboard"
              className="transition hover:text-indigo-600"
            >
              Tableau de bord
            </Link>

            <ChevronRight className="h-4 w-4" />

            <span className="text-slate-700">Dépenses</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Gestion des dépenses
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Enregistrez et suivez les dépenses de votre kiosque.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Actualiser
          </button>

          <button
            type="button"
            onClick={openForm}
            disabled={!kiosk}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div className="min-w-0 flex-1">{error}</div>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Fermer le message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

          <div className="min-w-0 flex-1">{success}</div>

          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Fermer le message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Indicateurs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Dépenses payées aujourd'hui
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMoney(paidTodayTotal, currency)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {todayExpenses.filter((e) => e.statut === "payee").length}{" "}
                dépense(s) payée(s)
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-3 text-red-600">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Dépenses payées ce mois
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMoney(paidMonthTotal, currency)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Total des dépenses réglées
              </p>
            </div>

            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Dépenses en attente
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMoney(pendingTotal, currency)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Montant restant à régler
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Nombre de dépenses
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatNumber(validExpenses.length)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Dépenses hors annulations
              </p>
            </div>

            <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      
    {/* Information caisse */}
    <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-950">
        <div className="shrink-0 rounded-xl bg-white p-2 text-indigo-600 shadow-sm">
            <Wallet className="h-5 w-5" />
        </div>
    <div>
        <p className="font-semibold">
        Impact sur la caisse
        </p>

        <p className="mt-1 leading-6 text-indigo-900/80">
        Les dépenses réglées en espèces sont déduites du solde
        de la caisse. Les paiements par mobile money, carte bancaire
        ou virement sont suivis séparément de la caisse espèces.
        </p>
    </div>
    </div>


      {/* Historique des dépenses */}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-col gap-4">
        <div>
            <h2 className="text-lg font-bold text-slate-900">
            Historique des dépenses
            </h2>

            <p className="mt-1 text-sm text-slate-500">
            Consultez et filtrez les dépenses enregistrées.
            </p>
        </div>

        {/* Recherche au-dessus des filtres */}
        <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une dépense..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
        </div>

        {/* Les quatre filtres sur une seule ligne */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
            <option value="toutes">Toutes les catégories</option>

            {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                {category}
                </option>
            ))}
            </select>

            <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
            <option value="tous">Tous les modes de paiement</option>

            {PAYMENT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                {mode.label}
                </option>
            ))}
            </select>

            <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
            <option value="tous">Toutes les périodes</option>
            <option value="aujourd_hui">Aujourd'hui</option>
            <option value="7_jours">7 derniers jours</option>
            <option value="30_jours">30 derniers jours</option>
            <option value="mois">Ce mois-ci</option>
            </select>

            <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
            <option value="tous">Tous les statuts</option>
            <option value="payee">Payées</option>
            <option value="en_attente">En attente</option>
            <option value="annulee">Annulées</option>
            </select>
        </div>
        </div>
    </div>

    <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Libellé</th>
                <th className="px-5 py-4 font-semibold">Catégorie</th>
                <th className="px-5 py-4 font-semibold">Paiement</th>
                <th className="px-5 py-4 font-semibold">Statut</th>
                <th className="px-5 py-4 text-right font-semibold">
                  Montant
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="transition hover:bg-slate-50/80"
                >
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {formatDateTime(expense.date_depense)}
                  </td>

                  <td className="max-w-xs px-5 py-4">
                    <p className="truncate font-semibold text-slate-800">
                      {expense.libelle}
                    </p>

                    {expense.notes && (
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {expense.notes}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {expense.categorie}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {getPaymentLabel(expense.mode_paiement)}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        expense.statut === "payee"
                          ? "bg-emerald-50 text-emerald-700"
                          : expense.statut === "en_attente"
                            ? "bg-amber-50 text-amber-700"
                            : expense.statut === "annulee"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {getStatusLabel(expense.statut)}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-red-600">
                    −{formatMoney(expense.montant, currency)}
                  </td>
                </tr>
              ))}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 rounded-2xl bg-slate-100 p-4 text-slate-400">
                        <Receipt className="h-7 w-7" />
                      </div>

                      <p className="font-semibold text-slate-700">
                        Aucune dépense trouvée
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Modifiez les filtres ou enregistrez une nouvelle
                        dépense.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {formatNumber(filteredExpenses.length)} dépense(s) affichée(s)
          </span>

          <span>
            {currentDate
              ? currentDate.toLocaleDateString("fr-FR")
              : "Chargement de la date..."}
          </span>
        </div>
    </section>

      {/* Formulaire d'ajout */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              closeForm();
            }
          }}
        >
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Nouvelle dépense
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Renseignez les informations de la dépense.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Fermer"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="libelle"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Libellé de la dépense *
                </label>

                <input
                  id="libelle"
                  name="libelle"
                  required
                  maxLength={200}
                  value={form.libelle}
                  onChange={handleChange}
                  placeholder="Ex. : Achat de boissons"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="categorie"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Catégorie *
                  </label>

                  <select
                    id="categorie"
                    name="categorie"
                    required
                    value={form.categorie}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="montant"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Montant ({currency}) *
                  </label>

                  <div className="relative">
                    <CircleDollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                    <input
                      id="montant"
                      name="montant"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="decimal"
                      required
                      value={form.montant}
                      onChange={handleChange}
                      placeholder="Ex. : 5000"
                      className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="date"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Date *
                  </label>

                  <input
                    id="date"
                    name="date"
                    type="date"
                    required
                    value={form.date}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="heure"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Heure *
                  </label>

                  <input
                    id="heure"
                    name="heure"
                    type="time"
                    required
                    value={form.heure}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="mode_paiement"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Mode de paiement *
                  </label>

                  <select
                    id="mode_paiement"
                    name="mode_paiement"
                    required
                    value={form.mode_paiement}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="statut"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Statut *
                  </label>

                  <select
                    id="statut"
                    name="statut"
                    required
                    value={form.statut}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="payee">Payée</option>
                    <option value="en_attente">En attente</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Notes complémentaires
                </label>

                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Informations complémentaires (facultatif)"
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving || !kiosk}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Enregistrer la dépense
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
