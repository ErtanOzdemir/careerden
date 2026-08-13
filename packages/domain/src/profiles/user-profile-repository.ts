import type {
  CreateUserProfileInput,
  UpdateUserProfileInput,
  UserProfile,
} from "./user-profile.js";

export interface UserProfileRepository {
  create(input: CreateUserProfileInput): Promise<UserProfile>;
  findById(id: string): Promise<UserProfile | null>;
  update(id: string, input: UpdateUserProfileInput): Promise<UserProfile | null>;
}

export interface UserProfileAccessRepository {
  findById(id: string): Promise<UserProfile | null>;
  findUserIdByProfileId(profileId: string): Promise<string | null>;
}

export interface UserProfileAccountRepository
  extends UserProfileRepository, UserProfileAccessRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  createForUserId(userId: string, input: CreateUserProfileInput): Promise<UserProfile>;
}
