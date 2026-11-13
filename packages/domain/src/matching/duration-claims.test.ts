import { describe, expect, it } from "vitest";
import type { UserProfile } from "../profiles/user-profile.js";
import {
  collectSupportedDurationClaims,
  durationClaimsFromDates,
  extractDurationClaims,
  redactDurationPhrases,
  sanitizeDurationClaims,
  stripUnsupportedDurationSentences,
} from "./duration-claims.js";

describe("extractDurationClaims", () => {
  it("normalizes numeric and written durations to the same claim", () => {
    expect(extractDurationClaims("4 years of Go and four yrs of Rust")).toEqual(["4 year"]);
    expect(extractDurationClaims("5+ years")).toEqual(["5 year"]);
    expect(extractDurationClaims("No durations here")).toEqual([]);
  });

  it("allows whitespace around the plus sign", () => {
    expect(extractDurationClaims("5 + years, 6+  yrs and seven\t+\tyears")).toEqual([
      "5 year",
      "6 year",
      "7 year",
    ]);
  });

  it("stays linear on long whitespace runs that never reach a unit", () => {
    const started = performance.now();

    expect(extractDurationClaims(`1${"\t".repeat(250_000)}x`)).toEqual([]);
    expect(extractDurationClaims(`one${"\t".repeat(250_000)}x`)).toEqual([]);
    expect(redactDurationPhrases(`1${"\t".repeat(250_000)}x`, new Set())).toBe("1 x");
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe("durationClaimsFromDates", () => {
  it("authorizes every whole year up to a role's span", () => {
    const claims = durationClaimsFromDates(
      createProfile({ startDate: "2018-01", endDate: "2022-01" }),
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect([...claims].sort()).toEqual(["1 year", "2 year", "3 year", "4 year"]);
  });

  it("treats an open-ended role as running until now", () => {
    const claims = durationClaimsFromDates(
      createProfile({ startDate: "2024-01" }),
      new Date("2026-06-01T00:00:00.000Z"),
    );

    expect(claims.has("2 year")).toBe(true);
    expect(claims.has("3 year")).toBe(false);
  });

  it("ignores dates it cannot parse strictly", () => {
    expect(durationClaimsFromDates(createProfile({ startDate: "sometime in 2018" })).size).toBe(0);
    expect(durationClaimsFromDates(createProfile({ startDate: "2018-13" })).size).toBe(0);
    expect(durationClaimsFromDates(createProfile({ startDate: "Jan 2018" })).size).toBe(0);
  });
});

describe("collectSupportedDurationClaims", () => {
  it("combines durations written in the profile with those its dates imply", () => {
    const claims = collectSupportedDurationClaims(
      createProfile({
        startDate: "2022-01",
        endDate: "2024-01",
        summary: "Engineer with 9 years of leadership experience.",
      }),
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(claims.has("9 year")).toBe(true);
    expect(claims.has("2 year")).toBe(true);
    expect(claims.has("5 year")).toBe(false);
  });
});

describe("stripUnsupportedDurationSentences", () => {
  const supported = new Set(["4 year"]);

  it("removes only the offending sentence", () => {
    expect(
      stripUnsupportedDurationSentences(
        "I bring 9 years of experience. I built production services. I have 4 years of Go.",
        supported,
      ),
    ).toBe("I built production services. I have 4 years of Go.");
  });

  it("preserves paragraph breaks", () => {
    expect(
      stripUnsupportedDurationSentences(
        "First paragraph is fine.\nI bring 9 years of experience.\nThird paragraph is fine.",
        supported,
      ),
    ).toBe("First paragraph is fine.\nThird paragraph is fine.");
  });

  it("does not split on abbreviations or decimals", () => {
    expect(
      stripUnsupportedDurationSentences(
        "I worked at Example Inc. on backend services. I e.g. built pipelines.",
        supported,
      ),
    ).toBe("I worked at Example Inc. on backend services. I e.g. built pipelines.");
  });

  it("returns empty when every sentence is unsupported", () => {
    expect(stripUnsupportedDurationSentences("I bring 9 years of experience.", supported)).toBe("");
  });
});

describe("redactDurationPhrases", () => {
  const supported = new Set(["4 year"]);

  it("keeps a lead-in preposition when the phrase governs what follows", () => {
    expect(
      redactDurationPhrases("Backend engineer with 9 years of TypeScript experience.", supported),
    ).toBe("Backend engineer with TypeScript experience.");
  });

  it("drops a lead-in preposition that would otherwise dangle", () => {
    expect(redactDurationPhrases("Delivered backend services over 9 years.", supported)).toBe(
      "Delivered backend services.",
    );
  });

  it("leaves supported claims untouched", () => {
    expect(redactDurationPhrases("I have 4 years of Go and 9 years of Rust.", supported)).toBe(
      "I have 4 years of Go and Rust.",
    );
  });
});

describe("sanitizeDurationClaims", () => {
  const supported = new Set(["4 year"]);

  it("prefers sentence removal", () => {
    expect(
      sanitizeDurationClaims("I bring 9 years of experience. I built services.", supported),
    ).toBe("I built services.");
  });

  it("falls back to redaction rather than emptying a non-empty field", () => {
    expect(sanitizeDurationClaims("I offer 9 years of TypeScript experience.", supported)).toBe(
      "I offer TypeScript experience.",
    );
  });

  it("keeps whatever wording surrounds an unsupported claim", () => {
    for (const text of [
      "Over 9 years of work.",
      "I have nine years of experience.",
      "Shipped services across 9 years.",
    ]) {
      expect(sanitizeDurationClaims(text, supported)).not.toBe("");
    }
  });

  it("returns empty only when the text is nothing but an unsupported claim", () => {
    expect(sanitizeDurationClaims("9 yrs", supported)).toBe("");
  });

  it("passes empty input through", () => {
    expect(sanitizeDurationClaims("   ", supported)).toBe("");
  });
});

function createProfile(
  overrides: { startDate?: string; endDate?: string; summary?: string } = {},
): UserProfile {
  return {
    id: "profile-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    autoRunMatchAnalysis: true,
    autoGenerateDocuments: true,
    followUpRemindersEnabled: true,
    links: [],
    summary: overrides.summary,
    skillGroups: [],
    experience: [
      {
        company: "Analytical Engines",
        title: "Backend Engineer",
        startDate: overrides.startDate,
        endDate: overrides.endDate,
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
