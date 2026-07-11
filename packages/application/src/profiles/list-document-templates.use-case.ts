import type { DocumentTemplate, UserProfileAccountRepository } from "@link2cv/domain";
import { getAccessibleProfile } from "./profile-access.js";

export class ListDocumentTemplatesUseCase {
  constructor(private readonly profiles: UserProfileAccountRepository) {}

  async execute(profileId: string, userId: string): Promise<DocumentTemplate[]> {
    await getAccessibleProfile(this.profiles, profileId, userId);
    return this.profiles.listDocumentTemplates(profileId);
  }
}
