import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { createWebSecurityHeaders, createWebSecurityHeadersPlugin } from "./security-headers.js";

export default defineConfig(({ mode }) => {
  const development = mode === "development";
  const env = loadEnv(mode, import.meta.dirname, "VITE_");
  const securityHeaders = createWebSecurityHeaders({
    apiBaseUrl: env.VITE_API_BASE_URL,
    development,
  });

  return {
    plugins: [createWebSecurityHeadersPlugin(securityHeaders), react(), tailwindcss()],
    // `dev` has no `dependsOn: ["^build"]` in turbo.json, so without the `development` condition a
    // fresh clone would resolve @careerden/contracts to its unbuilt `dist`. Vite replaces the
    // default condition list rather than extending it, so the defaults are repeated here.
    resolve: {
      conditions: ["development", "module", "browser", "development|production"],
    },
    preview: {
      headers: securityHeaders,
    },
    server: {
      headers: securityHeaders,
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
