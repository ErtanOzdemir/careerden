import { describe, expect, it } from "vitest";
import { canTransitionJobApplicationStatus } from "./workflow-status.js";

describe("job application workflow status", () => {
  it("allows the happy-path worker transitions", () => {
    expect(canTransitionJobApplicationStatus("queued", "scraping")).toBe(true);
    expect(canTransitionJobApplicationStatus("scraping", "scraped")).toBe(true);
    expect(canTransitionJobApplicationStatus("scraped", "analyzing")).toBe(true);
    expect(canTransitionJobApplicationStatus("analyzing", "review_ready")).toBe(true);
    expect(canTransitionJobApplicationStatus("review_ready", "generating_documents")).toBe(true);
    expect(canTransitionJobApplicationStatus("generating_documents", "completed")).toBe(true);
  });

  it("rejects skipping worker states", () => {
    expect(canTransitionJobApplicationStatus("queued", "completed")).toBe(false);
  });

  it("allows completed documents to be regenerated after edits", () => {
    expect(canTransitionJobApplicationStatus("completed", "generating_documents")).toBe(true);
  });

  it("allows failed document generation to be retried", () => {
    expect(canTransitionJobApplicationStatus("failed", "generating_documents")).toBe(true);
  });
});
