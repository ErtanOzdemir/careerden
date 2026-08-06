import { describe, expect, it } from "vitest";
import {
  compressToProse,
  fallbackEducationDescription,
  fallbackExperienceDescription,
  fallbackProjectDescription,
} from "./fallback-enhancement.js";

describe("compressToProse", () => {
  it("flattens bullet markers into prose", () => {
    expect(compressToProse("- Built TypeScript services\n• Worked with product partners")).toBe(
      "Built TypeScript services. Worked with product partners.",
    );
  });

  it("keeps only the leading sentences", () => {
    expect(compressToProse("One. Two. Three. Four. Five.")).toBe("One. Two.");
  });

  it("normalizes stray whitespace", () => {
    expect(compressToProse("Built    TypeScript\t services")).toBe("Built TypeScript services.");
  });

  it("returns empty for empty input", () => {
    expect(compressToProse("   \n  ")).toBe("");
  });
});

describe("fallbackExperienceDescription", () => {
  it("compresses the profile description", () => {
    expect(
      fallbackExperienceDescription({
        company: "Analytical Engines",
        title: "Backend Engineer",
        description: "- Built services\n- Ran deployments\n- Mentored peers",
      }),
    ).toBe("Built services. Ran deployments.");
  });

  it("states the role when there is no description", () => {
    expect(
      fallbackExperienceDescription({ company: "Analytical Engines", title: "Backend Engineer" }),
    ).toBe("Backend Engineer at Analytical Engines.");
  });
});

describe("fallbackEducationDescription", () => {
  it("falls back to the degree and institution", () => {
    expect(
      fallbackEducationDescription({
        institution: "Cambridge",
        degree: "BSc",
        field: "Mathematics",
      }),
    ).toBe("BSc in Mathematics at Cambridge.");
  });

  it("handles an institution with no degree recorded", () => {
    expect(fallbackEducationDescription({ institution: "Cambridge" })).toBe(
      "Studied at Cambridge.",
    );
  });
});

describe("fallbackProjectDescription", () => {
  it("merges the description and achievements", () => {
    expect(
      fallbackProjectDescription({
        name: "Difference Engine",
        description: "A mechanical calculator.",
        achievements: ["Published the design notes."],
        skills: [],
      }),
    ).toBe("A mechanical calculator. Published the design notes.");
  });

  it("names the project and its stack when nothing else exists", () => {
    expect(
      fallbackProjectDescription({
        name: "Difference Engine",
        achievements: [],
        skills: ["Brass", "Steam"],
      }),
    ).toBe("Difference Engine, built with Brass, Steam.");
  });

  it("never returns empty", () => {
    expect(
      fallbackProjectDescription({ name: "Difference Engine", achievements: [], skills: [] }),
    ).toBe("Difference Engine.");
  });
});
