
export default function manifest() {
  return {
    id: "/",
    name: "MAAX Business",
    short_name: "MAAX Business",
    description:
      "Gestion des activités professionnelles avec MAAX Business.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F5EF",
    theme_color: "#14233B",
    icons: [
      {
        src: "/icons/maax-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/maax-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maax-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
