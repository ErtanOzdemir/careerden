import type { Plugin } from "vite";

const permissionsPolicy =
  "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()";
const strictTransportSecurity = "max-age=31536000";
const viteReactRefreshPreambleHash = "'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk='";

export type WebSecurityPolicyOptions = {
  apiBaseUrl?: string;
  development: boolean;
};

export function createWebContentSecurityPolicy(options: WebSecurityPolicyOptions): string {
  // `https:` broadly (not a specific origin) matches how `frameSources`/`imageSources` already
  // handle origins not known at build time (scraped company logos, embedded job postings). Generated
  // document downloads are fetched client-side from a presigned object-storage URL whose origin is
  // likewise only known at request time (S3/R2/rustfs, potentially behind a CDN), so `connect-src`
  // needs the same allowance — otherwise the fetch is silently blocked by CSP.
  const connectSources = ["'self'", "https:"];
  const frameSources = ["'self'", "https:"];
  const imageSources = ["'self'", "data:", "https:"];
  const apiOrigin = getAbsoluteHttpOrigin(options.apiBaseUrl);

  if (apiOrigin) {
    connectSources.push(apiOrigin);
  }

  if (options.development) {
    connectSources.push("ws:", "wss:", "http://localhost:*", "http://127.0.0.1:*");
    frameSources.push("http://localhost:*", "http://127.0.0.1:*");
    imageSources.push("http://localhost:*", "http://127.0.0.1:*");
  }

  return [
    "default-src 'self'",
    `script-src 'self'${
      options.development ? ` 'unsafe-eval' ${viteReactRefreshPreambleHash}` : ""
    }`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src ${imageSources.join(" ")}`,
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `frame-src ${frameSources.join(" ")}`,
    "worker-src 'none'",
  ].join("; ");
}

export function createWebMetaContentSecurityPolicy(contentSecurityPolicy: string): string {
  return contentSecurityPolicy
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive && !directive.startsWith("frame-ancestors "))
    .join("; ");
}

export function createWebSecurityHeaders(
  options: WebSecurityPolicyOptions,
): Record<string, string> {
  return {
    "Content-Security-Policy": createWebContentSecurityPolicy(options),
    "Permissions-Policy": permissionsPolicy,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...(options.development ? {} : { "Strict-Transport-Security": strictTransportSecurity }),
  };
}

export function createWebSecurityHeadersPlugin(headers: Record<string, string>): Plugin {
  return {
    name: "careerden-web-security-headers",
    transformIndexHtml: {
      order: "pre",
      handler: () => [
        {
          attrs: {
            content: createWebMetaContentSecurityPolicy(headers["Content-Security-Policy"]),
            "http-equiv": "Content-Security-Policy",
          },
          injectTo: "head-prepend",
          tag: "meta",
        },
      ],
    },
    generateBundle() {
      this.emitFile({
        fileName: "_headers",
        source: createStaticHeadersFile(headers),
        type: "asset",
      });
    },
  };
}

function createStaticHeadersFile(headers: Record<string, string>): string {
  const headerLines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
  return ["/*", ...headerLines, ""].join("\n");
}

function getAbsoluteHttpOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}
