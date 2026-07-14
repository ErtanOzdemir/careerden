import type {
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
} from "../profiles/user-profile.js";

export const DESCRIPTION_ONLY_DOCUMENT_CONTENT_FORMAT_VERSION = 2 as const;

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; href: string };

export interface RichTextNode {
  type: "text";
  text: string;
  marks?: RichTextMark[];
}

export type RichTextAlignment = "left" | "center" | "right" | "justify";

export interface RichParagraph {
  type: "paragraph";
  alignment?: RichTextAlignment;
  children: RichTextNode[];
}

export interface RichHeading {
  type: "heading";
  level: 1 | 2 | 3;
  alignment?: RichTextAlignment;
  children: RichTextNode[];
}

export interface RichListItem {
  blocks: RichBlock[];
}

export interface RichList {
  type: "bulletList" | "orderedList";
  items: RichListItem[];
}

export interface RichTableCell {
  blocks: RichBlock[];
}

export interface RichTableRow {
  cells: RichTableCell[];
}

export interface RichTable {
  type: "table";
  rows: RichTableRow[];
}

export type RichBlock = RichParagraph | RichHeading | RichList | RichTable;

export interface RichDocument {
  version: 1;
  blocks: RichBlock[];
}

export interface DocumentContentExperienceEnhancement {
  experienceIndex: number;
  description?: RichDocument;
  achievements: RichDocument[];
}

export interface DocumentContentEducationEnhancement {
  educationIndex: number;
  description?: RichDocument;
  achievements: RichDocument[];
}

export interface DocumentContentProjectEnhancement {
  projectIndex: number;
  description?: RichDocument;
  achievements: RichDocument[];
}

export interface DocumentContentSelections {
  customizedSummary?: "ai" | "original";
  skills?: "ai" | "original";
  certifications?: "ai" | "original";
  experience: Record<
    string,
    {
      description?: "ai" | "original";
      achievements: Record<string, "ai" | "original">;
    }
  >;
  education: Record<
    string,
    {
      description?: "ai" | "original";
      achievements: Record<string, "ai" | "original">;
    }
  >;
  projects: Record<
    string,
    {
      description?: "ai" | "original";
      achievements: Record<string, "ai" | "original">;
    }
  >;
}

export interface DocumentContent {
  coverLetterContent?: RichDocument;
  customizedSummary: RichDocument;
  formatVersion?: typeof DESCRIPTION_ONLY_DOCUMENT_CONTENT_FORMAT_VERSION;
  experienceEnhancements: DocumentContentExperienceEnhancement[];
  skillSuggestions?: string[];
  educationEnhancements?: DocumentContentEducationEnhancement[];
  projectEnhancements?: DocumentContentProjectEnhancement[];
  certificationSuggestions?: string[];
  selections?: DocumentContentSelections;
}

export function richDocumentFromText(text: string): RichDocument {
  return {
    version: 1,
    blocks: text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        type: "paragraph" as const,
        children: [{ type: "text" as const, text: line }],
      })),
  };
}

export function documentContentFromMatchAnalysis(input: {
  coverLetterContent?: string;
  customizedSummary: string;
  experienceEnhancements?: Array<{
    experienceIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }>;
  skillSuggestions?: string[];
  educationEnhancements?: Array<{
    educationIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }>;
  projectEnhancements?: Array<{
    projectIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }>;
  certificationSuggestions?: string[];
}): DocumentContent {
  return {
    coverLetterContent: richDocumentFromText(input.coverLetterContent ?? ""),
    customizedSummary: richDocumentFromText(input.customizedSummary),
    formatVersion: DESCRIPTION_ONLY_DOCUMENT_CONTENT_FORMAT_VERSION,
    experienceEnhancements: (input.experienceEnhancements ?? []).map((enhancement) =>
      toDescriptionOnlyEnhancement(
        "experienceIndex",
        enhancement.experienceIndex,
        enhancement.enhancedDescription,
        enhancement.enhancedAchievements,
      ),
    ),
    skillSuggestions: input.skillSuggestions ?? [],
    educationEnhancements: (input.educationEnhancements ?? []).map((enhancement) =>
      toDescriptionOnlyEnhancement(
        "educationIndex",
        enhancement.educationIndex,
        enhancement.enhancedDescription,
        enhancement.enhancedAchievements,
      ),
    ),
    projectEnhancements: (input.projectEnhancements ?? []).map((enhancement) =>
      toDescriptionOnlyEnhancement(
        "projectIndex",
        enhancement.projectIndex,
        enhancement.enhancedDescription,
        enhancement.enhancedAchievements,
      ),
    ),
    certificationSuggestions: input.certificationSuggestions ?? [],
    selections: {
      experience: {},
      education: {},
      projects: {},
    },
  };
}

export function normalizeDescriptionOnlyDocumentContent(
  profile: {
    education: ProfileEducation[];
    experience: ProfileExperience[];
    projects: ProfileProject[];
  },
  content: DocumentContent,
): DocumentContent {
  const experience = normalizeExperienceEnhancements(profile.experience, content);
  const education = normalizeEducationEnhancements(profile.education, content);
  const projects = normalizeProjectEnhancements(profile.projects, content);

  return {
    ...content,
    formatVersion: DESCRIPTION_ONLY_DOCUMENT_CONTENT_FORMAT_VERSION,
    experienceEnhancements: experience.enhancements,
    educationEnhancements: education.enhancements,
    projectEnhancements: projects.enhancements,
    selections: {
      ...content.selections,
      experience: normalizeSelections(content.selections?.experience, experience.collapsedIndexes),
      education: normalizeSelections(content.selections?.education, education.collapsedIndexes),
      projects: normalizeSelections(content.selections?.projects, projects.collapsedIndexes),
    },
  };
}

export function mergeRichDocumentsAsProse(
  ...documents: Array<RichDocument | undefined>
): RichDocument | undefined {
  const nonEmptyDocuments = documents.filter((document): document is RichDocument =>
    Boolean(document && richDocumentToPlainText(document)),
  );
  if (nonEmptyDocuments.length === 0) return undefined;
  if (
    nonEmptyDocuments.length === 1 &&
    nonEmptyDocuments[0]?.blocks.length === 1 &&
    nonEmptyDocuments[0].blocks[0]?.type === "paragraph"
  ) {
    return nonEmptyDocuments[0];
  }

  const seen = new Set<string>();
  const sentences = nonEmptyDocuments
    .flatMap((document) => richDocumentToPlainText(document).split(/\n+/))
    .flatMap((text) => text.trim().split(/(?<=[.!?])\s+/))
    .map((text) => text.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((text) => {
      const key = text.toLocaleLowerCase().replace(/[.!?]+$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((text) => (/[.!?]$/.test(text) ? text : `${text}.`));

  return sentences.length > 0 ? richDocumentFromText(sentences.join(" ")) : undefined;
}

export function profileProjectDescriptionAsProse(
  project: Pick<ProfileProject, "achievements" | "description" | "descriptionRichText">,
): RichDocument | undefined {
  return mergeRichDocumentsAsProse(
    toRichDocument(project.description, project.descriptionRichText),
    ...project.achievements.map(richDocumentFromText),
  );
}

export function richDocumentToPlainText(document: RichDocument): string {
  return document.blocks.map(blockToPlainText).filter(Boolean).join("\n");
}

function blockToPlainText(block: RichBlock): string {
  if (block.type === "paragraph" || block.type === "heading") {
    return block.children.map((child) => child.text).join("");
  }

  if ("items" in block) {
    return block.items
      .map((item) => item.blocks.map(blockToPlainText).filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n");
  }

  return block.rows
    .map((row) =>
      row.cells
        .map((cell) => cell.blocks.map(blockToPlainText).filter(Boolean).join("\n"))
        .join("\t"),
    )
    .join("\n");
}

function toDescriptionOnlyEnhancement<
  K extends "educationIndex" | "experienceIndex" | "projectIndex",
>(
  indexField: K,
  index: number,
  description?: string,
  achievements: string[] = [],
): Record<K, number> & { description?: RichDocument; achievements: RichDocument[] } {
  const mergedDescription = mergeRichDocumentsAsProse(
    description ? richDocumentFromText(description) : undefined,
    ...achievements.map(richDocumentFromText),
  );
  const indexedEnhancement = { [indexField]: index } as Record<K, number>;

  return {
    ...indexedEnhancement,
    ...(mergedDescription ? { description: mergedDescription } : {}),
    achievements: [],
  };
}

function normalizeExperienceEnhancements(
  experiences: ProfileExperience[],
  content: DocumentContent,
): NormalizedEnhancements<DocumentContentExperienceEnhancement> {
  const collapsedIndexes = new Set<number>();
  const enhancements = content.experienceEnhancements.map((enhancement) => {
    const selection = content.selections?.experience?.[String(enhancement.experienceIndex)];
    if (enhancement.achievements.length === 0) {
      return { ...enhancement, achievements: [] };
    }
    collapsedIndexes.add(enhancement.experienceIndex);
    const experience = experiences[enhancement.experienceIndex];
    const originalDescription = experience
      ? toRichDocument(experience.description, experience.descriptionRichText)
      : undefined;
    const description =
      selection?.description === "original"
        ? originalDescription
        : (enhancement.description ?? originalDescription);
    const selectedAchievements = enhancement.achievements.filter(
      (_, index) => selection?.achievements?.[String(index)] !== "original",
    );
    const mergedDescription = mergeRichDocumentsAsProse(description, ...selectedAchievements);

    return {
      experienceIndex: enhancement.experienceIndex,
      ...(mergedDescription ? { description: mergedDescription } : {}),
      achievements: [],
    };
  });

  return { collapsedIndexes, enhancements };
}

function normalizeEducationEnhancements(
  _education: ProfileEducation[],
  content: DocumentContent,
): NormalizedEnhancements<DocumentContentEducationEnhancement> {
  const collapsedIndexes = new Set<number>();
  const enhancements = (content.educationEnhancements ?? []).map((enhancement) => {
    const selection = content.selections?.education?.[String(enhancement.educationIndex)];
    if (enhancement.achievements.length === 0) {
      return { ...enhancement, achievements: [] };
    }
    collapsedIndexes.add(enhancement.educationIndex);
    const description = selection?.description === "original" ? undefined : enhancement.description;
    const selectedAchievements = enhancement.achievements.filter(
      (_, index) => selection?.achievements?.[String(index)] !== "original",
    );
    const mergedDescription = mergeRichDocumentsAsProse(description, ...selectedAchievements);

    return {
      educationIndex: enhancement.educationIndex,
      ...(mergedDescription ? { description: mergedDescription } : {}),
      achievements: [],
    };
  });

  return { collapsedIndexes, enhancements };
}

function normalizeProjectEnhancements(
  projects: ProfileProject[],
  content: DocumentContent,
): NormalizedEnhancements<DocumentContentProjectEnhancement> {
  const collapsedIndexes = new Set<number>();
  const enhancementByIndex = new Map(
    (content.projectEnhancements ?? []).map((enhancement) => [
      enhancement.projectIndex,
      enhancement,
    ]),
  );
  const indexes = new Set(enhancementByIndex.keys());
  if (content.formatVersion !== DESCRIPTION_ONLY_DOCUMENT_CONTENT_FORMAT_VERSION) {
    projects.forEach((project, index) => {
      if (project.achievements.length > 0) indexes.add(index);
    });
  }

  const enhancements = [...indexes]
    .sort((left, right) => left - right)
    .flatMap((projectIndex) => {
      const project = projects[projectIndex];
      const enhancement = enhancementByIndex.get(projectIndex);
      const selection = content.selections?.projects?.[String(projectIndex)];
      const originalDescription = project
        ? toRichDocument(project.description, project.descriptionRichText)
        : undefined;
      const originalAchievements = project?.achievements ?? [];
      const shouldCollapse =
        (enhancement?.achievements.length ?? 0) > 0 ||
        (content.formatVersion !== DESCRIPTION_ONLY_DOCUMENT_CONTENT_FORMAT_VERSION &&
          originalAchievements.length > 0);

      if (!shouldCollapse) {
        return enhancement ? [{ ...enhancement, achievements: [] }] : [];
      }

      collapsedIndexes.add(projectIndex);
      const description =
        selection?.description === "original"
          ? originalDescription
          : (enhancement?.description ?? originalDescription);
      const count = Math.max(originalAchievements.length, enhancement?.achievements.length ?? 0);
      const selectedAchievements = Array.from({ length: count }, (_, achievementIndex) => {
        const original = originalAchievements[achievementIndex]
          ? richDocumentFromText(originalAchievements[achievementIndex])
          : undefined;
        const enhanced = enhancement?.achievements[achievementIndex];
        if (!enhanced) return original;
        return selection?.achievements?.[String(achievementIndex)] === "original"
          ? original
          : enhanced;
      }).filter((achievement): achievement is RichDocument => Boolean(achievement));
      const mergedDescription = mergeRichDocumentsAsProse(description, ...selectedAchievements);

      return mergedDescription
        ? [{ projectIndex, description: mergedDescription, achievements: [] }]
        : [];
    });

  return { collapsedIndexes, enhancements };
}

interface NormalizedEnhancements<T> {
  collapsedIndexes: Set<number>;
  enhancements: T[];
}

function normalizeSelections(
  selections: Record<
    string,
    {
      description?: "ai" | "original";
      achievements: Record<string, "ai" | "original">;
    }
  > = {},
  collapsedIndexes: Set<number>,
) {
  return Object.fromEntries(
    Object.entries(selections).map(([index, selection]) => [
      index,
      {
        ...(selection.description ? { description: selection.description } : {}),
        ...(collapsedIndexes.has(Number(index)) ? { description: "ai" as const } : {}),
        achievements: {},
      },
    ]),
  );
}

function toRichDocument(
  text: string | undefined,
  richText: RichDocument | undefined,
): RichDocument | undefined {
  return richText ?? (text ? richDocumentFromText(text) : undefined);
}
