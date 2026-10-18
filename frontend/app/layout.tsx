import type { Metadata, Viewport } from "next";
import InstallBanner from "@/components/InstallBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Together",
  description: "Private chat for two",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Together",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        {children}
        <InstallBanner />
      </body>
    </html>
  );
}
