import type { Metadata } from "next";
import { Footer } from "../components/chrome";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "rezerwujmiejsce.pl",
  description: "Lokale na rodzinne okazje. W tym etapie: wyszukiwanie opublikowanych miejsc i dodawanie lokalu do weryfikacji.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/sub.css" />
        <link rel="stylesheet" href="/panel.css" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
