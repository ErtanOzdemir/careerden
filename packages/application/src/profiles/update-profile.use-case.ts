import {
  normalizeUpdateUserProfileInput,
  type UpdateUserProfileInput,
  type UserProfile,
  type UserProfileAccountRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleProfile } from "./profile-access.js";

export class UpdateProfileUseCase {
  constructor(private readonly profiles: UserProfileAccountRepository) {}

  async execute(id: string, userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    await getAccessibleProfile(this.profiles, id, userId);
    const profile = await this.profiles.update(id, normalizeUpdateUserProfileInput(input));

    if (!profile) {
      throw new ApplicationError("not_found", "Profile not found");
    }

    return profile;
  }
}
