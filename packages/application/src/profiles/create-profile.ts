import type { CreateUserProfileInput, UserProfile, UserProfileRepository } from "@link2cv/domain";

export class CreateProfileUseCase {
  constructor(private readonly profiles: UserProfileRepository) {}

  execute(input: CreateUserProfileInput): Promise<UserProfile> {
    return this.profiles.create(input);
  }
}
