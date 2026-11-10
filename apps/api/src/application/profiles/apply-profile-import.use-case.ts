import {
  normalizeUpdateUserProfileInput,
  type UserProfile,
  type UserProfileAccountRepository,
} from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import {
  mergeProfileImport,
  type ProfileImportDraft,
} from "../../domain/profiles/profile-import.js";
import { getAccessibleProfile } from "./profile-access.js";

/** Saves the sections of a reviewed CV import the user kept, without overwriting existing data. */
export class ApplyProfileImportUseCase {
  constructor(private readonly profiles: UserProfileAccountRepository) {}

  async execute(id: string, userId: string, draft: ProfileImportDraft): Promise<UserProfile> {
    const current = await getAccessibleProfile(this.profiles, id, userId);
    const update = mergeProfileImport(current, draft);
    if (Object.keys(update).length === 0) return current;

    const profile = await this.profiles.update(id, normalizeUpdateUserProfileInput(update));
    if (!profile) {
      throw new ApplicationError("not_found", "Profile not found");
    }

    return profile;
  }
}
