import type {
  FileStorage,
  JobApplicationRepository,
  ListJobApplicationsFilter,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleProfile } from "../profiles/profile-access.js";
import {
  addDocumentsToJobApplications,
  type JobApplicationWithDocuments,
} from "./job-application-read-model.js";

export class ListJobApplicationsUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(
    profileId: string,
    userId: string,
    filter: ListJobApplicationsFilter = {},
  ): Promise<JobApplicationWithDocuments[]> {
    await getAccessibleProfile(this.profiles, profileId, userId);
    const jobs = await this.jobApplications.listByProfileId(profileId, filter);
    return addDocumentsToJobApplications(this.jobApplications, this.storage, jobs);
  }
}
