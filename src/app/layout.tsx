import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { Footer } from "../components/chrome";
import "./globals.css";

const wordmark = Instrument_Sans({
  weight: "600",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-wordmark",
});

// Menu zależy od sesji. HTML nie jest cache'owany publicznie.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "rezerwujmiejsce.pl",
  description: "Lokale na rodzinne okazje. W tym etapie: wyszukiwanie opublikowanych miejsc i dodawanie lokalu do weryfikacji.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={wordmark.variable}>
      <head>
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/sub.css" />
        <link rel="stylesheet" href="/panel.css" />
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
