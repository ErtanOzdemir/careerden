import type { Knex } from "knex";
import type { CreateUserProfileInput, UserProfile } from "@link2cv/domain";
import { randomUUID } from "node:crypto";
import { toUserProfile } from "../mappers.js";
import { KnexUserProfileRepository } from "./knex-user-profile.repository.js";

export class PostgresUserProfileRepository extends KnexUserProfileRepository {
  constructor(private readonly postgresDb: Knex) {
    super(postgresDb);
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const row = await this.postgresDb("user_profiles").where({ user_id: userId }).first();
    return row ? toUserProfile(row) : null;
  }

  async createForUserId(userId: string, input: CreateUserProfileInput): Promise<UserProfile> {
    const id = randomUUID();
    const [row] = await this.postgresDb("user_profiles")
      .insert({
        id,
        user_id: userId,
        full_name: input.fullName,
        email: input.email,
        auto_run_match_analysis: input.autoRunMatchAnalysis ?? true,
        follow_up_reminders_enabled: input.followUpRemindersEnabled ?? true,
        profession: input.profession ?? null,
        headline: input.headline ?? null,
        location: input.location ?? null,
        links: JSON.stringify(input.links ?? []),
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

  async findUserIdByProfileId(profileId: string): Promise<string | null> {
    const row = await this.postgresDb("user_profiles")
      .select("user_id")
      .where({ id: profileId })
      .first();

    return typeof row?.user_id === "string" ? row.user_id : null;
  }
}
