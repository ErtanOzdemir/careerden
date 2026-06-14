import type {
  CreateJobApplicationInput,
  JobApplication,
  JobApplicationQueue,
  JobApplicationRepository,
  UserProfileRepository
} from "@link2cv/domain";

export class SubmitJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly queue: JobApplicationQueue
  ) {}

  async execute(input: CreateJobApplicationInput): Promise<JobApplication> {
    const profile = await this.profiles.findById(input.profileId);

    if (!profile) {
      throw new Error(`Profile ${input.profileId} was not found`);
    }

    const jobApplication = await this.jobApplications.create(input);

    try {
      await this.queue.enqueue({ jobApplicationId: jobApplication.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to enqueue job application";
      await this.jobApplications.updateStatus(jobApplication.id, "failed", message);
      throw error;
    }

    return jobApplication;
  }
}
