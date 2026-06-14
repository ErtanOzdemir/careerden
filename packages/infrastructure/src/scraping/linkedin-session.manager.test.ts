import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { LinkedInSessionManager } from "./linkedin-session.manager.js";

describe("LinkedInSessionManager", () => {
  it("reports missing when no encrypted session exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "link2cv-linkedin-session-"));
    const manager = new LinkedInSessionManager(dir, "test-secret");

    await expect(manager.getStatus()).resolves.toMatchObject({
      status: "missing",
    });
  });

  it("reports missing with a readable message when the login browser cannot open", async () => {
    const dir = await mkdtemp(join(tmpdir(), "link2cv-linkedin-session-"));
    const manager = new LinkedInSessionManager(dir, "test-secret", {
      async launchBrowser() {
        throw new Error("GUI is unavailable");
      },
    });

    await expect(manager.startLogin()).resolves.toMatchObject({
      status: "missing",
      message: expect.stringContaining("GUI is unavailable"),
    });
  });
});
