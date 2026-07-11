import type {
  JobApplicationContact,
  JobApplicationFollowUp,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleJobApplication } from "./job-application-access.js";

export async function getAccessibleContact(
  jobApplications: JobApplicationRepository,
  profiles: UserProfileAccessRepository,
  jobApplicationId: string,
  contactId: string,
  userId: string,
): Promise<JobApplicationContact> {
  await getAccessibleJobApplication(jobApplications, profiles, jobApplicationId, userId);
  const contact = await jobApplications.findContactById(contactId);
  if (!contact || contact.jobApplicationId !== jobApplicationId) {
    throw new ApplicationError("not_found", "Contact not found");
  }
  return contact;
}

export async function getAccessibleFollowUp(
  jobApplications: JobApplicationRepository,
  profiles: UserProfileAccessRepository,
  jobApplicationId: string,
  followUpId: string,
  userId: string,
): Promise<JobApplicationFollowUp> {
  await getAccessibleJobApplication(jobApplications, profiles, jobApplicationId, userId);
  const followUp = await jobApplications.findFollowUpById(followUpId);
  if (!followUp || followUp.jobApplicationId !== jobApplicationId) {
    throw new ApplicationError("not_found", "Follow-up not found");
  }
  return followUp;
}
