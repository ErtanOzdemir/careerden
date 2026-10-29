import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../edition.js", () => ({ isLocalEdition: true }));

describe("useAccountSession in the local edition", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports no account without requesting a session", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { useAccountSession } = await import("./auth.js");

    expect(useAccountSession()).toMatchObject({ data: null, isPending: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});
