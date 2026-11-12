import type {
  DocumentContent,
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  ProfileSkillGroup,
  RichDocument,
  UserProfile,
} from "@careerden/domain";
import {
  groupSkillsBySkillGroups,
  profileProjectDescriptionAsProse,
  profileSkills,
  richDocumentFromText,
} from "@careerden/domain";

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
  /** The document's skills grouped by the profile's categories, for the CV's skills section. */
  skillGroups: ProfileSkillGroup[];
  skills: string[];
  summary: RichDocument;
}

export function resolveDocumentContent(
  profile: UserProfile,
  content: DocumentContent,
): ResolvedDocumentContent {
  const skills = content.skillSuggestions?.length
    ? content.skillSuggestions
    : profileSkills(profile.skillGroups);

  return {
    certifications: content.certificationSuggestions?.length
      ? content.certificationSuggestions
      : profile.certifications,
    coverLetterContent: content.coverLetterContent ?? richDocumentFromText(""),
    education: resolveEducation(profile.education, content),
    experiences: resolveExperiences(profile.experience, content),
    projects: resolveProjects(profile.projects, content),
    skillGroups: groupSkillsBySkillGroups(skills, profile.skillGroups),
    skills,
    summary: content.customizedSummary,
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
    const description =
      enhancement?.description ??
      toRichDocument(experience.description, experience.descriptionRichText);

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
    const description =
      enhancement?.description ?? toRichDocument(item.description, item.descriptionRichText);

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
    const description = enhancement?.description ?? profileProjectDescriptionAsProse(project);

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
