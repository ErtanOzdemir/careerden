import type { CreateUserProfileInput, UserProfile, UserProfileRepository } from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class InMemoryUserProfileRepository implements UserProfileRepository {
  private readonly profiles = new Map<string, UserProfile>();

  async create(input: CreateUserProfileInput): Promise<UserProfile> {
    const now = new Date();
    const profile: UserProfile = {
      id: randomUUID(),
      ...input,
      education: input.education ?? [],
      certifications: input.certifications ?? [],
      projects: input.projects ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  async findById(id: string): Promise<UserProfile | null> {
    return this.profiles.get(id) ?? null;
  }
}
