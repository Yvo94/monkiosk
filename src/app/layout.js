
import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://monkiosk.vercel.app"),

  title: {
    default: "MAAX Business",
    template: "%s | MAAX Business",
  },

  description:
    "MAAX Business : la plateforme de gestion des ventes, stocks, caisses et opérations pour les cafés, restaurants, lavages auto, supermarchés et boutiques.",

  applicationName: "MAAX Business",

  manifest: "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MAAX Business",
  },

  keywords: [
    "MAAX Business",
    "logiciel de gestion",
    "gestion commerciale",
    "caisse",
    "stocks",
    "restaurant",
    "lavage auto",
    "supermarché",
    "boutique",
  ],

  openGraph: {
    title: "MAAX Business",
    description:
      "Pilotez, gérez et développez votre activité avec une plateforme professionnelle de gestion commerciale.",
    siteName: "MAAX Business",
    locale: "fr_CI",
    type: "website",
    images: [
      {
        url: "/og-maax-business.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "MAAX Business — Gestion professionnelle",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "MAAX Business",
    description:
      "La plateforme de gestion des ventes, stocks et opérations de votre entreprise.",
    images: ["/og-maax-business.jpg"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14233B",
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
