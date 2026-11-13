import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite suites open a database and run every migration in their hooks. Under a parallel
    // workspace run that takes longer than the 10s default, and PGlite's synchronous WebAssembly
    // work blocks the event loop, so Vitest 2 used to miss the overrun.
    hookTimeout: 60_000,
  },
});
