import type { Knex } from "knex";
import type { PersistenceTransaction, PersistenceUnitOfWork } from "@link2cv/domain";
import { PostgresFollowUpReminderRepository } from "../notifications/follow-up-reminder.repository.js";
import { PostgresJobApplicationRepository } from "./job-applications/postgres-job-application.repository.js";
import { PostgresNotificationRepository } from "./notifications/postgres-notification.repository.js";
import { PostgresOutboxRepository } from "./postgres-outbox.repository.js";
import { PostgresUserProfileRepository } from "./profiles/postgres-user-profile.repository.js";

export class PostgresPersistenceUnitOfWork implements PersistenceUnitOfWork {
  constructor(private readonly db: Knex) {}

  execute<T>(work: (transaction: PersistenceTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction((transaction) =>
      work({
        jobApplications: new PostgresJobApplicationRepository(transaction),
        profiles: new PostgresUserProfileRepository(transaction),
        notifications: new PostgresNotificationRepository(transaction),
        followUpReminders: new PostgresFollowUpReminderRepository(transaction),
        outbox: new PostgresOutboxRepository(transaction),
      }),
    );
  }
}
