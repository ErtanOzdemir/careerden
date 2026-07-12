import { describe, expect, it } from "vitest";
import { getLocalGreeting } from "./AppShell.js";

describe("getLocalGreeting", () => {
  it.each([
    [new Date(2026, 0, 1, 0), "Good morning"],
    [new Date(2026, 0, 1, 11, 59), "Good morning"],
    [new Date(2026, 0, 1, 12), "Good afternoon"],
    [new Date(2026, 0, 1, 17, 59), "Good afternoon"],
    [new Date(2026, 0, 1, 18), "Good evening"],
    [new Date(2026, 0, 1, 23, 59), "Good evening"],
  ])("returns the local greeting for %s", (date, expected) => {
    expect(getLocalGreeting(date)).toBe(expected);
  });
});
