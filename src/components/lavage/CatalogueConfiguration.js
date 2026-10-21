"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDollarSign,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
  CarFront,
  WashingMachine,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const BUCKET_IMAGES = "lavage-vehicules";


function getInitialForm() {
  return {
    nom: "",
    description: "",
  };
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getStoragePath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;

  try {
    const url = new URL(imageUrl);
    const marker = `/storage/v1/object/public/${BUCKET_IMAGES}/`;
    const index = url.pathname.indexOf(marker);

    if (index === -1) return null;

    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export default function CatalogueConfiguration({
  mode = "vehicule",
  endpoint,
  title,
  singular,
  subtitle,
}) {
  const isVehicule = mode === "vehicule";

  const apiEndpoint =
    endpoint ||
    (isVehicule
      ? "/api/lavage/types-vehicule"
      : "/api/lavage/types-lavage");

  const pageTitle =
    title || (isVehicule ? "Types de véhicules" : "Types de lavage");

  const itemLabel =
    singular || (isVehicule ? "Type de véhicule" : "Type de lavage");

  const pageSubtitle =
    subtitle ||
    (isVehicule
      ? "Configure les catégories de véhicules et associe une image représentative à chacune."
      : "Configure les prestations de lavage proposées par ta station.");

  const fileInputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [lavage, setLavage] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [form, setForm] = useState(getInitialForm);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);

  const devise = lavage?.devise || "FCFA";

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(apiEndpoint, {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || "Impossible de charger le catalogue."
        );
      }

      setItems(Array.isArray(result.items) ? result.items : []);
      setLavage(result.lavage || null);
    } catch (err) {
      setError(
        getErrorMessage(err, "Une erreur est survenue au chargement.")
      );
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setImagePreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  const stats = useMemo(() => {
    const total = items.length;
    const actifs = items.filter((item) => item.actif).length;
    const inactifs = total - actifs;

    return { total, actifs, inactifs };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fr");

    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.nom?.toLocaleLowerCase("fr").includes(normalizedSearch) ||
        item.description?.toLocaleLowerCase("fr").includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "tous" ||
        (statusFilter === "actifs" && item.actif) ||
        (statusFilter === "inactifs" && !item.actif);

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  function resetForm() {
    setForm(getInitialForm());
    setEditingItem(null);
    setSelectedImage(null);
    setImagePreview("");
    setRemoveImage(false);
    setError("");
    setSuccess("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openCreateModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(item) {
    resetForm();

    setEditingItem(item);

    setForm({
      nom: item.nom || "",
      description: item.description || "",
      prix:
        item.prix !== null && item.prix !== undefined
          ? String(item.prix)
          : "",
    });

    setImagePreview(isVehicule ? item.image_url || "" : "");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    resetForm();
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccess("");

    if (!file.type.startsWith("image/")) {
      setError("Choisis un fichier image valide.");
      event.target.value = "";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Formats acceptés : JPG, PNG, WEBP et AVIF.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("L’image ne doit pas dépasser 5 Mo.");
      event.target.value = "";
      return;
    }

    setSelectedImage(file);
    setRemoveImage(false);
  }

  async function uploadVehicleImage(file, itemId) {
    const extensionByType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    };

    const extension = extensionByType[file.type];

    if (!extension) {
      throw new Error("Le format de l’image n’est pas accepté.");
    }

    const randomPart =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const path = `${lavage.id}/${itemId}/${randomPart}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_IMAGES)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(
        `Échec de l’envoi de l’image : ${uploadError.message}`
      );
    }

    const { data } = supabase.storage
      .from(BUCKET_IMAGES)
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new Error("Impossible de récupérer l’adresse de l’image.");
    }

    return data.publicUrl;
  }

  async function deleteStorageImage(imageUrl) {
    const path = getStoragePath(imageUrl);

    if (!path) return;

    const { error: storageError } = await supabase.storage
      .from(BUCKET_IMAGES)
      .remove([path]);

    if (storageError) {
      console.warn(
        "L’image n’a pas pu être supprimée du stockage :",
        storageError.message
      );
    }
  }

  async function saveItem(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const nom = form.nom.trim();
    const description = form.description.trim();

    if (!nom) {
      setError(`Le nom du ${itemLabel.toLowerCase()} est obligatoire.`);
      return;
    }

    if (nom.length > 100) {
      setError("Le nom ne doit pas dépasser 100 caractères.");
      return;
    }

    if (description.length > 500) {
      setError("La description ne doit pas dépasser 500 caractères.");
      return;
    }

    setSaving(true);

    let createdItemId = null;
    let newImageUrl = null;
    let previousImageUrl = editingItem?.image_url || null;

    try {
      const payload = {
        nom,
        description: description || null,
      };

      let itemId = editingItem?.id || null;

      if (editingItem) {
        const response = await fetch(apiEndpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: editingItem.id,
            ...payload,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.error || "Impossible de modifier cet élément."
          );
        }

        itemId = result.item?.id || editingItem.id;
      } else {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.error || "Impossible de créer cet élément."
          );
        }

        itemId = result.item?.id;
        createdItemId = itemId;

        if (!itemId) {
          throw new Error(
            "L’élément a été créé, mais son identifiant est manquant."
          );
        }
      }

      let imageUrlToSave;

      if (isVehicule) {
        if (selectedImage) {
          setUploading(true);
          newImageUrl = await uploadVehicleImage(selectedImage, itemId);
          imageUrlToSave = newImageUrl;
        } else if (removeImage) {
          imageUrlToSave = null;
        }

        if (selectedImage || removeImage) {
          const response = await fetch(apiEndpoint, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: itemId,
              image_url: imageUrlToSave,
            }),
          });

          const result = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              result.error ||
                "L’élément a été enregistré, mais la mise à jour de l’image a échoué."
            );
          }
        }
      }

      if (
        isVehicule &&
        previousImageUrl &&
        (selectedImage || removeImage) &&
        previousImageUrl !== newImageUrl
      ) {
        await deleteStorageImage(previousImageUrl);
      }

      setModalOpen(false);
      resetForm();

      setSuccess(
        editingItem
          ? `${itemLabel} modifié avec succès.`
          : `${itemLabel} créé avec succès.`
      );

      await loadItems();
    } catch (err) {
      setError(
        getErrorMessage(err, "Une erreur est survenue lors de l’enregistrement.")
      );

      // Si une image a été envoyée mais que sa sauvegarde en base échoue,
      // on évite de supprimer automatiquement l’élément déjà créé.
      if (newImageUrl && !createdItemId) {
        await deleteStorageImage(newImageUrl);
      }
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function toggleActive(item) {
    setError("");
    setSuccess("");

    const action = item.actif ? "désactiver" : "activer";

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Veux-tu vraiment ${action} « ${item.nom} » ?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          actif: !item.actif,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || `Impossible de ${action} cet élément.`
        );
      }

      setSuccess(
        `${item.nom} a été ${item.actif ? "désactivé" : "activé"} avec succès.`
      );

      await loadItems();
    } catch (err) {
      setError(
        getErrorMessage(err, "Impossible de modifier le statut.")
      );
    }
  }

  function clearSelectedImage() {
    setSelectedImage(null);
    setImagePreview("");
    setRemoveImage(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <Link
              href="/dashboard/lavage"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-amber-700"
            >
              <ArrowLeft size={16} />
              Retour au tableau de bord
            </Link>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                {isVehicule ? (
                  <CarFront size={16} />
                ) : (
                  <WashingMachine size={16} />
                )}
                Configuration du lavage
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {pageTitle}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {pageSubtitle}
              </p>

              {lavage?.nom && (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  Station :{" "}
                  <span className="text-amber-700">{lavage.nom}</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          >
            <Plus size={18} />
            Ajouter {itemLabel.toLowerCase()}
          </button>
        </div>

        {/* Messages */}
        {error && !modalOpen && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p className="flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Fermer le message d’erreur"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <p className="flex-1">{success}</p>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Fermer le message de confirmation"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Tag size={19} />}
            label="Total configuré"
            value={stats.total}
            description={`Nombre de ${pageTitle.toLowerCase()}`}
          />

          <StatCard
            icon={<CheckCircle2 size={19} />}
            label="Actifs"
            value={stats.actifs}
            description="Éléments disponibles"
            accent="emerald"
          />

          <StatCard
            icon={<Power size={19} />}
            label="Inactifs"
            value={stats.inactifs}
            description="Éléments désactivés"
            accent="slate"
          />
        </div>

        {/* Catalogue */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Catalogue configuré
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredItems.length} résultat
                  {filteredItems.length > 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 sm:min-w-64">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  aria-label="Filtrer par statut"
                >
                  <option value="tous">Tous les statuts</option>
                  <option value="actifs">Actifs uniquement</option>
                  <option value="inactifs">Inactifs uniquement</option>
                </select>

                <button
                  type="button"
                  onClick={loadItems}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : ""}
                  />
                  Actualiser
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-slate-500">
              <LoaderCircle size={30} className="animate-spin text-amber-600" />
              <p className="text-sm">Chargement du catalogue...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                {isVehicule ? (
                  <CarFront size={26} />
                ) : (
                  <WashingMachine size={26} />
                )}
              </div>

              <h3 className="text-base font-bold text-slate-900">
                {items.length === 0
                  ? "Ton catalogue est encore vide"
                  : "Aucun résultat"}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                {items.length === 0
                  ? `Ajoute ton premier ${itemLabel.toLowerCase()} pour commencer la configuration de ta station.`
                  : "Essaie de modifier ta recherche ou le filtre de statut."}
              </p>

              {items.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  <Plus size={17} />
                  Ajouter un élément
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Affichage en cartes pour les véhicules */}
              {isVehicule ? (
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:p-5">
                  {filteredItems.map((item) => (
                    <article
                      key={item.id}
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-amber-300 hover:shadow-md"
                    >
                      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-slate-100">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={`Illustration : ${item.nom}`}
                            className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
                              !item.actif ? "grayscale opacity-60" : ""
                            }`}
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <CarFront size={42} strokeWidth={1.3} />
                            <span className="text-xs">
                              Aucune image
                            </span>
                          </div>
                        )}

                        <div className="absolute left-3 top-3">
                          <StatusBadge active={item.actif} />
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-slate-700 shadow-sm transition hover:bg-amber-500 hover:text-white"
                          title="Modifier"
                          aria-label={`Modifier ${item.nom}`}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>

                      <div className="space-y-3 p-4">
                        <div>
                          <h3 className="truncate font-bold text-slate-900">
                            {item.nom}
                          </h3>

                          <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">
                            {item.description || "Aucune description."}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                          <span className="text-xs text-slate-400">
                            {item.actif ? "Disponible" : "Indisponible"}
                          </span>

                          <button
                            type="button"
                            onClick={() => toggleActive(item)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              item.actif
                                ? "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            <Power size={14} />
                            {item.actif ? "Désactiver" : "Activer"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                /* Tableau des prestations */
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Prestation</th>
                        <th className="px-5 py-4 font-semibold">Description</th>
                        <th className="px-5 py-4 text-center font-semibold">
                          Statut
                        </th>
                        <th className="px-5 py-4 text-right font-semibold">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => (
                        <tr
                          key={item.id}
                          className="transition hover:bg-slate-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                                <WashingMachine size={19} />
                              </div>

                              <span className="font-semibold text-slate-900">
                                {item.nom}
                              </span>
                            </div>
                          </td>

                          <td className="max-w-xs px-5 py-4 text-slate-500">
                            <p className="line-clamp-2">
                              {item.description || "—"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <StatusBadge active={item.actif} />
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                title="Modifier"
                                aria-label={`Modifier ${item.nom}`}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                              >
                                <Pencil size={15} />
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleActive(item)}
                                title={item.actif ? "Désactiver" : "Activer"}
                                aria-label={`${item.actif ? "Désactiver" : "Activer"} ${item.nom}`}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                                  item.actif
                                    ? "border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                <Power size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* Aide */}
        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <div className="mt-0.5 text-amber-700">
            <CircleDollarSign size={20} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              À savoir
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              {isVehicule
                ? "Les images permettent aux utilisateurs d’identifier rapidement les catégories de véhicules. Les images doivent être au format JPG, PNG, WEBP ou AVIF et ne pas dépasser 5 Mo."
                : "Le prix renseigné ici sert de référence. Le tarif réellement appliqué à une prestation doit être défini dans la page Tarifs en fonction du type de véhicule et du type de lavage."}
            </p>

            {!isVehicule && (
              <Link
                href="/dashboard/lavage/configuration/tarifs"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-800 hover:text-amber-900"
              >
                Configurer les tarifs
                <ChevronRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Fenêtre de création / modification */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalogue-modal-title"
            className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                  Configuration
                </p>

                <h2
                  id="catalogue-modal-title"
                  className="mt-1 text-xl font-bold text-slate-900"
                >
                  {editingItem
                    ? `Modifier ${itemLabel.toLowerCase()}`
                    : `Nouveau ${itemLabel.toLowerCase()}`}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Renseigne les informations ci-dessous.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Fermer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveItem} className="space-y-5 p-5 sm:p-6">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="catalogue-nom"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Nom <span className="text-red-500">*</span>
                </label>

                <input
                  id="catalogue-nom"
                  name="nom"
                  type="text"
                  value={form.nom}
                  onChange={handleFieldChange}
                  maxLength={100}
                  required
                  autoFocus
                  placeholder={
                    isVehicule
                      ? "Ex. : Berline, 4x4, Moto..."
                      : "Ex. : Lavage simple, Lavage complet..."
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />

                <p className="mt-1.5 text-right text-xs text-slate-400">
                  {form.nom.length}/100
                </p>
              </div>

              <div>
                <label
                  htmlFor="catalogue-description"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="catalogue-description"
                  name="description"
                  value={form.description}
                  onChange={handleFieldChange}
                  maxLength={500}
                  rows={3}
                  placeholder="Ajoute une description facultative..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />

                <p className="mt-1.5 text-right text-xs text-slate-400">
                  {form.description.length}/500
                </p>
              </div>
              
              {/*
              {!isVehicule && (
                <div>
                  <label
                    htmlFor="catalogue-prix"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Prix indicatif ({devise}){" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <input
                      id="catalogue-prix"
                      name="prix"
                      type="number"
                      min="0"
                      step="1"
                      value={form.prix}
                      onChange={handleFieldChange}
                      required
                      placeholder="Ex. : 2000"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-16 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      {devise}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Le tarif final appliqué dépendra du type de véhicule et
                    de la configuration de la page Tarifs.
                  </p>
                </div>
              )}
              */}

              {isVehicule && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Image représentative
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  {imagePreview && !removeImage ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <div className="flex h-48 items-center justify-center bg-slate-100">
                        <img
                          src={imagePreview}
                          alt="Aperçu du type de véhicule"
                          className="h-full w-full object-contain"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <span className="max-w-[65%] truncate text-xs text-slate-500">
                          {selectedImage
                            ? selectedImage.name
                            : "Image actuelle"}
                        </span>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Upload size={14} />
                            Changer
                          </button>

                          <button
                            type="button"
                            onClick={clearSelectedImage}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Retirer
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center transition hover:border-amber-400 hover:bg-amber-50/50"
                    >
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                        <ImagePlus size={23} />
                      </div>

                      <span className="text-sm font-semibold text-slate-800">
                        Choisir une image
                      </span>

                      <span className="mt-1 text-xs text-slate-500">
                        JPG, PNG, WEBP ou AVIF — 5 Mo maximum
                      </span>

                      {removeImage && (
                        <span className="mt-2 text-xs font-medium text-amber-700">
                          L’image actuelle sera retirée à l’enregistrement.
                        </span>
                      )}
                    </button>
                  )}

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Exemple : image d’une moto, d’une berline, d’un SUV ou
                    d’un camion. L’image sera enregistrée dans Supabase
                    Storage.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={17} className="animate-spin" />
                      {uploading ? "Envoi de l’image..." : "Enregistrement..."}
                    </>
                  ) : (
                    <>
                      <Check size={17} />
                      {editingItem ? "Enregistrer les modifications" : "Créer"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
  accent = "amber",
}) {
  const accentClasses = {
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            accentClasses[accent] || accentClasses.amber
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {active ? "Actif" : "Inactif"}
    </span>
  );
}
