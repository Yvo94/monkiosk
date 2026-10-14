import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://monkiosk.vercel.app"), // à remplacer par l'adresse réelle
  title: "MonKiosk",
  description: "Gestion simple et efficace de votre kiosque",
  openGraph: {
    title: "MonKiosk",
    description: "Gestion simple et efficace de votre kiosque",
    siteName: "MonKiosk",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/og-monkiosk.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "MonKiosk, gestion simple et efficace de votre kiosque",
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
};