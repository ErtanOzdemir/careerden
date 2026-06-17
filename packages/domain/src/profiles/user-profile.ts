export interface ProfileExperience {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  skills?: string[];
  achievements: string[];
}

export interface ProfileEducation {
  institution: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  achievements: string[];
}

export interface ProfileProject {
  name: string;
  description?: string;
  url?: string;
  skills: string[];
  achievements: string[];
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  headline?: string;
  location?: string;
  summary?: string;
  skills: string[];
  experience: ProfileExperience[];
  education: ProfileEducation[];
  certifications: string[];
  projects: ProfileProject[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserProfileInput = Omit<
  UserProfile,
  "id" | "createdAt" | "updatedAt" | "education" | "certifications" | "projects"
> &
  Partial<Pick<UserProfile, "education" | "certifications" | "projects">>;
