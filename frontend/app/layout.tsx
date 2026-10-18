import type { Metadata, Viewport } from "next";
import InstallBanner from "@/components/InstallBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "TA — Private Couple Chat",
  description: "End-to-end encrypted private chat",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TA",
  },
};

export const viewport: Viewport = {
  themeColor: "#111b21",
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
