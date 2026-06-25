import { describe, expect, it } from "vitest";
import rootPackageJson from "../../../../package.json" with { type: "json" };

describe("desktop native rebuild scripts", () => {
  it("rebuilds Electron native modules before launching the desktop app", () => {
    const script = rootPackageJson.scripts["dev:desktop"];

    expect(script).toContain("pnpm --filter @link2cv/desktop run rebuild");
    expect(script.indexOf("pnpm --filter @link2cv/desktop run rebuild")).toBeLessThan(
      script.indexOf("pnpm --filter @link2cv/desktop dev"),
    );
  });

  it("rebuilds native modules for Node before running the test suite", () => {
    const script = rootPackageJson.scripts.test;

    expect(script).toContain("pnpm rebuild better-sqlite3");
    expect(script.indexOf("pnpm rebuild better-sqlite3")).toBeLessThan(
      script.indexOf("turbo run test"),
    );
  });
});
