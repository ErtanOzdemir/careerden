import type {
  DocumentContent,
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  RichDocument,
  UserProfile,
} from "@careerden/domain";
import { profileProjectDescriptionAsProse, richDocumentFromText } from "@careerden/domain";

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
  const summary =
    content.selections?.customizedSummary === "original"
      ? (toRichDocument(profile.summary, profile.summaryRichText) ?? content.customizedSummary)
      : content.customizedSummary;
  const skills =
    content.selections?.skills === "original" || !content.skillSuggestions?.length
      ? profile.skills
      : content.skillSuggestions;
  const certifications =
    content.selections?.certifications === "original" || !content.certificationSuggestions?.length
      ? profile.certifications
      : content.certificationSuggestions;

  return {
    certifications,
    coverLetterContent: content.coverLetterContent ?? richDocumentFromText(""),
    education: resolveEducation(profile.education, content),
    experiences: resolveExperiences(profile.experience, content),
    projects: resolveProjects(profile.projects, content),
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
    const originalDescription = toRichDocument(item.description, item.descriptionRichText);
    const description =
      selection?.description === "original"
        ? originalDescription
        : (enhancement?.description ?? originalDescription);

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
