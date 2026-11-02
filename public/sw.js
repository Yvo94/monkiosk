
const CACHE_NAME = "maax-business-v2";
const OFFLINE_URL = "/offline.html";

const APP_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/maax-192.png",
  "/icons/maax-512.png",
  "/icons/maax-512-maskable.png",
];

// Installation
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_ASSETS);
    })
  );

  self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("maax-business-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })
  );
});

// Gestion des requêtes
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes autres que GET
  if (request.method !== "GET") return;

  // Ne pas intercepter les requêtes externes
  if (url.origin !== self.location.origin) return;

  // Ne jamais mettre en cache les API
  if (url.pathname.startsWith("/api/")) return;

  // Les navigations doivent toujours privilégier le réseau
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const offlinePage = await cache.match(OFFLINE_URL);

        return (
          offlinePage ||
          new Response("Vous êtes hors connexion.", {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
          })
        );
      })
    );

    return;
  }

  // Les fichiers statiques Next.js :
  // réseau en priorité, cache uniquement en secours.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const response = await fetch(request);

          if (response.ok) {
            await cache.put(request, response.clone());
          }

          return response;
        } catch (error) {
          const cachedResponse = await cache.match(request);

          if (cachedResponse) return cachedResponse;

          return new Response("", { status: 503 });
        }
      })()
    );
  }
});
