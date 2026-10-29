export const followUpReminderLeadTimeMs = 10 * 60 * 1000;

export function getFollowUpReminderScheduledFor(followUpAt: Date): Date {
  return new Date(followUpAt.getTime() - followUpReminderLeadTimeMs);
}

export interface FollowUpReminderQueuePayload {
  followUpId: string;
  jobApplicationId: string;
  profileId: string;
  followUpAt: string;
  scheduledFor: string;
}

export interface ScheduleFollowUpReminderInput {
  followUpId: string;
  jobApplicationId: string;
  profileId: string;
  followUpAt: Date;
  scheduledFor: Date;
}

export interface ScheduledFollowUpReminder {
  jobId: string;
}

export interface FollowUpReminderQueue {
  enqueue(input: ScheduleFollowUpReminderInput): Promise<ScheduledFollowUpReminder>;
  remove(jobId: string): Promise<void>;
  close(): Promise<void>;
}

export interface FollowUpReminderCandidate {
  followUpId: string;
  jobApplicationId: string;
  profileId: string;
  profileEmail: string;
  companyName?: string;
  roleTitle?: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  reminderJobId?: string;
  reminderScheduledFor?: Date;
  reminderSentAt?: Date;
}

export interface UpdateFollowUpReminderScheduleInput {
  jobId: string;
  scheduledFor: Date;
}

export interface FollowUpReminderRepository {
  setSchedule(followUpId: string, input: UpdateFollowUpReminderScheduleInput): Promise<void>;
  clearSchedule(followUpId: string): Promise<void>;
  findValidReminder(input: FollowUpReminderQueuePayload): Promise<FollowUpReminderCandidate | null>;
  listPendingForRecovery(now: Date, limit?: number): Promise<FollowUpReminderCandidate[]>;
  markSent(input: FollowUpReminderQueuePayload, sentAt: Date): Promise<boolean>;
  isPendingScheduleCurrent(input: FollowUpReminderQueuePayload): Promise<boolean>;
}
