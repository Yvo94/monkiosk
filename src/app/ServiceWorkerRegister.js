
"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => {
        console.error(
          "Erreur d'enregistrement du service worker :",
          error
        );
      });
  }, []);

  return null;
}
