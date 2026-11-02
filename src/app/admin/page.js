
import Link from "next/link";

const statistiques = [
  {
    titre: "Clients inscrits",
    valeur: "—",
    description: "Structures enregistrées",
    icone: "👥",
  },
  {
    titre: "Licences actives",
    valeur: "—",
    description: "Licences actuellement utilisées",
    icone: "🔑",
  },
  {
    titre: "Licences disponibles",
    valeur: "—",
    description: "En attente d'activation",
    icone: "⏳",
  },
  {
    titre: "Licences expirées",
    valeur: "—",
    description: "Licences arrivées à expiration",
    icone: "📅",
  },
];

const modules = [
  {
    nom: "MAAX Kiosque",
    description: "Gestion des activités commerciales et des kiosques.",
    icone: "🏪",
    statut: "Module disponible",
  },
  {
    nom: "MAAX Lavage",
    description: "Gestion des centres de lavage automobile.",
    icone: "🚗",
    statut: "Module disponible",
  },
];

const liensAdministration = [
  {
    nom: "Gestion des licences",
    description:
      "Générer des codes d'activation, attribuer des modules et définir les durées de validité.",
    icone: "🔑",
    href: "/admin/licences",
    action: "Accéder à la gestion",
  },
  {
    nom: "Gestion des clients",
    description:
      "Consulter les structures inscrites, leurs propriétaires et les modules auxquels elles ont accès.",
    icone: "👥",
    href: "/admin/clients",
    action: "Consulter les clients",
  },
  {
    nom: "Paramètres",
    description:
      "Accéder aux paramètres généraux et à la configuration de la plateforme MAAX Business.",
    icone: "⚙️",
    href: "/admin/parametres",
    action: "Configurer la plateforme",
  },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">

        {/* BIENVENUE */}
        <section className="relative mb-9 overflow-hidden rounded-2xl bg-[#14233B] p-7 text-white shadow-lg md:p-9">
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D8BD83]">
              MAAX Technologies
            </p>

            <h1 className="mt-3 text-2xl font-extrabold md:text-3xl">
              Administration MAAX Business
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
              Bienvenue dans votre espace de supervision. Gérez vos clients,
              vos licences et les différents modules de la plateforme depuis
              une interface centralisée.
            </p>

            <Link
              href="/admin/licences"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#D8BD83] px-5 py-3 text-sm font-bold text-[#14233B] transition hover:bg-[#E6CE98]"
            >
              <span>＋</span>
              Générer une licence
              <span>→</span>
            </Link>
          </div>

          <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border-[35px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-32 right-28 h-64 w-64 rounded-full bg-[#D8BD83]/10" />
        </section>

        {/* STATISTIQUES */}
        <section className="mb-10">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#14233B]">
              Vue générale
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Aperçu des principales données de la plateforme.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statistiques.map((stat) => (
              <div
                key={stat.titre}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">
                    {stat.titre}
                  </p>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#14233B]/5 text-xl">
                    {stat.icone}
                  </div>
                </div>

                <p className="mt-5 text-3xl font-extrabold text-[#14233B]">
                  {stat.valeur}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {stat.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* GESTION DE LA PLATEFORME */}
        <section className="mb-10">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#14233B]">
              Gestion de la plateforme
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Accédez rapidement aux différents espaces d'administration.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            {/* LICENCES, CLIENTS ET PARAMÈTRES */}
            {liensAdministration.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#D8BD83] hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14233B] text-2xl">
                    {item.icone}
                  </div>

                  <span className="text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#D8BD83]">
                    →
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-bold text-[#14233B]">
                  {item.nom}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {item.description}
                </p>

                <p className="mt-5 text-sm font-bold text-[#14233B] transition group-hover:text-[#B18F4E]">
                  {item.action} →
                </p>
              </Link>
            ))}

            {/* MODULES */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14233B]/5 text-2xl">
                  🧩
                </div>

                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  À développer
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#14233B]">
                Gestion des modules
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Superviser les modules MAAX Kiosque et MAAX Lavage ainsi que
                leurs disponibilités.
              </p>
            </div>

            {/* ABONNEMENTS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14233B]/5 text-2xl">
                  📊
                </div>

                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  À développer
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-[#14233B]">
                Suivi des abonnements
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Suivre les activations, les expirations et les renouvellements
                des licences.
              </p>
            </div>

          </div>
        </section>

        {/* MODULES MAAX */}
        <section>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#14233B]">
              Écosystème MAAX Business
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Les solutions disponibles sur la plateforme.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <div
                key={module.nom}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#D8BD83]/20 text-2xl">
                  {module.icone}
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-[#14233B]">
                    {module.nom}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {module.description}
                  </p>

                  <p className="mt-2 text-xs font-semibold text-green-700">
                    {module.statut}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
