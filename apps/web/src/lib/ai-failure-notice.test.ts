import { describe, expect, it } from "vitest";
import { aiProviderFailureCategories } from "@careerden/contracts";
import { describeAiFailure } from "./ai-failure-notice";

describe("describeAiFailure", () => {
  it("gives every category a distinct title and message in Careerden Unplugged", () => {
    const notices = aiProviderFailureCategories.map((category) =>
      describeAiFailure({ category }, true),
    );

    expect(new Set(notices.map((notice) => notice.title)).size).toBe(notices.length);
    expect(new Set(notices.map((notice) => notice.message)).size).toBe(notices.length);
  });

  it("sends the user to Settings only when a key, provider, or model change can fix it", () => {
    const withSettings = aiProviderFailureCategories.filter(
      (category) => describeAiFailure({ category }, true).showSettings,
    );

    expect(withSettings).toEqual([
      "invalid_api_key",
      "insufficient_quota",
      "model_unavailable",
      "invalid_output",
    ]);
  });

  it("does not blame the user's key or balance in the cloud edition", () => {
    for (const category of aiProviderFailureCategories) {
      const notice = describeAiFailure({ category }, false);
      expect(notice.showSettings).toBe(false);
      expect(notice.message).not.toMatch(/API key|balance|Settings/);
    }
  });
});
