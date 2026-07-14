import { describe, expect, it, vi } from "vitest";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";

describe("enqueueMatchAnalysisIfEnabled", () => {
  it("pauses automatic analysis when the profile is blocked", async () => {
    const addEvent = vi.fn();
    const addOutbox = vi.fn();

    await expect(
      enqueueMatchAnalysisIfEnabled({
        jobApplications: { addEvent, setAnalysisAttempt: vi.fn() },
        outbox: { add: addOutbox },
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: true,
        profileReadiness: {
          state: "blocked",
          warnings: ["positioning", "skills", "evidence"],
        },
      }),
    ).resolves.toBe(false);

    expect(addOutbox).not.toHaveBeenCalled();
    expect(addEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Profile action required" }),
    );
  });
});
