import type { UserProfile, UserProfileAccountRepository } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";

export interface AuthenticatedProfileUser {
  id: string;
  email: string;
  name: string;
}

export async function getAccessibleProfile(
  profiles: UserProfileAccountRepository,
  profileId: string,
  userId: string,
): Promise<UserProfile> {
  const ownerId = await profiles.findUserIdByProfileId(profileId);

  if (ownerId !== userId) {
    throw new ApplicationError("not_found", "Profile not found");
  }

  const profile = await profiles.findById(profileId);

  if (!profile) {
    throw new ApplicationError("not_found", "Profile not found");
  }

  return profile;
}
