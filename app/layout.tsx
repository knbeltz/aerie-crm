import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aerie — Deal Flow OS for Serious Investors",
    template: "%s | Aerie",
  },
  description:
    "Aerie is the collaborative CRM platform built for venture capital and seed funds. Manage deal flow, track portfolio companies, and collaborate with your team in real-time.",
  keywords: ["venture capital", "CRM", "deal flow", "seed fund", "portfolio management"],
  authors: [{ name: "Eagle Venture Seed Fund" }],
  openGraph: {
    title: "Aerie — Deal Flow OS",
    description: "The collaborative CRM for serious investors.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body className="font-inter bg-surface text-midnight antialiased">
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#000626",
                color: "#FAF9F9",
                border: "none",
                borderRadius: "10px",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
