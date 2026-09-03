import type { RichDocument } from "@careerden/contracts";
import { emptyRichDocument, mergeRichDocumentsAsProse, richDocumentFromText } from "@careerden/contracts";
import type { ApiDocumentContent, ApiProfile } from "../api/types.js";

/**
 * Mirrors the subset of the server's `toTemplateData` that the default CV/cover-letter templates
 * actually reference, computed entirely from state already in the browser. Lets the on-screen
 * preview render real template HTML instantly, with no round trip, as the user edits.
 */
export function buildPreviewTemplateData(
  profile: ApiProfile | undefined,
  content: ApiDocumentContent,
): Record<string, unknown> {
  if (!profile) {
    return {
      full_name: "",
      summary: content.customizedSummary,
      cover_letter_content: content.coverLetterContent ?? emptyRichDocument(),
    };
  }

  const skills = content.skillSuggestions.length > 0 ? content.skillSuggestions : profile.skills;
  const certifications =
    content.certificationSuggestions.length > 0
      ? content.certificationSuggestions
      : profile.certifications;

  const experienceContent = profile.experience.map((experience, index) => {
    const enhancement = content.experienceEnhancements.find(
      (item) => item.experienceIndex === index,
    );
    const description =
      enhancement?.description ??
      (experience.descriptionRichText ??
        (experience.description ? richDocumentFromText(experience.description) : undefined));

    return toItemContent(
      `${experience.title} · ${experience.company}`,
      formatPeriod(experience.startDate, experience.endDate),
      description,
    );
  });

  const educationContent = profile.education.map((education, index) => {
    const enhancement = content.educationEnhancements.find(
      (item) => item.educationIndex === index,
    );
    const description =
      enhancement?.description ??
      (education.descriptionRichText ??
        (education.description ? richDocumentFromText(education.description) : undefined));

    return toItemContent(
      education.institution,
      [[education.degree, education.field].filter(Boolean).join(", "), formatPeriod(education.startDate, education.endDate)]
        .filter(Boolean)
        .join(" · "),
      description,
    );
  });

  const projectContent = profile.projects.map((project, index) => {
    const enhancement = content.projectEnhancements.find((item) => item.projectIndex === index);
    const description =
      enhancement?.description ??
      mergeRichDocumentsAsProse(
        project.descriptionRichText ??
          (project.description ? richDocumentFromText(project.description) : undefined),
        ...project.achievements.map(richDocumentFromText),
      );

    return toItemContent(
      project.name,
      [project.url, ...project.skills].filter(Boolean).join(" · "),
      description,
    );
  });

  return {
    full_name: profile.fullName,
    profile_title: profile.headline ?? profile.profession ?? "",
    email: profile.email,
    location: profile.location ?? "",
    links: profile.links,
    summary: content.customizedSummary,
    experience_content: experienceContent,
    skills,
    education_content: educationContent,
    project_content: projectContent,
    certifications,
    cover_letter_content: content.coverLetterContent ?? emptyRichDocument(),
  };
}

function toItemContent(title: string, metadata: string, description?: RichDocument): RichDocument {
  return {
    version: 1,
    blocks: [
      {
        type: "heading",
        level: 3,
        children: [{ type: "text", text: title }],
      },
      ...(metadata
        ? [
            {
              type: "paragraph" as const,
              children: [
                { type: "text" as const, text: metadata, marks: [{ type: "italic" as const }] },
              ],
            },
          ]
        : []),
      ...(description?.blocks ?? []),
    ],
  };
}

function formatPeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return "";
  return `${startDate || "Start not set"} - ${endDate || "Present"}`;
}
