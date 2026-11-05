import type { Metadata } from "next";
import "@fontsource/cinzel/500.css";
import "@fontsource/cinzel/700.css";
import "@fontsource-variable/inter";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import Ticker from "@/components/Ticker";
import Toaster from "@/components/Toaster";
import Footer from "@/components/Footer";
import StatusBanner from "@/components/StatusBanner";

export const metadata: Metadata = {
  title: "Elytheon — The Pantheon of Elysium",
  description: "Fair-launch tokens on Elysium. Trade on the curve, ascend to the Pantheon.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <Navbar />
          <StatusBanner />
          <Ticker />
          <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
          <Footer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
