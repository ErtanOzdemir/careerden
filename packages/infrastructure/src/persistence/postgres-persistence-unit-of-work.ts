import type { Knex } from "knex";
import type {
  JobApplicationChange,
  JobApplicationChangePublisher,
  JobApplicationChangeRecorder,
  Notification,
  NotificationChange,
  NotificationChangePublisher,
  NotificationChangeRecorder,
  PersistenceTransaction,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { PostgresFollowUpReminderRepository } from "../notifications/follow-up-reminder.repository.js";
import { PostgresCreditRepository } from "./billing/postgres-credit.repository.js";
import { PostgresBillingSubscriptionRepository } from "./billing/postgres-billing-subscription.repository.js";
import { PostgresJobApplicationRepository } from "./job-applications/postgres-job-application.repository.js";
import { PostgresNotificationRepository } from "./notifications/postgres-notification.repository.js";
import { PostgresOutboxRepository } from "./postgres-outbox.repository.js";
import { PostgresUserProfileRepository } from "./profiles/postgres-user-profile.repository.js";

export class PostgresPersistenceUnitOfWork implements PersistenceUnitOfWork {
  constructor(
    private readonly db: Knex,
    private readonly jobApplicationChangePublisher?: JobApplicationChangePublisher,
    private readonly notificationChangePublisher?: NotificationChangePublisher,
  ) {}

  async execute<T>(work: (transaction: PersistenceTransaction) => Promise<T>): Promise<T> {
    const changes = new BufferedJobApplicationChangeRecorder();
    const notificationChanges = new BufferedNotificationChangeRecorder();
    const result = await this.db.transaction((transaction) =>
      work({
        billingSubscriptions: new PostgresBillingSubscriptionRepository(transaction),
        credits: new PostgresCreditRepository(transaction),
        jobApplications: new PostgresJobApplicationRepository(transaction),
        jobApplicationChanges: changes,
        profiles: new PostgresUserProfileRepository(transaction),
        notifications: new PostgresNotificationRepository(transaction),
        notificationChanges,
        followUpReminders: new PostgresFollowUpReminderRepository(transaction),
        outbox: new PostgresOutboxRepository(transaction),
      }),
    );

    await Promise.all([
      changes.publishBestEffort(this.jobApplicationChangePublisher),
      notificationChanges.publishBestEffort(this.notificationChangePublisher),
    ]);
    return result;
  }
}

class BufferedNotificationChangeRecorder implements NotificationChangeRecorder {
  private readonly changes = new Map<string, NotificationChange>();

  async created(notification: Notification, summary: string): Promise<void> {
    this.changes.set(notification.id, {
      type: "notification.created",
      notification,
      summary,
    });
  }

  async publishBestEffort(publisher?: NotificationChangePublisher): Promise<void> {
    if (!publisher) return;

    const results = await Promise.allSettled(
      [...this.changes.values()].map((change) => publisher.publish(change)),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Failed to publish notification realtime change", result.reason);
      }
    }
  }
}

class BufferedJobApplicationChangeRecorder implements JobApplicationChangeRecorder {
  private readonly changes = new Map<string, JobApplicationChange>();

  async changed(applicationId: string, profileId: string): Promise<void> {
    this.record("application.changed", applicationId, profileId);
  }

  async deleted(applicationId: string, profileId: string): Promise<void> {
    this.record("application.deleted", applicationId, profileId);
  }

  async publishBestEffort(publisher?: JobApplicationChangePublisher): Promise<void> {
    if (!publisher) return;

    const results = await Promise.allSettled(
      [...this.changes.values()].map((change) => publisher.publish(change)),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Failed to publish job application realtime change", result.reason);
      }
    }
  }

  private record(
    type: JobApplicationChange["type"],
    applicationId: string,
    profileId: string,
  ): void {
    this.changes.set(`${type}:${applicationId}`, {
      type,
      applicationId,
      profileId,
      occurredAt: new Date().toISOString(),
    });
  }
}
