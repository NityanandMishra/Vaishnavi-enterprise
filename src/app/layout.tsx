import type { Metadata } from "next";
import { Inter, Outfit, Fira_Sans, Fira_Code } from "next/font/google";
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

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-mono",
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
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${firaSans.variable} ${firaCode.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
