import { describe, expect, it } from "vitest";
import { canTransitionJobApplicationStatus } from "./workflow-status.js";

describe("job application workflow status", () => {
  it("allows the happy-path worker transitions", () => {
    expect(canTransitionJobApplicationStatus("queued", "scraping")).toBe(true);
    expect(canTransitionJobApplicationStatus("scraping", "analyzing")).toBe(true);
    expect(canTransitionJobApplicationStatus("analyzing", "generating_documents")).toBe(true);
    expect(canTransitionJobApplicationStatus("generating_documents", "completed")).toBe(true);
  });

  it("rejects skipping worker states", () => {
    expect(canTransitionJobApplicationStatus("queued", "completed")).toBe(false);
  });
});
