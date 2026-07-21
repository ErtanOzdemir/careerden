import type { DocumentTemplate, UserProfileAccountRepository } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleProfile } from "./profile-access.js";

export async function getAccessibleDocumentTemplate(
  profiles: UserProfileAccountRepository,
  profileId: string,
  templateId: string,
  userId: string,
): Promise<DocumentTemplate> {
  await getAccessibleProfile(profiles, profileId, userId);
  const template = await profiles.findDocumentTemplateById(templateId);

  if (!template || template.profileId !== profileId) {
    throw new ApplicationError("not_found", "Document template not found");
  }

  return template;
}
