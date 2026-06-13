import type { Pool } from "pg";
import type {
  CreateUserProfileInput,
  ProfileExperience,
  UserProfile,
  UserProfileRepository
} from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class PostgresUserProfileRepository implements UserProfileRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateUserProfileInput): Promise<UserProfile> {
    const id = randomUUID();
    const result = await this.pool.query(
      `
        insert into user_profiles (
          id, full_name, email, headline, location, summary, skills, experience
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
      `,
      [
        id,
        input.fullName,
        input.email,
        input.headline ?? null,
        input.location ?? null,
        input.summary ?? null,
        JSON.stringify(input.skills),
        JSON.stringify(input.experience)
      ]
    );

    return toUserProfile(result.rows[0]);
  }

  async findById(id: string): Promise<UserProfile | null> {
    const result = await this.pool.query("select * from user_profiles where id = $1", [id]);
    return result.rows[0] ? toUserProfile(result.rows[0]) : null;
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
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at))
  };
}

function nullableString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
