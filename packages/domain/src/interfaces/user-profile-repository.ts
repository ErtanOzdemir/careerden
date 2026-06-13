import type { CreateUserProfileInput, UserProfile } from "../entities/user-profile.js";

export interface UserProfileRepository {
  create(input: CreateUserProfileInput): Promise<UserProfile>;
  findById(id: string): Promise<UserProfile | null>;
}
