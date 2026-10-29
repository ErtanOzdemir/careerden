import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import type { EmailSender, FollowUpReminderQueuePayload } from "@careerden/domain";
import {
  DeliverFollowUpReminderUseCase,
  createFollowUpReminderRecoveryRunner,
} from "@careerden/application";
import {
  BullMqFollowUpReminderQueue,
  followUpReminderQueueName,
} from "./infrastructure/queue/notifications/bullmq-follow-up-reminder.queue.js";
import {
  PostgresFollowUpReminderRepository,
  PostgresOutboxRepository,
  PostgresPersistenceUnitOfWork,
  RedisNotificationChangeBus,
  PostgresStorageOutboxDispatcher,
  S3CompatibleStorage,
  createPostgresDb,
  createResendEmailSender,
  createSmtpEmailSender,
} from "@careerden/infrastructure";
import { PostgresEmailOutboxDispatcher } from "./infrastructure/persistence/postgres-email-outbox.dispatcher.js";
import { PostgresReminderOutboxDispatcher } from "./infrastructure/persistence/postgres-reminder-outbox.dispatcher.js";
import type { Knex } from "knex";
import type { NotificationsWorkerEnv } from "./env.js";
import { toBullMqWorkerError } from "./bullmq-worker-error.js";

export interface NotificationsWorkerRuntime {
  db: Knex;
  worker: BullMqWorker<FollowUpReminderQueuePayload>;
  close: () => Promise<void>;
}

const recoveryIntervalMs = 60_000;

export async function createNotificationsWorkerRuntime(
  env: NotificationsWorkerEnv,
): Promise<NotificationsWorkerRuntime> {
  const db = createPostgresDb(env.DATABASE_URL);
  const reminders = new PostgresFollowUpReminderRepository(db);
  const notificationChangeBus = RedisNotificationChangeBus.create(env.REDIS_URL);
  const unitOfWork = new PostgresPersistenceUnitOfWork(db, undefined, notificationChangeBus);
  const deliverFollowUpReminder = new DeliverFollowUpReminderUseCase(reminders, unitOfWork);
  const storage = new S3CompatibleStorage({
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
    bucket: env.OBJECT_STORAGE_BUCKET,
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    region: env.OBJECT_STORAGE_REGION,
    secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  });
  const storageOutbox = new PostgresStorageOutboxDispatcher(
    new PostgresOutboxRepository(db),
    storage,
  );
  const reminderQueue = BullMqFollowUpReminderQueue.create(env.REDIS_URL);
  const reminderOutbox = new PostgresReminderOutboxDispatcher(
    new PostgresOutboxRepository(db),
    reminders,
    reminderQueue,
  );
  const emailOutbox = createEmailOutboxDispatcher(
    env.NOTIFICATION_EMAIL_ENABLED,
    new PostgresOutboxRepository(db),
    () =>
      env.NODE_ENV === "production"
        ? createResendEmailSender({
            apiKey: env.RESEND_API_KEY,
            from: env.EMAIL_FROM,
          })
        : createSmtpEmailSender({
            from: env.EMAIL_FROM,
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
          }),
  );
  const recoverFollowUpReminders = createFollowUpReminderRecoveryRunner(reminders, reminderQueue);

  await recoverFollowUpReminders();
  const recoveryInterval = setInterval(() => {
    void recoverFollowUpReminders().catch((error) => {
      console.error("Notifications worker failed follow-up reminder recovery", error);
    });
  }, recoveryIntervalMs);
  let isDispatchingStorageOutbox = false;
  const dispatchStorageOutbox = async () => {
    if (isDispatchingStorageOutbox) return;
    isDispatchingStorageOutbox = true;
    try {
      await Promise.all([
        storageOutbox.dispatchPending(),
        reminderOutbox.dispatchPending(),
        ...(emailOutbox ? [emailOutbox.dispatchPending()] : []),
      ]);
    } finally {
      isDispatchingStorageOutbox = false;
    }
  };
  await dispatchStorageOutbox();
  const storageOutboxInterval = setInterval(() => {
    void dispatchStorageOutbox().catch((error) => {
      console.error("Notifications worker failed storage cleanup outbox dispatch", error);
    });
  }, 1_000);

  const worker = new Worker<FollowUpReminderQueuePayload>(
    followUpReminderQueueName,
    async (job) => {
      try {
        await deliverFollowUpReminder.execute(job.data);
      } catch (error) {
        throw toBullMqWorkerError(error);
      }
    },
    {
      concurrency: env.NOTIFICATIONS_WORKER_CONCURRENCY,
      connection: { url: env.REDIS_URL },
    },
  );

  worker.on("failed", (job, error) => {
    console.error(
      `Notifications worker failed job ${job?.id ?? "unknown"} for application ${
        job?.data.jobApplicationId ?? "unknown"
      }`,
      error,
    );
  });

  return {
    db,
    worker,
    close: async () => {
      clearInterval(recoveryInterval);
      clearInterval(storageOutboxInterval);
      await worker.close();
      await reminderQueue.close();
      await notificationChangeBus.close();
      await db.destroy();
    },
  };
}

export function createEmailOutboxDispatcher(
  enabled: boolean,
  outbox: PostgresOutboxRepository,
  createEmailSender: () => EmailSender,
): PostgresEmailOutboxDispatcher | undefined {
  return enabled
    ? new PostgresEmailOutboxDispatcher(outbox, createEmailSender(), (failure) => {
        const context = {
          outboxEventId: failure.eventId,
          aggregateId: failure.aggregateId,
          attemptCount: failure.attemptCount,
          errorCode: failure.errorCode,
        };
        if (failure.outcome === "dead_lettered") {
          console.error("Notifications worker dead-lettered reminder email", context);
        } else {
          console.warn("Notifications worker scheduled reminder email retry", context);
        }
      })
    : undefined;
}
