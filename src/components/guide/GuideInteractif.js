
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  X,
} from "lucide-react";

const CLE_GUIDE = "maax-guide-lavage-termine-v1";

const ETAPES = [
  {
    cible: "dashboard",
    titre: "Bienvenue dans votre station",
    description:
      "Voici votre tableau de bord. Il rassemble les informations essentielles de votre activité de lavage.",
  },
  {
    cible: "nouvelle-operation",
    titre: "Enregistrer un lavage",
    description:
      "Cliquez ici pour enregistrer une nouvelle opération. Vous pourrez sélectionner le véhicule, la prestation, le laveur et le mode de paiement.",
  },
  {
    cible: "indicateurs",
    titre: "Comprendre vos indicateurs",
    description:
      "Suivez le chiffre d’affaires, les lavages terminés, les commissions des laveurs, les dépenses et le bénéfice net.",
  },
  {
    cible: "etat-station",
    titre: "Vérifier votre station",
    description:
      "Consultez les soldes des caisses ainsi que le nombre de caisses, de prestations et de laveurs actifs.",
  },
  {
    cible: "previsions",
    titre: "Anticiper votre chiffre d’affaires",
    description:
      "Les prévisions donnent une estimation statistique des recettes des sept prochains jours. Ce ne sont pas des recettes garanties.",
  },
  {
    cible: "gestion",
    titre: "Gérer votre activité",
    description:
      "Retrouvez ici les prestations, les dépenses, les véhicules, l’équipe et les paramètres de votre station.",
  },
];

export default function GuideInteractif() {
  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState(0);
  const [rectangle, setRectangle] = useState(null);
  const [positionBulle, setPositionBulle] = useState({
    top: 100,
    left: 16,
  });

  const actualiserPosition = useCallback(() => {
    if (!ouvert) return;

    const cible = document.querySelector(
      `[data-guide="${ETAPES[etape].cible}"]`
    );

    if (!cible) {
      setRectangle(null);
      return;
    }

    const rect = cible.getBoundingClientRect();

    setRectangle({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });

    const largeurBulle = Math.min(360, window.innerWidth - 32);
    const hauteurBulle = 230;
    const marge = 16;

    const left = Math.max(
      marge,
      Math.min(
        rect.left + rect.width / 2 - largeurBulle / 2,
        window.innerWidth - largeurBulle - marge
      )
    );

    let top = rect.bottom + 18;

    if (top + hauteurBulle > window.innerHeight - marge) {
      top = rect.top - hauteurBulle - 18;
    }

    top = Math.max(
      marge,
      Math.min(top, window.innerHeight - hauteurBulle - marge)
    );

    setPositionBulle({ top, left });
  }, [ouvert, etape]);

  const demarrer = useCallback(() => {
    setEtape(0);
    setOuvert(true);
  }, []);

  const terminer = useCallback(() => {
    setOuvert(false);

    try {
      window.localStorage.setItem(CLE_GUIDE, "true");
    } catch (error) {
      console.warn("Impossible de mémoriser la fin du guide.", error);
    }
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLE_GUIDE) !== "true") {
        demarrer();
      }
    } catch {
      // Le guide reste utilisable si le stockage est indisponible.
    }
  }, [demarrer]);

  useEffect(() => {
    if (!ouvert) return;

    const cible = document.querySelector(
      `[data-guide="${ETAPES[etape].cible}"]`
    );

    cible?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    const actualiser = () => actualiserPosition();

    actualiser();

    window.addEventListener("resize", actualiser);
    window.addEventListener("scroll", actualiser, true);

    const observateur = new ResizeObserver(actualiser);

    if (cible) observateur.observe(cible);

    return () => {
      window.removeEventListener("resize", actualiser);
      window.removeEventListener("scroll", actualiser, true);
      observateur.disconnect();
    };
  }, [ouvert, etape, actualiserPosition]);

  const precedent = () => {
    setEtape((valeur) => Math.max(0, valeur - 1));
  };

  const suivant = () => {
    if (etape === ETAPES.length - 1) {
      terminer();
      return;
    }

    setEtape((valeur) => valeur + 1);
  };

  return (
    <>
      <button
        type="button"
        onClick={demarrer}
        aria-label="Ouvrir le guide interactif"
        className="fixed bottom-5 right-5 z-[150] flex min-h-12 items-center gap-2 rounded-full bg-[#14233B] px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-[#20385B] focus:outline-none focus:ring-4 focus:ring-[#D8BD83]/50"
      >
        <CircleHelp size={19} className="text-[#D8BD83]" />
        
      </button>

      {ouvert && (
        <>
          <svg
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[160] h-full w-full"
          >
            <defs>
              <mask id="maax-guide-masque">
                <rect width="100%" height="100%" fill="white" />

                {rectangle && (
                  <rect
                    x={Math.max(0, rectangle.left - 6)}
                    y={Math.max(0, rectangle.top - 6)}
                    width={rectangle.width + 12}
                    height={rectangle.height + 12}
                    rx="14"
                    fill="black"
                  />
                )}
              </mask>
            </defs>

            <rect
              width="100%"
              height="100%"
              fill="rgba(8, 15, 30, 0.64)"
              mask="url(#maax-guide-masque)"
            />
          </svg>

          {rectangle && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[161] rounded-2xl border-2 border-[#D8BD83] shadow-[0_0_0_4px_rgba(216,189,131,0.20)]"
              style={{
                top: rectangle.top - 6,
                left: rectangle.left - 6,
                width: rectangle.width + 12,
                height: rectangle.height + 12,
              }}
            />
          )}

          <section
            role="dialog"
            aria-modal="false"
            aria-labelledby="maax-guide-titre"
            className="fixed z-[170] w-[calc(100vw-32px)] max-w-[360px] rounded-2xl border border-[#D8BD83]/50 bg-white p-5 shadow-2xl"
            style={{
              top: positionBulle.top,
              left: positionBulle.left,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9B7A3C]">
                  Guide de démarrage · Étape {etape + 1} sur {ETAPES.length}
                </p>

                <h2
                  id="maax-guide-titre"
                  className="mt-2 text-lg font-bold leading-snug text-[#14233B]"
                >
                  {ETAPES[etape].titre}
                </h2>
              </div>

              <button
                type="button"
                onClick={terminer}
                aria-label="Fermer le guide"
                className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {ETAPES[etape].description}
            </p>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={terminer}
                className="text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-slate-800"
              >
                Passer le guide
              </button>

              <div className="flex items-center gap-2">
                {etape > 0 && (
                  <button
                    type="button"
                    onClick={precedent}
                    className="flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#14233B] hover:bg-slate-50"
                  >
                    <ArrowLeft size={16} />
                    Précédent
                  </button>
                )}

                <button
                  type="button"
                  onClick={suivant}
                  className="flex min-h-10 items-center gap-1 rounded-xl bg-[#14233B] px-3 text-sm font-semibold text-white hover:bg-[#20385B]"
                >
                  {etape === ETAPES.length - 1 ? (
                    <>
                      Terminer
                      <CheckCircle2 size={16} />
                    </>
                  ) : (
                    <>
                      Suivant
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
