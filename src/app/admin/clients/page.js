
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 20;

const STATUS_CONFIG = {
  disponible: {
    label: "Disponible",
    className: "bg-blue-50 text-blue-700",
  },
  active: {
    label: "Active",
    className: "bg-green-50 text-green-700",
  },
  expiree: {
    label: "Expirée",
    className: "bg-amber-50 text-amber-700",
  },
  revoquee: {
    label: "Révoquée",
    className: "bg-red-50 text-red-700",
  },
};

function formatDate(date) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    label: status || "Inconnu",
    className: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [recherche, setRecherche] = useState("");
  const [clientSelectionne, setClientSelectionne] = useState(null);

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const chargerClients = useCallback(async (numeroPage = 1) => {
    try {
      setChargement(true);
      setErreur("");

      const response = await fetch(
        `/api/admin/clients?mode=liste&page=${numeroPage}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de charger les clients.");
      }

      setClients(result.clients || []);
      setTotal(result.total || 0);
      setPage(result.page || numeroPage);
      setTotalPages(Math.max(1, result.totalPages || 1));
    } catch (error) {
      console.error("Chargement des clients :", error);
      setErreur(error.message || "Une erreur est survenue.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerClients(1);
  }, [chargerClients]);

  // Recherche locale dans les clients de la page actuellement affichée.
  const clientsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();

    if (!terme) return clients;

    return clients.filter((client) => {
      return (
        (client.nom || "").toLowerCase().includes(terme) ||
        (client.telephone || "").toLowerCase().includes(terme)
      );
    });
  }, [clients, recherche]);

  function changerPage(nouvellePage) {
    if (
      nouvellePage < 1 ||
      nouvellePage > totalPages ||
      nouvellePage === page
    ) {
      return;
    }

    setClientSelectionne(null);
    chargerClients(nouvellePage);
  }

  function ouvrirDetails(client) {
    setClientSelectionne(
      clientSelectionne?.id === client.id ? null : client
    );
  }

  const nombreLicences = (client) => client.licences?.length || 0;

  const nombreLicencesActives = (client) =>
    (client.licences || []).filter(
      (licence) => licence.statut === "active"
    ).length;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-7 md:px-8 md:py-10">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#B18F4E]">
            ADMINISTRATION
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#14233B] sm:text-3xl">
            Gestion des clients
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Consultez les clients et leurs licences MAAX Business.
          </p>
        </div>

        <button
          onClick={() => chargerClients(page)}
          disabled={chargement}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14233B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#203858] disabled:opacity-50"
        >
          <span>↻</span>
          Actualiser
        </button>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total des clients</p>
          <p className="mt-2 text-3xl font-bold text-[#14233B]">
            {chargement ? "—" : total}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Clients affichés
          </p>
          <p className="mt-2 text-3xl font-bold text-[#14233B]">
            {chargement ? "—" : clients.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Licences sur cette page
          </p>
          <p className="mt-2 text-3xl font-bold text-[#14233B]">
            {chargement
              ? "—"
              : clients.reduce(
                  (totalLicences, client) =>
                    totalLicences + nombreLicences(client),
                  0
                )}
          </p>
        </div>
      </div>

      {/* Liste des clients */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-[#14233B]">
              Liste des clients
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {total} client(s) enregistré(s)
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              ⌕
            </span>
            <input
              type="search"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Nom ou téléphone..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-4 text-sm outline-none transition focus:border-[#D8BD83] focus:ring-2 focus:ring-[#D8BD83]/20"
            />
          </div>
        </div>

        {erreur && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {erreur}
            <button
              onClick={() => chargerClients(page)}
              className="ml-2 font-semibold underline"
            >
              Réessayer
            </button>
          </div>
        )}

        {chargement ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#14233B]" />
            <p className="mt-3 text-sm text-slate-500">
              Chargement des clients...
            </p>
          </div>
        ) : !erreur && clientsFiltres.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="text-4xl">👥</div>
            <p className="mt-3 font-semibold text-[#14233B]">
              Aucun client trouvé
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {recherche
                ? "Aucun résultat sur cette page pour votre recherche."
                : "Aucun client actif n'est disponible pour le moment."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Client</th>
                    <th className="px-5 py-4 font-semibold">Téléphone</th>
                    <th className="px-5 py-4 text-center font-semibold">
                      Licences
                    </th>
                    <th className="px-5 py-4 text-center font-semibold">
                      Actives
                    </th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Détails
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {clientsFiltres.map((client) => (
                    <tr
                      key={client.id}
                      className={`transition hover:bg-slate-50 ${
                        clientSelectionne?.id === client.id
                          ? "bg-[#D8BD83]/10"
                          : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#14233B] text-sm font-bold text-[#D8BD83]">
                            {(client.nom || "C").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-[#14233B]">
                            {client.nom || "Client sans nom"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {client.telephone || "Non renseigné"}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-[#14233B]">
                          {nombreLicences(client)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700">
                          {nombreLicencesActives(client)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => ouvrirDetails(client)}
                          className="rounded-lg border border-[#D8BD83] px-3 py-2 text-xs font-semibold text-[#14233B] transition hover:bg-[#D8BD83]/20"
                        >
                          {clientSelectionne?.id === client.id
                            ? "Fermer"
                            : "Voir les détails"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Détails du client */}
            {clientSelectionne && (
              <div className="border-t-4 border-[#D8BD83] bg-slate-50 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#B18F4E]">
                      Fiche client
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-[#14233B]">
                      {clientSelectionne.nom || "Client sans nom"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {clientSelectionne.telephone || "Téléphone non renseigné"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
                    <span className="text-slate-500">
                      Nombre de licences :
                    </span>{" "}
                    <strong className="text-[#14233B]">
                      {nombreLicences(clientSelectionne)}
                    </strong>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="mb-3 font-bold text-[#14233B]">
                    Licences associées
                  </h4>

                  {!clientSelectionne.licences?.length ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                      Aucune licence associée à ce client.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clientSelectionne.licences.map((licence) => (
                        <div
                          key={licence.id}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold text-[#14233B]">
                                Licence #{licence.id.slice(0, 8).toUpperCase()}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Créée le {formatDate(licence.date_creation)}
                              </p>
                            </div>
                            <StatusBadge status={licence.statut} />
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                              <p className="text-xs text-slate-400">Modules</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(licence.modules || []).map((module) => (
                                  <span
                                    key={module}
                                    className="rounded-md bg-[#14233B]/5 px-2 py-1 text-xs font-semibold text-[#14233B]"
                                  >
                                    {module}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-slate-400">Durée</p>
                              <p className="mt-1 text-sm font-semibold text-[#14233B]">
                                {licence.duree_jours} jours
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-400">
                                Expiration
                              </p>
                              <p className="mt-1 text-sm font-semibold text-[#14233B]">
                                {formatDate(licence.date_expiration)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Page {page} sur {totalPages} — {PAGE_SIZE} clients maximum par page
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => changerPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[#14233B] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Précédent
                </button>

                <button
                  onClick={() => changerPage(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg bg-[#14233B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#203858] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        MAAX Business — Administration de la plateforme
      </p>
    </div>
  );
}
