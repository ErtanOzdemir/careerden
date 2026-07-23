import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const development = process.env.NODE_ENV === "development";
const permissionsPolicy =
  "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()";

export type MarketingSecurityHeader = {
  key: string;
  value: string;
};

export function createMarketingContentSecurityPolicy(developmentMode: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${developmentMode ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    ...(developmentMode ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function createMarketingSecurityHeaders(
  developmentMode: boolean,
): MarketingSecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: createMarketingContentSecurityPolicy(developmentMode),
    },
    { key: "Permissions-Policy", value: permissionsPolicy },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    ...(developmentMode ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
  ];
}

const nextConfig: NextConfig = {
  distDir: "dist",
  async headers() {
    return [
      {
        headers: createMarketingSecurityHeaders(development),
        source: "/:path*",
      },
    ];
  },
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },
};

export default nextConfig;
