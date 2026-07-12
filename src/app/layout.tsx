import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vaishnavi Enterprises — Solar, EV & Electrical Goods",
    template: "%s | Vaishnavi Enterprises",
  },
  description:
    "Buy solar panels, LED lights, electrical goods, BLDC fans, and electric vehicles in Suriyawan, Bhadohi. Genuine products, pan-India shipping, COD available.",
  keywords: [
    "solar panels",
    "electric vehicle",
    "LED lights",
    "electrical goods",
    "BLDC fan",
    "Suriyawan",
    "Bhadohi",
  ],
  openGraph: {
    siteName: "Vaishnavi Enterprises",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
