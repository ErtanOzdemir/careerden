import type {
  DocumentContent,
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  RichDocument,
  UserProfile,
} from "@link2cv/domain";
import {
  normalizeDescriptionOnlyDocumentContent,
  profileProjectDescriptionAsProse,
  richDocumentFromText,
} from "@link2cv/domain";

export interface ResolvedDocumentExperience {
  company: string;
  description?: RichDocument;
  endDate?: string;
  startDate?: string;
  title: string;
}

export interface ResolvedDocumentEducation {
  degree?: string;
  description?: RichDocument;
  endDate?: string;
  field?: string;
  institution: string;
  startDate?: string;
}

export interface ResolvedDocumentProject {
  description?: RichDocument;
  name: string;
  skills: string[];
  url?: string;
}

export interface ResolvedDocumentContent {
  certifications: string[];
  coverLetterContent: RichDocument;
  education: ResolvedDocumentEducation[];
  experiences: ResolvedDocumentExperience[];
  projects: ResolvedDocumentProject[];
  skills: string[];
  summary: RichDocument;
}

export function resolveDocumentContent(
  profile: UserProfile,
  content: DocumentContent,
): ResolvedDocumentContent {
  const normalizedContent = normalizeDescriptionOnlyDocumentContent(profile, content);
  const summary =
    normalizedContent.selections?.customizedSummary === "original"
      ? (toRichDocument(profile.summary, profile.summaryRichText) ??
        normalizedContent.customizedSummary)
      : normalizedContent.customizedSummary;
  const skills =
    normalizedContent.selections?.skills === "original" ||
    !normalizedContent.skillSuggestions?.length
      ? profile.skills
      : normalizedContent.skillSuggestions;
  const certifications =
    normalizedContent.selections?.certifications === "original" ||
    !normalizedContent.certificationSuggestions?.length
      ? profile.certifications
      : normalizedContent.certificationSuggestions;

  return {
    certifications,
    coverLetterContent: normalizedContent.coverLetterContent ?? richDocumentFromText(""),
    education: resolveEducation(profile.education, normalizedContent),
    experiences: resolveExperiences(profile.experience, normalizedContent),
    projects: resolveProjects(profile.projects, normalizedContent),
    skills,
    summary,
  };
}

function resolveExperiences(
  experiences: ProfileExperience[],
  content: DocumentContent,
): ResolvedDocumentExperience[] {
  return experiences.map((experience, index) => {
    const enhancement = content.experienceEnhancements.find(
      (item) => item.experienceIndex === index,
    );
    const selection = content.selections?.experience?.[String(index)];
    const originalDescription = toRichDocument(
      experience.description,
      experience.descriptionRichText,
    );
    const description =
      selection?.description === "original"
        ? originalDescription
        : (enhancement?.description ?? originalDescription);

    return {
      company: experience.company,
      endDate: experience.endDate,
      startDate: experience.startDate,
      title: experience.title,
      ...(description ? { description } : {}),
    };
  });
}

function resolveEducation(
  education: ProfileEducation[],
  content: DocumentContent,
): ResolvedDocumentEducation[] {
  return education.map((item, index) => {
    const enhancement = content.educationEnhancements?.find(
      (candidate) => candidate.educationIndex === index,
    );
    const selection = content.selections?.education?.[String(index)];
    const description =
      selection?.description === "original" ? undefined : enhancement?.description;

    return {
      degree: item.degree,
      endDate: item.endDate,
      field: item.field,
      institution: item.institution,
      startDate: item.startDate,
      ...(description ? { description } : {}),
    };
  });
}

function resolveProjects(
  projects: ProfileProject[],
  content: DocumentContent,
): ResolvedDocumentProject[] {
  return projects.map((project, index) => {
    const enhancement = content.projectEnhancements?.find((item) => item.projectIndex === index);
    const selection = content.selections?.projects?.[String(index)];
    const originalDescription = profileProjectDescriptionAsProse(project);
    const description =
      selection?.description === "original"
        ? originalDescription
        : (enhancement?.description ?? originalDescription);

    return {
      name: project.name,
      skills: project.skills,
      url: project.url,
      ...(description ? { description } : {}),
    };
  });
}

function toRichDocument(
  text: string | undefined,
  richText: RichDocument | undefined,
): RichDocument | undefined {
  return richText ?? (text ? richDocumentFromText(text) : undefined);
}
