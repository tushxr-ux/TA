import type { NextConfig } from "next";
// @ts-expect-error – next-pwa has no types
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {}, // suppress next-pwa webpack conflict warning
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
