import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import type {
  FollowUpReminderQueue,
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
} from "@link2cv/domain";
import {
  BullMqFollowUpReminderQueue,
  PostgresFollowUpReminderRepository,
  PostgresNotificationRepository,
  createPostgresDb,
  createSmtpNotificationEmailSender,
  followUpReminderQueueName,
  getFollowUpReminderScheduledFor,
} from "@link2cv/infrastructure";
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
  const notifications = new PostgresNotificationRepository(db);
  const reminderQueue = BullMqFollowUpReminderQueue.create(env.REDIS_URL);
  const _emailSender = createSmtpNotificationEmailSender({
    from: env.SMTP_FROM,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
  });
  const recoverFollowUpReminders = createFollowUpReminderRecoveryRunner(reminders, reminderQueue);

  await recoverFollowUpReminders();
  const recoveryInterval = setInterval(() => {
    void recoverFollowUpReminders().catch((error) => {
      console.error("Notifications worker failed follow-up reminder recovery", error);
    });
  }, recoveryIntervalMs);

  const worker = new Worker<FollowUpReminderQueuePayload>(
    followUpReminderQueueName,
    async (job) => {
      try {
        const reminder = await reminders.findValidReminder(job.data);

        if (!reminder) {
          return;
        }

        const title = reminder.title;
        const body = createFollowUpBody(
          reminder.companyName,
          reminder.roleTitle,
          reminder.description,
        );

        await notifications.create({
          profileId: reminder.profileId,
          jobApplicationId: reminder.jobApplicationId,
          type: "follow_up_reminder",
          title,
          body,
        });
        // TODO: Open it when email sender is ready
        // await _emailSender.sendFollowUpReminder({
        //   email: reminder.profileEmail,
        //   companyName: reminder.companyName,
        //   roleTitle: reminder.roleTitle,
        //   followUpAt: reminder.scheduledAt,
        //   title: reminder.title,
        //   description: reminder.description,
        // });
        await reminders.markSent(job.data, new Date());
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
      await worker.close();
      await reminderQueue.close();
      await db.destroy();
    },
  };
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

function createFollowUpBody(companyName?: string, roleTitle?: string, description?: string) {
  const target = [companyName, roleTitle].filter(Boolean).join(" - ");
  const context = target ? `It is time to follow up on ${target}.` : "It is time to follow up.";
  return description ? `${context}\n\n${description}` : context;
}
