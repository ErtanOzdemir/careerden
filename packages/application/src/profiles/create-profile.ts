import type {
  CreateUserProfileInput,
  UpdateUserProfileInput,
  UserProfile,
  UserProfileRepository,
} from "@link2cv/domain";

export class CreateProfileUseCase {
  constructor(private readonly profiles: UserProfileRepository) {}

  execute(input: CreateUserProfileInput): Promise<UserProfile> {
    return this.profiles.create(input);
  }
}

export class UpdateProfileUseCase {
  constructor(private readonly profiles: UserProfileRepository) {}

  execute(id: string, input: UpdateUserProfileInput): Promise<UserProfile | null> {
    return this.profiles.update(id, input);
  }
}
