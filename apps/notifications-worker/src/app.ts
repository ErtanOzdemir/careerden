import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import type {
  EmailSender,
  FollowUpReminderQueue,
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
} from "@careerden/domain";
import { DeliverFollowUpReminderUseCase } from "@careerden/application";
import {
  BullMqFollowUpReminderQueue,
  PostgresFollowUpReminderRepository,
  PostgresEmailOutboxDispatcher,
  PostgresOutboxRepository,
  PostgresPersistenceUnitOfWork,
  RedisNotificationChangeBus,
  PostgresReminderOutboxDispatcher,
  PostgresStorageOutboxDispatcher,
  RustFsStorage,
  createPostgresDb,
  createSmtpEmailSender,
  followUpReminderQueueName,
  getFollowUpReminderScheduledFor,
} from "@careerden/infrastructure";
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
  const storage = new RustFsStorage({
    accessKeyId: env.RUSTFS_ACCESS_KEY_ID,
    bucket: env.RUSTFS_BUCKET,
    endpoint: env.RUSTFS_ENDPOINT,
    forcePathStyle: env.RUSTFS_FORCE_PATH_STYLE,
    region: env.RUSTFS_REGION,
    secretAccessKey: env.RUSTFS_SECRET_ACCESS_KEY,
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
  const emailSender = createSmtpEmailSender({
    from: env.SMTP_FROM,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
  });
  const emailOutbox = createEmailOutboxDispatcher(
    env.NOTIFICATION_EMAIL_ENABLED,
    new PostgresOutboxRepository(db),
    emailSender,
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
  emailSender: EmailSender,
): PostgresEmailOutboxDispatcher | undefined {
  return enabled ? new PostgresEmailOutboxDispatcher(outbox, emailSender) : undefined;
}

export function createFollowUpReminderRecoveryRunner(
  reminders: FollowUpReminderRepository,
  reminderQueue: FollowUpReminderQueue,
  now: () => Date = () => new Date(),
) {
  let isRecovering = false;

  return async function recoverFollowUpReminders(): Promise<void> {
    if (isRecovering) {
      console.warn("Notifications worker skipped follow-up reminder recovery; already running");
      return;
    }

    isRecovering = true;
    try {
      await recoverPendingReminders(reminders, reminderQueue, now());
    } finally {
      isRecovering = false;
    }
  };
}

async function recoverPendingReminders(
  reminders: FollowUpReminderRepository,
  reminderQueue: FollowUpReminderQueue,
  now: Date,
) {
  const pending = await reminders.listPendingForRecovery(now);

  for (const reminder of pending) {
    const scheduledFor = getFollowUpReminderScheduledFor(reminder.scheduledAt);

    if (reminder.reminderJobId) {
      await reminderQueue.remove(reminder.reminderJobId).catch(() => {
        // The existing job may already be active or gone; re-adding below rebuilds delayed state.
      });
    }

    const scheduled = await reminderQueue.enqueue({
      followUpId: reminder.followUpId,
      jobApplicationId: reminder.jobApplicationId,
      profileId: reminder.profileId,
      followUpAt: reminder.scheduledAt,
      scheduledFor,
    });

    await reminders.setSchedule(reminder.followUpId, {
      jobId: scheduled.jobId,
      scheduledFor,
    });
  }
}
