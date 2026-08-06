import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { richDocumentFromText, richDocumentToPlainText } from "@careerden/domain";
import type { RichDocument } from "@careerden/domain";

const require = createRequire(import.meta.url);
const { collapseLegacyDocumentContent } =
  require("./postgres-migrations/20260806000000_collapse_legacy_document_content_achievements.cjs") as {
    collapseLegacyDocumentContent: (
      profile: Record<string, unknown[]>,
      content: Record<string, unknown>,
    ) => LegacyContent;
  };

interface LegacyEnhancement {
  description?: RichDocument;
  achievements?: unknown;
  educationIndex?: number;
  experienceIndex?: number;
  projectIndex?: number;
}

interface LegacyContent {
  formatVersion?: number;
  experienceEnhancements: LegacyEnhancement[];
  educationEnhancements: LegacyEnhancement[];
  projectEnhancements: LegacyEnhancement[];
  selections?: Record<string, Record<string, { description?: string; achievements?: unknown }>>;
}

/**
 * These fixtures are the ones the deleted runtime normalizer was tested against. The migration is
 * irreversible, so this parity check is the only thing standing between a refactor and silently
 * mangled user data.
 */
describe("collapseLegacyDocumentContent", () => {
  it("collapses legacy per-item achievements using their saved selections", () => {
    const collapsed = collapseLegacyDocumentContent(legacyProfile(), legacyContent());

    expect(collapsed.formatVersion).toBe(2);
    expect(plainText(collapsed.experienceEnhancements[0])).toBe(
      "Original experience. AI experience result.",
    );
    expect(plainText(collapsed.educationEnhancements[0])).toBe(
      "Tailored coursework. Graduated with honors.",
    );
    expect(plainText(collapsed.projectEnhancements[0])).toBe(
      "Tailored project. Original project result.",
    );
  });

  it("removes every achievements key so the strict schema accepts the row", () => {
    const collapsed = collapseLegacyDocumentContent(legacyProfile(), legacyContent());

    expect(JSON.stringify(collapsed)).not.toContain("achievements");
  });

  it("pins collapsed indexes to the AI side", () => {
    const collapsed = collapseLegacyDocumentContent(legacyProfile(), legacyContent());

    expect(collapsed.selections?.experience["0"]).toEqual({ description: "ai" });
    expect(collapsed.selections?.education["0"]).toEqual({ description: "ai" });
    expect(collapsed.selections?.projects["0"]).toEqual({ description: "ai" });
  });

  it("pins a collapsed index that had no saved selection at all", () => {
    const collapsed = collapseLegacyDocumentContent(legacyProfile(), {
      ...legacyContent(),
      selections: undefined,
    });

    expect(collapsed.selections?.experience["0"]).toEqual({ description: "ai" });
  });

  it("synthesizes an enhancement for a legacy project whose achievements were rendered alone", () => {
    const collapsed = collapseLegacyDocumentContent(legacyProfile(), {
      customizedSummary: richDocumentFromText("Summary"),
      experienceEnhancements: [],
      educationEnhancements: [],
      projectEnhancements: [],
    });

    expect(collapsed.projectEnhancements).toHaveLength(1);
    expect(plainText(collapsed.projectEnhancements[0])).toBe(
      "Original project. Original project result.",
    );
  });

  it("leaves an already-migrated row untouched", () => {
    const migrated = {
      customizedSummary: richDocumentFromText("Summary"),
      formatVersion: 2,
      experienceEnhancements: [
        { experienceIndex: 0, description: richDocumentFromText("Already tailored") },
      ],
      educationEnhancements: [],
      projectEnhancements: [],
      selections: { experience: {}, education: {}, projects: {} },
    };

    expect(collapseLegacyDocumentContent(legacyProfile(), migrated)).toEqual(migrated);
  });

  it("is idempotent", () => {
    const once = collapseLegacyDocumentContent(legacyProfile(), legacyContent());
    const twice = collapseLegacyDocumentContent(
      legacyProfile(),
      once as unknown as Record<string, unknown>,
    );

    expect(twice).toEqual(once);
  });

  it("accepts jsonb columns that arrive as strings", () => {
    const collapsed = collapseLegacyDocumentContent(
      {
        experience: JSON.stringify(legacyProfile().experience) as unknown as unknown[],
        education: JSON.stringify(legacyProfile().education) as unknown as unknown[],
        projects: JSON.stringify(legacyProfile().projects) as unknown as unknown[],
      },
      legacyContent(),
    );

    expect(plainText(collapsed.experienceEnhancements[0])).toBe(
      "Original experience. AI experience result.",
    );
  });
});

function plainText(enhancement?: LegacyEnhancement): string | undefined {
  return enhancement?.description ? richDocumentToPlainText(enhancement.description) : undefined;
}

function legacyProfile() {
  return {
    experience: [{ company: "Acme", title: "Engineer", description: "Original experience" }],
    education: [{ institution: "Example University" }],
    projects: [
      {
        name: "Compiler",
        description: "Original project",
        skills: [],
        achievements: ["Original project result"],
      },
    ],
  };
}

function legacyContent(): Record<string, unknown> {
  return {
    customizedSummary: richDocumentFromText("Summary"),
    experienceEnhancements: [
      {
        experienceIndex: 0,
        description: richDocumentFromText("AI experience"),
        achievements: [
          richDocumentFromText("AI experience result"),
          richDocumentFromText("Excluded result"),
        ],
      },
    ],
    educationEnhancements: [
      {
        educationIndex: 0,
        description: richDocumentFromText("Tailored coursework"),
        achievements: [richDocumentFromText("Graduated with honors")],
      },
    ],
    projectEnhancements: [
      {
        projectIndex: 0,
        description: richDocumentFromText("Tailored project"),
        achievements: [richDocumentFromText("AI project result")],
      },
    ],
    selections: {
      experience: {
        "0": { description: "original", achievements: { "0": "ai", "1": "original" } },
      },
      education: { "0": { description: "ai", achievements: { "0": "ai" } } },
      projects: { "0": { description: "ai", achievements: { "0": "original" } } },
    },
  };
}
