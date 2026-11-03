
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function LicenseGuard({ children }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let actif = true;

    async function verifierLicence() {
      try {
        const response = await fetch("/api/auth/context", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          window.location.replace("/login");
          return;
        }

        const context = await response.json();

        if (!actif) return;

        if (!context.licence?.active) {
          window.location.replace("/activation-licence");
          return;
        }

        setChecking(false);
      } catch (error) {
        console.error("Erreur de vérification de licence :", error);
        // En cas d'erreur, ne pas afficher une page non vérifiée.
        setChecking(true);
      }
    }

    verifierLicence();

    return () => {
      actif = false;
    };
  }, [pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-sm text-gray-600">
            Vérification de votre licence...
          </p>
        </div>
      </div>
    );
  }

  return children;
}
