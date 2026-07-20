import type { JobApplicationRepository } from "../job-applications/job-application-repository.js";
import type { JobApplicationChangeRecorder } from "../job-applications/job-application-change.js";
import type { FollowUpReminderRepository } from "../notifications/follow-up-reminder.js";
import type { NotificationChangeRecorder } from "../notifications/notification-change.js";
import type { NotificationRepository } from "../notifications/notification-repository.js";
import type { UserProfileAccountRepository } from "../profiles/user-profile-repository.js";
import type { OutboxRepository } from "./outbox.js";

export interface PersistenceTransaction {
  jobApplications: JobApplicationRepository;
  jobApplicationChanges: JobApplicationChangeRecorder;
  profiles: UserProfileAccountRepository;
  notifications: NotificationRepository;
  notificationChanges: NotificationChangeRecorder;
  followUpReminders: FollowUpReminderRepository;
  outbox: OutboxRepository;
}

export interface PersistenceUnitOfWork {
  execute<T>(work: (transaction: PersistenceTransaction) => Promise<T>): Promise<T>;
}
