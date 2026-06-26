import type {
  CreateJobApplicationInput,
  JobApplication,
  JobApplicationRepository,
  UserProfileRepository,
} from "@link2cv/domain";

export class SubmitJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
  ) {}

  async execute(input: CreateJobApplicationInput): Promise<JobApplication> {
    const profile = await this.profiles.findById(input.profileId);

    if (!profile) {
      throw new Error(`Profile ${input.profileId} was not found`);
    }

    const jobApplication = await this.jobApplications.create(input);

    return jobApplication;
  }
}
