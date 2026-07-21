import {
  normalizeCreateUserProfileInput,
  type CreateUserProfileInput,
  type UserProfile,
  type UserProfileRepository,
} from "@careerden/domain";

export class CreateProfileUseCase {
  constructor(private readonly profiles: UserProfileRepository) {}

  execute(input: CreateUserProfileInput): Promise<UserProfile> {
    return this.profiles.create(normalizeCreateUserProfileInput(input));
  }
}
