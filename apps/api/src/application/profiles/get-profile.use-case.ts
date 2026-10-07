import type { UserProfile, UserProfileAccountRepository } from "@careerden/domain";
import { getAccessibleProfile } from "./profile-access.js";

export class GetProfileUseCase {
  constructor(private readonly profiles: UserProfileAccountRepository) {}

  execute(profileId: string, userId: string): Promise<UserProfile> {
    return getAccessibleProfile(this.profiles, profileId, userId);
  }
}
