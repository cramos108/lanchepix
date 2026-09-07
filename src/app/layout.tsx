import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AppShell } from "@/components/AppShell";
import { LandingPage, MarketingShell } from "@/components/LandingPage";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import {
  hostnameFromHost,
  shouldShowLanding,
  shouldShowMarketingChrome,
} from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#070707",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const h = await headers();
  const hostname = hostnameFromHost(h.get("x-hostname") || h.get("host"));
  const pathname = h.get("x-pathname") || "/";
  const landing = shouldShowLanding(hostname, pathname);
  const marketingLegal = shouldShowMarketingChrome(hostname, pathname);

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${
        landing ? "scroll-smooth" : ""
      }`}
    >
      <body
        className={`min-h-full text-white ${
          landing || marketingLegal ? "bg-[#0F172A]" : "bg-ink"
        }`}
      >
        {landing ? (
          <LandingPage />
        ) : marketingLegal ? (
          <MarketingShell>{children}</MarketingShell>
        ) : (
          <AppShell>{children}</AppShell>
        )}
        <Analytics />
      </body>
    </html>
  );
}
