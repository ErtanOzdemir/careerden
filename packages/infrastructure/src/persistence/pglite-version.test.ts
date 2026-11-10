import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { pgliteVersion } from "./pglite-knex.js";

// Every workspace that installs PGlite. A version range would let an install pick up a release
// that cannot open existing Unplugged data, so each pins exact versions, and PGlite itself the
// recorded one.
const manifests = ["../../package.json", "../../../../apps/api/package.json"];
const pglitePackages = ["@electric-sql/pglite", "@electric-sql/pglite-tools", "knex-pglite"];

describe("pgliteVersion", () => {
  it.each(manifests)("matches the exact PGlite versions pinned in %s", async (path) => {
    const manifest = JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const versions = { ...manifest.dependencies, ...manifest.devDependencies };

    expect(versions["@electric-sql/pglite"]).toBe(pgliteVersion);
    for (const name of pglitePackages) {
      if (versions[name] !== undefined) expect(versions[name], name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
