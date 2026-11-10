import type { Metadata } from "next";
import { Barlow_Semi_Condensed, Geist, Geist_Mono } from "next/font/google";

import { AuthRecoveryRedirect } from "@/app/_components/AuthRecoveryRedirect";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** Sporty display face for titles and player / manager / team names (`font-display`). */
const barlow = Barlow_Semi_Condensed({
  variable: "--font-barlow",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute base for link-preview image URLs (WhatsApp etc. need absolute og:image URLs).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://hfwauction.vercel.app"),
  title: "HFW Fantasy Auction",
  description: "Join auctions, place bids, and build your fantasy team.",
  openGraph: {
    siteName: "HFW Fantasy Auction",
    type: "website",
    title: "HFW Fantasy Auction",
    description: "Bid on real footballers, score from real matches, and battle your friends.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-slate-900 antialiased">
        <AuthRecoveryRedirect />
        {children}
      </body>
    </html>
  );
}
