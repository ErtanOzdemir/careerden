import type {
  JobApplicationContact,
  JobApplicationFollowUp,
  JobApplication,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { getActiveAccessibleJobApplication } from "@careerden/application";

export async function getAccessibleContact(
  jobApplications: JobApplicationRepository,
  profiles: UserProfileAccessRepository,
  jobApplicationId: string,
  contactId: string,
  userId: string,
): Promise<{ contact: JobApplicationContact; jobApplication: JobApplication }> {
  const jobApplication = await getActiveAccessibleJobApplication(
    jobApplications,
    profiles,
    jobApplicationId,
    userId,
  );
  const contact = await jobApplications.findContactById(contactId);
  if (!contact || contact.jobApplicationId !== jobApplicationId) {
    throw new ApplicationError("not_found", "Contact not found");
  }
  return { contact, jobApplication };
}

export async function getAccessibleFollowUp(
  jobApplications: JobApplicationRepository,
  profiles: UserProfileAccessRepository,
  jobApplicationId: string,
  followUpId: string,
  userId: string,
): Promise<{ followUp: JobApplicationFollowUp; jobApplication: JobApplication }> {
  const jobApplication = await getActiveAccessibleJobApplication(
    jobApplications,
    profiles,
    jobApplicationId,
    userId,
  );
  const followUp = await jobApplications.findFollowUpById(followUpId);
  if (!followUp || followUp.jobApplicationId !== jobApplicationId) {
    throw new ApplicationError("not_found", "Follow-up not found");
  }
  return { followUp, jobApplication };
}
