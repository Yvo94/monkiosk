
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const emptyForm = { nom: "", telephone: "" };

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Abidjan",
  }).format(new Date(value));
}

export default function EquipeLavagePage() {
  const [station, setStation] = useState(null);
  const [laveurs, setLaveurs] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [form, setForm] = useState(emptyForm);
  const [editionId, setEditionId] = useState(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const chargerLaveurs = useCallback(async () => {
    setChargement(true);
    setErreur("");

    try {
      const response = await fetch("/api/lavage/laveurs", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de charger les laveurs.");
      }

      setStation(result.station);
      setLaveurs(result.laveurs || []);
    } catch (error) {
      setErreur(error.message || "Erreur de connexion au serveur.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerLaveurs();
  }, [chargerLaveurs]);

  const actifs = useMemo(
    () => laveurs.filter((laveur) => laveur.actif).length,
    [laveurs]
  );

  const inactifs = laveurs.length - actifs;

  const laveursFiltres = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr");

    return laveurs.filter((laveur) => {
      const correspondRecherche =
        !terme ||
        laveur.nom.toLocaleLowerCase("fr").includes(terme) ||
        (laveur.telephone || "").toLowerCase().includes(terme);

      const correspondStatut =
        filtre === "tous" ||
        (filtre === "actifs" && laveur.actif) ||
        (filtre === "inactifs" && !laveur.actif);

      return correspondRecherche && correspondStatut;
    });
  }, [laveurs, recherche, filtre]);

  function ouvrirAjout() {
    setEditionId(null);
    setForm(emptyForm);
    setErreur("");
    setSucces("");
    setModalOuvert(true);
  }

  function ouvrirEdition(laveur) {
    setEditionId(laveur.id);
    setForm({
      nom: laveur.nom || "",
      telephone: laveur.telephone || "",
    });
    setErreur("");
    setSucces("");
    setModalOuvert(true);
  }

  async function enregistrer(event) {
    event.preventDefault();
    setErreur("");
    setSucces("");

    if (!form.nom.trim()) {
      setErreur("Le nom du laveur est obligatoire.");
      return;
    }

    setEnregistrement(true);

    try {
      const response = await fetch("/api/lavage/laveurs", {
        method: editionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editionId ? { id: editionId } : {}),
          nom: form.nom.trim(),
          telephone: form.telephone.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Enregistrement impossible.");
      }

      setModalOuvert(false);
      setForm(emptyForm);
      setEditionId(null);
      setSucces(result.message || "Enregistrement effectué.");
      await chargerLaveurs();
    } catch (error) {
      setErreur(error.message || "Une erreur est survenue.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function changerStatut(laveur) {
    const action = laveur.actif ? "désactiver" : "réactiver";

    if (!window.confirm(`Veux-tu ${action} le laveur ${laveur.nom} ?`)) {
      return;
    }

    setErreur("");
    setSucces("");

    try {
      const response = await fetch("/api/lavage/laveurs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: laveur.id,
          actif: !laveur.actif,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Modification impossible.");
      }

      setSucces(result.message || "Statut mis à jour.");
      await chargerLaveurs();
    } catch (error) {
      setErreur(error.message || "Une erreur est survenue.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link
            href="/dashboard/lavage"
            className="hover:text-slate-900"
          >
            Lavage
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-800">Équipe et laveurs</span>
        </div>

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">
              Gestion de l’équipe
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Laveurs
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {station?.nom || "Gestion des laveurs de votre station"}
            </p>
          </div>

          <button
            type="button"
            onClick={ouvrirAjout}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            <span className="text-xl leading-none">+</span>
            Ajouter un laveur
          </button>
        </header>

        {erreur && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <span>{erreur}</span>
            <button
              type="button"
              onClick={() => setErreur("")}
              aria-label="Fermer le message"
            >
              ✕
            </button>
          </div>
        )}

        {succes && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <span>{succes}</span>
            <button
              type="button"
              onClick={() => setSucces("")}
              aria-label="Fermer le message"
            >
              ✕
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            titre="Total des laveurs"
            valeur={laveurs.length}
            description="Tous les laveurs enregistrés"
            icone="👥"
          />
          <StatCard
            titre="Laveurs actifs"
            valeur={actifs}
            description="Disponibles pour les prestations"
            icone="✓"
          />
          <StatCard
            titre="Laveurs inactifs"
            valeur={inactifs}
            description="Non disponibles pour les nouvelles prestations"
            icone="⏸"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Liste des laveurs
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Consulte et gère les membres de ton équipe.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="Nom ou téléphone..."
                aria-label="Rechercher un laveur"
                className="min-w-0 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 sm:w-64"
              />

              <select
                value={filtre}
                onChange={(event) => setFiltre(event.target.value)}
                aria-label="Filtrer par statut"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500"
              >
                <option value="tous">Tous les statuts</option>
                <option value="actifs">Actifs</option>
                <option value="inactifs">Inactifs</option>
              </select>
            </div>
          </div>

          {chargement ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Chargement des laveurs…
            </div>
          ) : laveursFiltres.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl">
                👤
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">
                {laveurs.length === 0
                  ? "Aucun laveur enregistré"
                  : "Aucun résultat"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {laveurs.length === 0
                  ? "Ajoute ton premier laveur pour commencer à organiser l’équipe de la station."
                  : "Essaie un autre nom ou modifie le filtre de statut."}
              </p>
              {laveurs.length === 0 && (
                <button
                  type="button"
                  onClick={ouvrirAjout}
                  className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Ajouter le premier laveur
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Laveur</th>
                      <th className="px-5 py-4 font-semibold">Téléphone</th>
                      <th className="px-5 py-4 font-semibold">Date d’ajout</th>
                      <th className="px-5 py-4 font-semibold">Statut</th>
                      <th className="px-5 py-4 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {laveursFiltres.map((laveur) => (
                      <tr key={laveur.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800">
                              {laveur.nom?.trim()?.charAt(0)?.toUpperCase() || "L"}
                            </div>
                            <span className="font-semibold text-slate-800">
                              {laveur.nom}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {laveur.telephone || "Non renseigné"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(laveur.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                              laveur.actif
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                laveur.actif ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {laveur.actif ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => ouvrirEdition(laveur)}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => changerStatut(laveur)}
                              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                                laveur.actif
                                  ? "border-red-200 text-red-700 hover:bg-red-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {laveur.actif ? "Désactiver" : "Réactiver"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                {laveursFiltres.length} résultat(s) sur {laveurs.length} laveur(s)
              </div>
            </>
          )}
        </section>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <h3 className="font-semibold text-slate-900">
                Prochaine étape : les commissions
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Les commissions fixes seront configurées par type de véhicule
                et type de prestation. Elles seront calculées lors de
                l’enregistrement du service, sans modifier les historiques
                lorsque les tarifs évolueront.
              </p>
            </div>
          </div>
        </div>
      </div>

      {modalOuvert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !enregistrement) {
              setModalOuvert(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-laveur-titre"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="form-laveur-titre"
                  className="text-xl font-bold text-slate-900"
                >
                  {editionId ? "Modifier le laveur" : "Ajouter un laveur"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Renseigne les informations du membre de l’équipe.
                </p>
              </div>
              <button
                type="button"
                disabled={enregistrement}
                onClick={() => setModalOuvert(false)}
                aria-label="Fermer"
                className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <form onSubmit={enregistrer} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="laveur-nom"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <input
                  id="laveur-nom"
                  type="text"
                  required
                  maxLength={120}
                  autoFocus
                  value={form.nom}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nom: event.target.value,
                    }))
                  }
                  placeholder="Ex. : Konan Jean"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label
                  htmlFor="laveur-telephone"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Téléphone
                </label>
                <input
                  id="laveur-telephone"
                  type="tel"
                  maxLength={30}
                  value={form.telephone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      telephone: event.target.value,
                    }))
                  }
                  placeholder="Ex. : 07 00 00 00 00"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              {erreur && (
                <p role="alert" className="text-sm text-red-600">
                  {erreur}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={enregistrement}
                  onClick={() => setModalOuvert(false)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={enregistrement}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enregistrement
                    ? "Enregistrement…"
                    : editionId
                    ? "Enregistrer les modifications"
                    : "Ajouter le laveur"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function StatCard({ titre, valeur, description, icone }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{titre}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {valeur}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl">
          {icone}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}
