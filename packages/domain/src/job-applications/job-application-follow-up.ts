export interface JobApplicationFollowUp {
  id: string;
  jobApplicationId: string;
  profileId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  reminderJobId?: string;
  reminderScheduledFor?: Date;
  reminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobApplicationFollowUpInput {
  jobApplicationId: string;
  profileId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
}

export interface UpdateJobApplicationFollowUpInput {
  title?: string;
  description?: string | null;
  scheduledAt?: Date;
}
