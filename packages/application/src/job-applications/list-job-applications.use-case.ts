import type {
  FileStorage,
  JobApplicationRepository,
  ListJobApplicationsFilter,
  UserProfileAccessRepository,
} from "@careerden/domain";
import { getAccessibleProfile } from "../profiles/profile-access.js";
import {
  addDocumentsToJobApplications,
  type JobApplicationWithDocuments,
} from "./job-application-read-model.js";

export interface PaginatedJobApplicationReadModels {
  items: JobApplicationWithDocuments[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

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
  ): Promise<PaginatedJobApplicationReadModels> {
    await getAccessibleProfile(this.profiles, profileId, userId);
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const result = await this.jobApplications.listByProfileId(profileId, {
      ...filter,
      page,
      pageSize,
    });

    return {
      items: await addDocumentsToJobApplications(this.jobApplications, this.storage, result.items),
      page,
      pageSize,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / pageSize),
    };
  }
}
