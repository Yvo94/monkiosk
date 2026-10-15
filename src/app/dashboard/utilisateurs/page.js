
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Pencil,
  X,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  UserRound,
  Phone,
  Mail,
  AlertTriangle,
  LoaderCircle,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";

const ROLES = [
  { value: "admin", label: "Administrateur" },
  { value: "gerant", label: "Gérant" },
  { value: "caissier", label: "Caissier" },
];

const ROLE_LABELS = {
  admin: "Administrateur",
  gerant: "Gérant",
  caissier: "Caissier",
};

const EMPTY_FORM = {
  nom: "",
  telephone: "",
  email: "",
  role: "caissier",
  actif: true,
};

function formatDate(date) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getInitials(nom) {
  const parts = String(nom || "").trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function RoleBadge({ role }) {
  const styles = {
    admin: "bg-violet-50 text-violet-700 ring-violet-200",
    gerant: "bg-blue-50 text-blue-700 ring-blue-200",
    caissier: "bg-gray-100 text-gray-700 ring-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[role] || styles.caissier
      }`}
    >
      {ROLE_LABELS[role] || role || "Non défini"}
    </span>
  );
}

function StatusBadge({ actif }) {
  return actif ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <CheckCircle2 size={13} />
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
      <XCircle size={13} />
      Inactif
    </span>
  );
}

function StatCard({ title, value, icon: Icon, description }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-2 text-xs text-gray-500">{description}</p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function UserModal({ open, user, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;

    setForm(
      user
        ? {
            nom: user.nom || "",
            telephone: user.telephone || "",
            email: user.email || user.auth_email || "",
            role: user.role || "caissier",
            actif: user.actif !== false,
          }
        : { ...EMPTY_FORM }
    );

    setPassword("");
    setShowPassword(false);
    setErrors({});
  }, [open, user]);

  if (!open) return null;

  function updateField(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }));

    setErrors((previous) => ({ ...previous, [name]: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};

    if (!form.nom.trim()) {
      nextErrors.nom = "Le nom est obligatoire.";
    }

    if (!form.telephone.trim()) {
      nextErrors.telephone = "Le téléphone est obligatoire.";
    }

    if (!form.email.trim()) {
      nextErrors.email =
        "L'e-mail est obligatoire pour le compte Supabase Auth.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      nextErrors.email = "L'adresse e-mail n'est pas valide.";
    }

    if (!user && password.length < 8) {
      nextErrors.password =
        "Le mot de passe doit contenir au moins 8 caractères.";
    }

    if (!form.role) {
      nextErrors.role = "Sélectionne un rôle.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit({
      nom: form.nom.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim(),
      role: form.role,
      actif: form.actif,
      ...(!user ? { password } : {}),
    });
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-slate-500 focus:ring-4 focus:ring-slate-100 disabled:bg-gray-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-5 sm:px-7">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {user ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {user
                ? "Modifie les informations du compte."
                : "Crée un compte et ses identifiants de connexion."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fermer"
            className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={21} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Nom complet *
              </label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => updateField("nom", e.target.value)}
                  placeholder="Ex. : Jean Kouassi"
                  autoComplete="name"
                  disabled={saving}
                  className={inputClass}
                />
              </div>
              {errors.nom && (
                <p className="mt-1 text-xs text-red-600">{errors.nom}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Téléphone *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) =>
                    updateField("telephone", e.target.value)
                  }
                  placeholder="+2250700000000"
                  autoComplete="tel"
                  disabled={saving}
                  className={inputClass}
                />
              </div>
              {errors.telephone && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.telephone}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Adresse e-mail *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="nom@exemple.com"
                  autoComplete="email"
                  disabled={saving}
                  className={inputClass}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Rôle *
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                <select
                  value={form.role}
                  onChange={(e) => updateField("role", e.target.value)}
                  disabled={saving}
                  className={inputClass}
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.role && (
                <p className="mt-1 text-xs text-red-600">{errors.role}</p>
              )}
            </div>
          </div>

          {!user && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Mot de passe initial *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((previous) => ({
                      ...previous,
                      password: "",
                    }));
                  }}
                  placeholder="Au moins 8 caractères"
                  autoComplete="new-password"
                  disabled={saving}
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-12 text-sm outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-100 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.password}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Le mot de passe sera transmis à Supabase Auth via l'API
                serveur. Il ne sera pas enregistré dans la table users.
              </p>
            </div>
          )}

          {user && (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={form.actif}
                onChange={(e) => updateField("actif", e.target.checked)}
                disabled={saving}
                className="mt-1 h-4 w-4 rounded border-gray-300 accent-slate-800"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-800">
                  Compte actif
                </span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">
                  Le statut sera enregistré dans le profil utilisateur.
                </span>
              </span>
            </label>
          )}

          {!user && (
            <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <AlertTriangle
                size={19}
                className="mt-0.5 shrink-0 text-blue-700"
              />
              <p className="text-sm leading-6 text-blue-900">
                Le compte sera créé avec le rôle sélectionné. Réserve le rôle
                administrateur aux personnes autorisées à gérer les comptes.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {saving
                ? "Enregistrement..."
                : user
                  ? "Enregistrer les modifications"
                  : "Créer le compte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UtilisateursPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("tous");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [notice, setNotice] = useState(null);

  const showNotice = useCallback((type, message) => {
    setNotice({ type, message });
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Impossible de charger les utilisateurs."
        );
      }

      setUsers(result.users || []);
    } catch (error) {
      console.error("Erreur chargement utilisateurs :", error);
      showNotice("error", error.message || "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const term = normalize(search);

    return users.filter((user) => {
      const matchesSearch =
        !term ||
        normalize(user.nom).includes(term) ||
        normalize(user.telephone).includes(term) ||
        normalize(user.email).includes(term) ||
        normalize(user.auth_email).includes(term);

      const matchesRole =
        roleFilter === "tous" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "tous" ||
        (statusFilter === "actif" && user.actif !== false) ||
        (statusFilter === "inactif" && user.actif === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: users.length,
      actifs: users.filter((user) => user.actif !== false).length,
      admins: users.filter((user) => user.role === "admin").length,
      gerants: users.filter((user) => user.role === "gerant").length,
      caissiers: users.filter((user) => user.role === "caissier").length,
    }),
    [users]
  );

  function openCreateModal() {
    setSelectedUser(null);
    setNotice(null);
    setModalOpen(true);
  }

  function openEditModal(user) {
    setSelectedUser(user);
    setNotice(null);
    setModalOpen(true);
  }

  async function handleSubmit(form) {
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: selectedUser ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          id: selectedUser?.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Enregistrement impossible.");
      }

      if (selectedUser) {
        setUsers((previous) =>
          previous.map((user) =>
            user.id === selectedUser.id ? result.user : user
          )
        );
      } else {
        setUsers((previous) => [result.user, ...previous]);
      }

      setModalOpen(false);

      showNotice(
        "success",
        selectedUser
          ? "Utilisateur modifié avec succès."
          : "Compte utilisateur créé avec succès."
      );
    } catch (error) {
      console.error("Erreur enregistrement utilisateur :", error);
      showNotice("error", error.message || "Erreur d'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user) {
    const nextStatus = user.actif === false;

    const confirmed = window.confirm(
      nextStatus
        ? `Réactiver le compte de ${user.nom} ?`
        : `Désactiver le compte de ${user.nom} ?`
    );

    if (!confirmed) return;

    setNotice(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          nom: user.nom,
          telephone: user.telephone,
          email: user.email || user.auth_email,
          role: user.role,
          actif: nextStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de modifier le statut.");
      }

      setUsers((previous) =>
        previous.map((item) =>
          item.id === user.id ? result.user : item
        )
      );

      showNotice(
        "success",
        nextStatus
          ? "Compte utilisateur réactivé."
          : "Compte utilisateur désactivé."
      );
    } catch (error) {
      console.error("Erreur changement statut :", error);
      showNotice("error", error.message || "Erreur de modification.");
    }
  }

  function resetFilters() {
    setSearch("");
    setRoleFilter("tous");
    setStatusFilter("tous");
  }

  const hasFilters =
    search !== "" || roleFilter !== "tous" || statusFilter !== "tous";

  return (
    <div className="min-h-screen space-y-6 bg-gray-50/70 p-4 sm:p-6 lg:p-8">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <Users size={16} />
            <span>Administration</span>
            <span>/</span>
            <span className="text-gray-800">Utilisateurs</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Gestion des utilisateurs
          </h1>

          <p className="mt-2 text-sm text-gray-500 sm:text-base">
            Gérez les profils, les rôles et les accès à MAAX Business.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Actualiser
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <UserPlus size={18} />
            Nouvel utilisateur
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          )}

          <p className="flex-1 text-sm font-medium leading-6">
            {notice.message}
          </p>

          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fermer le message"
            className="rounded-lg p-1 opacity-70 hover:bg-black/5 hover:opacity-100"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total utilisateurs"
          value={stats.total}
          icon={Users}
          description="Toutes les fiches enregistrées"
        />

        <StatCard
          title="Utilisateurs actifs"
          value={stats.actifs}
          icon={CheckCircle2}
          description="Comptes marqués actifs"
        />

        <StatCard
          title="Administrateurs"
          value={stats.admins}
          icon={ShieldCheck}
          description="Profils administrateurs"
        />

        <StatCard
          title="Gérants et caissiers"
          value={stats.gerants + stats.caissiers}
          icon={UserRound}
          description={`${stats.gerants} gérant(s) · ${stats.caissiers} caissier(s)`}
        />
      </div>

      {/* Liste des utilisateurs */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-gray-100 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Liste des utilisateurs
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Consultez et gérez les comptes enregistrés.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, téléphone, e-mail..."
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filtrer par rôle"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
            >
              <option value="tous">Tous les rôles</option>
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrer par statut"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
            >
              <option value="tous">Tous les statuts</option>
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">
                {filteredUsers.length}
              </span>{" "}
              utilisateur(s) affiché(s)
            </p>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-950"
              >
                <RotateCcw size={15} />
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8">
            <LoaderCircle
              size={30}
              className="animate-spin text-slate-700"
            />
            <p className="text-sm text-gray-500">
              Chargement des utilisateurs...
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <Users size={30} />
            </div>

            <h3 className="mt-5 text-lg font-bold text-gray-900">
              {users.length === 0
                ? "Aucun utilisateur enregistré"
                : "Aucun résultat"}
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              {users.length === 0
                ? "Commence par ajouter les utilisateurs de ton établissement."
                : "Aucun utilisateur ne correspond aux filtres sélectionnés."}
            </p>

            {users.length === 0 ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <UserPlus size={17} />
                Ajouter un utilisateur
              </button>
            ) : hasFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Réinitialiser les filtres
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Tableau ordinateur */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                      Utilisateur
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                      Contact
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                      Rôle
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                      Statut
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                      Création
                    </th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="transition hover:bg-gray-50/80"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                            {getInitials(user.nom)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {user.nom || "Sans nom"}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              ID : {String(user.id).slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm text-gray-800">
                          {user.telephone || "—"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {user.email || user.auth_email || "Aucun e-mail"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <RoleBadge role={user.role} />
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge actif={user.actif !== false} />
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            title="Modifier"
                            aria-label={`Modifier ${user.nom}`}
                            className="rounded-xl border border-gray-200 p-2.5 text-gray-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleStatus(user)}
                            title={
                              user.actif === false
                                ? "Réactiver"
                                : "Désactiver"
                            }
                            aria-label={
                              user.actif === false
                                ? `Réactiver ${user.nom}`
                                : `Désactiver ${user.nom}`
                            }
                            className={`rounded-xl border p-2.5 transition ${
                              user.actif === false
                                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                : "border-red-100 text-red-600 hover:bg-red-50"
                            }`}
                          >
                            {user.actif === false ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <XCircle size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes mobile */}
            <div className="divide-y divide-gray-100 md:hidden">
              {filteredUsers.map((user) => (
                <article key={user.id} className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700">
                      {getInitials(user.nom)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-gray-900">
                        {user.nom || "Sans nom"}
                      </h3>
                      <p className="mt-1 break-all text-sm text-gray-500">
                        {user.telephone || "—"}
                      </p>
                      <p className="mt-1 break-all text-xs text-gray-500">
                        {user.email || user.auth_email || "Aucun e-mail"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <RoleBadge role={user.role} />
                    <StatusBadge actif={user.actif !== false} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">
                      Créé le {formatDate(user.created_at)}
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil size={14} />
                        Modifier
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleStatus(user)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                          user.actif === false
                            ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            : "border-red-100 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        {user.actif === false ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <XCircle size={14} />
                        )}
                        {user.actif === false ? "Réactiver" : "Désactiver"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && filteredUsers.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-4">
            <p className="text-xs text-gray-500">
              {filteredUsers.length} utilisateur(s) sur {users.length}
            </p>
          </div>
        )}
      </section>

      <UserModal
        open={modalOpen}
        user={selectedUser}
        saving={saving}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
