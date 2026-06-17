import type { Knex } from "knex";
import type {
  CreateUserProfileInput,
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  UserProfile,
  UserProfileRepository,
} from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class PostgresUserProfileRepository implements UserProfileRepository {
  constructor(private readonly db: Knex) {}

  async create(input: CreateUserProfileInput): Promise<UserProfile> {
    const id = randomUUID();
    const [row] = await this.db("user_profiles")
      .insert({
        id,
        full_name: input.fullName,
        email: input.email,
        headline: input.headline ?? null,
        location: input.location ?? null,
        summary: input.summary ?? null,
        skills: JSON.stringify(input.skills),
        experience: JSON.stringify(input.experience),
        education: JSON.stringify(input.education ?? []),
        certifications: JSON.stringify(input.certifications ?? []),
        projects: JSON.stringify(input.projects ?? []),
      })
      .returning("*");

    return toUserProfile(row);
  }

  async findById(id: string): Promise<UserProfile | null> {
    const row = await this.db("user_profiles").where({ id }).first();
    return row ? toUserProfile(row) : null;
  }
}

function toUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    headline: nullableString(row.headline),
    location: nullableString(row.location),
    summary: nullableString(row.summary),
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    experience: Array.isArray(row.experience) ? (row.experience as ProfileExperience[]) : [],
    education: Array.isArray(row.education) ? (row.education as ProfileEducation[]) : [],
    certifications: Array.isArray(row.certifications) ? row.certifications.map(String) : [],
    projects: Array.isArray(row.projects) ? (row.projects as ProfileProject[]) : [],
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function nullableString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
