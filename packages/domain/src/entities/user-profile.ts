export interface ProfileExperience {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserProfileInput = Omit<UserProfile, "id" | "createdAt" | "updatedAt">;
