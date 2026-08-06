import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Matches vite.config.ts: resolve workspace packages to their source in development. Vite
  // replaces the default condition list rather than extending it, so the defaults are repeated.
  resolve: {
    conditions: ["development", "module", "browser", "development|production"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
