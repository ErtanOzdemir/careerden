import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const development = process.env.NODE_ENV === "development";
const permissionsPolicy =
  "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()";

export type MarketingSecurityHeader = {
  key: string;
  value: string;
};

// The Umami origin, when analytics is configured, is the only other origin the site loads from.
const analyticsOrigin =
  process.env.NEXT_PUBLIC_UMAMI_ORIGIN && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
    ? new URL(process.env.NEXT_PUBLIC_UMAMI_ORIGIN).origin
    : undefined;

export function createMarketingContentSecurityPolicy(
  developmentMode: boolean,
  analytics?: string,
): string {
  const analyticsSource = analytics ? ` ${analytics}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${developmentMode ? " 'unsafe-eval'" : ""}${analyticsSource}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    `connect-src 'self'${analyticsSource}`,
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
  analytics?: string,
): MarketingSecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: createMarketingContentSecurityPolicy(developmentMode, analytics),
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
        headers: createMarketingSecurityHeaders(development, analyticsOrigin),
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
