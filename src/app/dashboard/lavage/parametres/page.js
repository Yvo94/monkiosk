
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Settings,
  Store,
  ShieldCheck,
  Wallet,
  Save,
  RefreshCw,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  LockKeyhole,
  RotateCcw,
  CarFront,
  Droplets,
  Users,
  ReceiptText,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

// =====================================================
// NAVIGATION
// =====================================================

const NAVIGATION = [
  { id: "structure", label: "Informations de la station", icon: Store },
  { id: "permissions", label: "Profils et autorisations", icon: ShieldCheck },
  { id: "prestations", label: "Prestations et reçus", icon: ReceiptText },
  { id: "caisse", label: "Caisse et paiements", icon: Wallet },
];

// =====================================================
// MODULES LAVAGE
// Les identifiants doivent correspondre à ceux de l'API.
// =====================================================

const MODULES = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "prestations", label: "Prestations" },
  { id: "laveurs", label: "Laveurs" },
  { id: "vehicules", label: "Types de véhicules" },
  { id: "types_lavage", label: "Types de lavage" },
  { id: "tarifs", label: "Tarifs" },
  { id: "depenses", label: "Dépenses" },
  { id: "previsions", label: "Prévisions financières" },
  { id: "synthese_financiere", label: "Synthèse financière" },
  { id: "statistiques", label: "Statistiques" },
  { id: "caisses", label: "Caisses / Coffres" },
  { id: "utilisateurs", label: "Utilisateurs" },
  { id: "parametres", label: "Paramètres" },
];

const ACTIONS = [
  { id: "consulter", label: "Consulter" },
  { id: "creer", label: "Créer" },
  { id: "modifier", label: "Modifier" },
  { id: "supprimer", label: "Supprimer" },
];

// =====================================================
// PERMISSIONS PAR DÉFAUT
// =====================================================

function defaultPermissions() {
  const gerant = {};
  const caissier = {};

  MODULES.forEach(({ id }) => {
    gerant[id] = {
      consulter: true,
      creer: true,
      modifier: true,
      supprimer: false,
    };

    caissier[id] = {
      consulter: false,
      creer: false,
      modifier: false,
      supprimer: false,
    };
  });

  // Restrictions du gérant.
  gerant.utilisateurs = {
    consulter: true,
    creer: false,
    modifier: false,
    supprimer: false,
  };

  gerant.parametres = {
    consulter: true,
    creer: false,
    modifier: false,
    supprimer: false,
  };

  // Droits du caissier.
  [
    "dashboard",
    "prestations",
    "laveurs",
    "vehicules",
    "types_lavage",
    "tarifs",
    "caisses",
  ].forEach((id) => {
    caissier[id] = {
      consulter: true,
      creer: false,
      modifier: false,
      supprimer: false,
    };
  });

  caissier.prestations.creer = true;

  return { gerant, caissier };
}

// =====================================================
// CONFIGURATION INITIALE
// =====================================================

const DEFAULT_SETTINGS = {
  structure: {
    nom: "",
    telephone: "",
    adresse: "",
    email: "",
    devise: "XOF",
  },

  permissions: defaultPermissions(),

  prestations: {
    afficherNomStation: true,
    afficherTelephone: true,
    afficherAdresse: true,
    messageRecu: "Merci pour votre confiance !",
  },

  caisse: {
    especes: true,
    wave: true,
    orange_money: true,
    mtn_money: true,
    moov_money: true,
    carte: false,
    virement: false,
    autre: false,
  },
};

// =====================================================
// STYLES
// =====================================================

const inputClass =
  "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 disabled:bg-gray-100";

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>

        {description && (
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {label}

      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClass}
      />
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-xl border border-gray-100 p-4 transition ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-gray-50"
      }`}
    >
      <span>
        <span className="block text-sm font-semibold text-gray-800">
          {label}
        </span>

        {description && (
          <span className="mt-1 block text-xs leading-5 text-gray-500">
            {description}
          </span>
        )}
      </span>

      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 shrink-0 accent-slate-900"
      />
    </label>
  );
}

function Notice({ notice }) {
  if (!notice) return null;

  const success = notice.type === "success";

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {success ? (
        <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
      ) : (
        <AlertCircle size={19} className="mt-0.5 shrink-0" />
      )}

      <p>{notice.message}</p>
    </div>
  );
}

// =====================================================
// PAGE PARAMÈTRES LAVAGE
// =====================================================

export default function ParametresPage() {
  const router = useRouter();

  const [activeSection, setActiveSection] = useState("structure");

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState(null);

  const [lavage, setLavage] = useState(null);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState(null);

  // ===================================================
  // MODIFICATIONS NON ENREGISTRÉES
  // ===================================================

  const isDirty = useMemo(
    () =>
      initialSettings !== null &&
      JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [settings, initialSettings]
  );

  // ===================================================
  // CHARGEMENT DES PARAMÈTRES
  // ===================================================

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/lavage/settings", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await response.json();

      if (response.status === 401) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Impossible de charger les paramètres."
        );
      }

      const stored = result.configuration || {};

      // Fusionner les paramètres enregistrés avec les valeurs par défaut.
      const merged = {
        ...DEFAULT_SETTINGS,
        ...stored,

        structure: {
          ...DEFAULT_SETTINGS.structure,
          ...(stored.structure || {}),

          nom: result.lavage?.nom ??
            stored.structure?.nom ??
            "",

          devise: result.lavage?.devise ??
            stored.structure?.devise ??
            "XOF",
        },

        permissions: {
          gerant: {
            ...defaultPermissions().gerant,
            ...(stored.permissions?.gerant || {}),
          },

          caissier: {
            ...defaultPermissions().caissier,
            ...(stored.permissions?.caissier || {}),
          },
        },

        prestations: {
          ...DEFAULT_SETTINGS.prestations,
          ...(stored.prestations || {}),
        },

        caisse: {
          ...DEFAULT_SETTINGS.caisse,
          ...(stored.caisse || {}),
        },
      };

      // Garantir les permissions de chaque module et action.
      ["gerant", "caissier"].forEach((role) => {
        MODULES.forEach(({ id }) => {
          merged.permissions[role][id] = {
            ...defaultPermissions()[role][id],
            ...(stored.permissions?.[role]?.[id] || {}),
          };
        });
      });

      setSettings(merged);

      setInitialSettings(
        JSON.parse(JSON.stringify(merged))
      );

      setLavage(result.lavage || null);
      setUser(result.user || null);
    } catch (error) {
      console.error("Chargement des paramètres Lavage :", error);

      setNotice({
        type: "error",
        message:
          error.message ||
          "Erreur pendant le chargement des paramètres.",
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ===================================================
  // MISE À JOUR DES GROUPES
  // ===================================================

  function updateGroup(group, field, value) {
    setSettings((previous) => ({
      ...previous,

      [group]: {
        ...previous[group],
        [field]: value,
      },
    }));

    setNotice(null);
  }

  // ===================================================
  // MISE À JOUR DES PERMISSIONS
  // ===================================================

  function updatePermission(role, moduleId, action, checked) {
    setSettings((previous) => ({
      ...previous,

      permissions: {
        ...previous.permissions,

        [role]: {
          ...previous.permissions[role],

          [moduleId]: {
            ...previous.permissions[role][moduleId],
            [action]: checked,
          },
        },
      },
    }));

    setNotice(null);
  }

  // ===================================================
  // ENREGISTREMENT
  // ===================================================

  async function saveSettings(event) {
    event.preventDefault();

    setSaving(true);
    setNotice(null);

    try {
      if (!Object.values(settings.caisse).some(Boolean)) {
        throw new Error(
          "Active au moins un moyen de paiement."
        );
      }

      const response = await fetch("/api/lavage/settings", {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "same-origin",

        body: JSON.stringify({
          configuration: settings,
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Impossible d'enregistrer les paramètres."
        );
      }

      const savedConfiguration = result.configuration || settings;

      const savedSettings = {
        ...DEFAULT_SETTINGS,
        ...savedConfiguration,

        structure: {
          ...DEFAULT_SETTINGS.structure,
          ...(savedConfiguration.structure || {}),
          nom: result.lavage?.nom ??
            savedConfiguration.structure?.nom ??
            "",
          devise: result.lavage?.devise ??
            savedConfiguration.structure?.devise ??
            "XOF",
        },

        permissions: {
          gerant: {
            ...defaultPermissions().gerant,
            ...(savedConfiguration.permissions?.gerant || {}),
          },

          caissier: {
            ...defaultPermissions().caissier,
            ...(savedConfiguration.permissions?.caissier || {}),
          },
        },

        prestations: {
          ...DEFAULT_SETTINGS.prestations,
          ...(savedConfiguration.prestations || {}),
        },

        caisse: {
          ...DEFAULT_SETTINGS.caisse,
          ...(savedConfiguration.caisse || {}),
        },
      };

      setSettings(savedSettings);

      setInitialSettings(
        JSON.parse(JSON.stringify(savedSettings))
      );

      if (result.lavage) {
        setLavage(result.lavage);
      }

      setNotice({
        type: "success",
        message: "Les paramètres de la station ont été enregistrés avec succès.",
      });
    } catch (error) {
      console.error("Enregistrement paramètres Lavage :", error);

      setNotice({
        type: "error",
        message:
          error.message ||
          "Erreur pendant l'enregistrement des paramètres.",
      });
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // ANNULATION DES MODIFICATIONS
  // ===================================================

  function resetChanges() {
    if (!initialSettings) return;

    setSettings(
      JSON.parse(JSON.stringify(initialSettings))
    );

    setNotice(null);
  }

  const activeNav = NAVIGATION.find(
    (item) => item.id === activeSection
  );

  // ===================================================
  // CHARGEMENT
  // ===================================================

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <LoaderCircle size={22} className="animate-spin" />
          Chargement des paramètres...
        </div>
      </div>
    );
  }

  // ===================================================
  // AFFICHAGE
  // ===================================================

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-10 sm:px-6 lg:px-8">

      {/* ===============================================
          EN-TÊTE
      ================================================ */}

      <header className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8">

          <div>
            <div className="mb-3 flex items-center gap-2 text-amber-300">
              <Settings size={20} />

              <span className="text-xs font-bold uppercase tracking-[0.2em]">
                MAAX Business
              </span>
            </div>

            <h1 className="text-2xl font-bold sm:text-3xl">
              Paramètres du lavage
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Configure les informations de ta station, les
              autorisations des utilisateurs et les règles de
              fonctionnement de ton activité de lavage.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:min-w-52">

            <p className="text-xs text-slate-400">
              Station connectée
            </p>

            <p className="mt-1 font-semibold">
              {lavage?.nom || settings.structure.nom || "Ma station de lavage"}
            </p>

            <p className="mt-2 text-xs text-amber-300">
              {user?.nom || "Utilisateur connecté"}
              {user?.role ? ` · ${user.role}` : ""}
            </p>

          </div>
        </div>
      </header>

      <Notice notice={notice} />

      <form onSubmit={saveSettings} className="space-y-6">

        {/* =============================================
            NAVIGATION DES SECTIONS
        ============================================== */}

        <nav className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">

          {NAVIGATION.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50/40"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    active
                      ? "bg-amber-400/15 text-amber-300"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Icon size={20} />
                </span>

                <span className="text-sm font-semibold">
                  {label}
                </span>
              </button>
            );
          })}

        </nav>

        {/* =============================================
            INFORMATIONS DE LA STATION
        ============================================== */}

        {activeSection === "structure" && (
          <SectionCard
            title="Informations de la station"
            description="Les informations générales de ton établissement."
          >

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              <Field
                label="Nom de la station"
                value={settings.structure.nom}
                onChange={(value) =>
                  updateGroup("structure", "nom", value)
                }
                placeholder="Ex. : Pamya Lavage Auto"
              />

              <Field
                label="Téléphone"
                value={settings.structure.telephone}
                onChange={(value) =>
                  updateGroup("structure", "telephone", value)
                }
                placeholder="+225 07 00 00 00 00"
                type="tel"
              />

              <Field
                label="Adresse e-mail"
                value={settings.structure.email}
                onChange={(value) =>
                  updateGroup("structure", "email", value)
                }
                placeholder="contact@exemple.com"
                type="email"
              />

              <label className="block text-sm font-semibold text-gray-700">
                Devise

                <select
                  value={settings.structure.devise}
                  onChange={(event) =>
                    updateGroup(
                      "structure",
                      "devise",
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="XOF">FCFA (XOF)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="USD">Dollar américain (USD)</option>
                </select>
              </label>

              <div className="md:col-span-2">
                <Field
                  label="Adresse physique"
                  value={settings.structure.adresse}
                  onChange={(value) =>
                    updateGroup("structure", "adresse", value)
                  }
                  placeholder="Commune, quartier, rue..."
                />
              </div>

            </div>

            <div className="mt-5 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">

              <Store size={20} className="mt-0.5 shrink-0" />

              <p className="leading-6">
                Le nom et la devise sont enregistrés directement
                dans la table des stations de lavage. Les autres
                informations sont conservées dans la configuration
                de la station.
              </p>

            </div>
          </SectionCard>
        )}

        {/* =============================================
            PROFILS ET AUTORISATIONS
        ============================================== */}

        {activeSection === "permissions" && (
          <div className="space-y-5">

            <SectionCard
              title="Profils et autorisations"
              description="Définis les opérations permises à chaque profil, module par module."
            >

              <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">

                <LockKeyhole size={20} className="mt-0.5 shrink-0" />

                <p className="leading-6">
                  Ces réglages constituent la configuration des droits.
                  Pour être réellement appliqués, ils doivent également
                  être contrôlés par les API serveur. L'administrateur
                  conserve ses privilèges propres.
                </p>

              </div>

              {["gerant", "caissier"].map((role) => (

                <div key={role} className="mb-7 last:mb-0">

                  <div className="mb-3 flex items-center justify-between gap-3">

                    <div>
                      <h3 className="font-bold text-gray-900">
                        {role === "gerant" ? "Gérant" : "Caissier"}
                      </h3>

                      <p className="mt-1 text-xs text-gray-500">
                        {role === "gerant"
                          ? "Gestion opérationnelle de la station."
                          : "Gestion des opérations quotidiennes et encaissements."}
                      </p>
                    </div>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {MODULES.length} modules
                    </span>

                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200">

                    <table className="w-full min-w-[650px] border-collapse text-sm">

                      <thead className="bg-gray-50">
                        <tr>

                          <th className="px-4 py-3 text-left font-semibold text-gray-600">
                            Module
                          </th>

                          {ACTIONS.map((action) => (
                            <th
                              key={action.id}
                              className="px-3 py-3 text-center font-semibold text-gray-600"
                            >
                              {action.label}
                            </th>
                          ))}

                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">

                        {MODULES.map((module) => (

                          <tr
                            key={module.id}
                            className="hover:bg-gray-50/70"
                          >

                            <td className="px-4 py-3 font-medium text-gray-800">
                              {module.label}
                            </td>

                            {ACTIONS.map((action) => (

                              <td
                                key={action.id}
                                className="px-3 py-3 text-center"
                              >

                                <input
                                  type="checkbox"
                                  aria-label={`${role} - ${module.label} - ${action.label}`}
                                  checked={Boolean(
                                    settings.permissions[role]?.[module.id]?.[
                                      action.id
                                    ]
                                  )}
                                  onChange={(event) =>
                                    updatePermission(
                                      role,
                                      module.id,
                                      action.id,
                                      event.target.checked
                                    )
                                  }
                                  className="h-4 w-4 cursor-pointer rounded accent-slate-900"
                                />

                              </td>

                            ))}

                          </tr>

                        ))}

                      </tbody>
                    </table>

                  </div>

                </div>

              ))}

            </SectionCard>

          </div>
        )}

        {/* =============================================
            PRESTATIONS ET REÇUS
        ============================================== */}

        {activeSection === "prestations" && (
          <SectionCard
            title="Prestations et reçus"
            description="Configure les informations qui seront affichées sur les reçus remis aux clients."
          >

            <div className="space-y-3">

              <Toggle
                label="Afficher le nom de la station"
                checked={settings.prestations.afficherNomStation}
                onChange={(value) =>
                  updateGroup(
                    "prestations",
                    "afficherNomStation",
                    value
                  )
                }
              />

              <Toggle
                label="Afficher le téléphone"
                checked={settings.prestations.afficherTelephone}
                onChange={(value) =>
                  updateGroup(
                    "prestations",
                    "afficherTelephone",
                    value
                  )
                }
              />

              <Toggle
                label="Afficher l'adresse"
                checked={settings.prestations.afficherAdresse}
                onChange={(value) =>
                  updateGroup(
                    "prestations",
                    "afficherAdresse",
                    value
                  )
                }
              />

            </div>

            <div className="mt-5">

              <label className="block text-sm font-semibold text-gray-700">

                Message de bas de reçu

                <textarea
                  rows={3}
                  maxLength={250}
                  value={settings.prestations.messageRecu}
                  onChange={(event) =>
                    updateGroup(
                      "prestations",
                      "messageRecu",
                      event.target.value
                    )
                  }
                  placeholder="Merci pour votre confiance !"
                  className={inputClass}
                />

              </label>

              <p className="mt-2 text-xs text-gray-500">
                250 caractères maximum.
              </p>

            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">

              <div className="flex items-start gap-3">

                <ReceiptText
                  size={20}
                  className="mt-0.5 shrink-0 text-blue-700"
                />

                <p className="text-sm leading-6 text-blue-900">
                  Ces paramètres pourront être utilisés par le
                  système d'impression des reçus de prestations.
                  Leur application effective devra être raccordée
                  au modèle de reçu.
                </p>

              </div>

            </div>

          </SectionCard>
        )}

        {/* =============================================
            CAISSE ET PAIEMENTS
        ============================================== */}

        {activeSection === "caisse" && (
          <SectionCard
            title="Caisse et moyens de paiement"
            description="Sélectionne les moyens de paiement autorisés pour les prestations."
          >

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

              {[
                ["especes", "Espèces"],
                ["wave", "Wave"],
                ["orange_money", "Orange Money"],
                ["mtn_money", "MTN Money"],
                ["moov_money", "Moov Money"],
                ["carte", "Carte bancaire"],
                ["virement", "Virement bancaire"],
                ["autre", "Autre"],
              ].map(([id, label]) => (

                <Toggle
                  key={id}
                  label={label}
                  checked={settings.caisse[id]}
                  onChange={(value) =>
                    updateGroup("caisse", id, value)
                  }
                />

              ))}

            </div>

            {!Object.values(settings.caisse).some(Boolean) && (

              <p className="mt-4 text-sm text-red-600">
                Active au moins un moyen de paiement.
              </p>

            )}

            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">

              <div className="flex items-start gap-3">

                <Wallet
                  size={20}
                  className="mt-0.5 shrink-0 text-gray-600"
                />

                <div>

                  <p className="text-sm font-semibold text-gray-800">
                    Gestion de la caisse
                  </p>

                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    La caisse permanente, les coffres et leurs soldes
                    existants ne sont pas modifiés par ces paramètres.
                    Les moyens de paiement désactivés devront également
                    être refusés par l'API d'enregistrement des prestations.
                  </p>

                </div>

              </div>

            </div>

          </SectionCard>
        )}

        {/* =============================================
            BARRE D'ENREGISTREMENT
        ============================================== */}

        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">

          <div className="text-sm text-gray-500">

            {isDirty ? (
              <span className="font-medium text-amber-700">
                Modifications non enregistrées
              </span>
            ) : (
              "Tous les changements sont enregistrés."
            )}

          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">

            <button
              type="button"
              onClick={resetChanges}
              disabled={!isDirty || saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={16} />
              Annuler les changements
            </button>

            <button
              type="submit"
              disabled={saving || !isDirty}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {saving ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}

              {saving ? "Enregistrement...." : "Enregistrer"}

            </button>

            <button
              type="button"
              onClick={loadSettings}
              disabled={loading || saving}
              title="Recharger les paramètres"
              aria-label="Recharger les paramètres"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={17} />
            </button>

          </div>

        </div>

      </form>

      <p className="text-center text-xs text-gray-400">
        MAAX Business · Configuration de la station de lavage
      </p>

    </div>
  );
}
