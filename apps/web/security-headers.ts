import type { Plugin } from "vite";

const permissionsPolicy =
  "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()";
const strictTransportSecurity = "max-age=31536000";

export type WebSecurityPolicyOptions = {
  apiBaseUrl?: string;
  development: boolean;
};

export function createWebContentSecurityPolicy(options: WebSecurityPolicyOptions): string {
  const connectSources = ["'self'"];
  const apiOrigin = getAbsoluteHttpOrigin(options.apiBaseUrl);

  if (apiOrigin) {
    connectSources.push(apiOrigin);
  }

  if (options.development) {
    connectSources.push("ws:", "wss:");
  }

  return [
    "default-src 'self'",
    `script-src 'self'${options.development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: https:",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
  ].join("; ");
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
            content: headers["Content-Security-Policy"],
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
