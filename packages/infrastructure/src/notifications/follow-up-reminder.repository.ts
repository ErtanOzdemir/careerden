import type { Knex } from "knex";
import type {
  FollowUpReminderCandidate,
  FollowUpReminderQueuePayload,
  FollowUpReminderRepository,
  UpdateFollowUpReminderScheduleInput,
} from "@link2cv/domain";
import { followUpReminderLeadTimeMs } from "@link2cv/domain";
import { nullableDate, nullableString } from "../persistence/mappers.js";

export const followUpReminderRecoveryBatchLimit = 100;

export class PostgresFollowUpReminderRepository implements FollowUpReminderRepository {
  constructor(private readonly db: Knex) {}

  async setSchedule(followUpId: string, input: UpdateFollowUpReminderScheduleInput): Promise<void> {
    await this.db("job_application_follow_ups").where({ id: followUpId }).update({
      reminder_job_id: input.jobId,
      reminder_scheduled_for: input.scheduledFor,
      reminder_sent_at: null,
      updated_at: this.db.fn.now(),
    });
  }

  async clearSchedule(followUpId: string): Promise<void> {
    await this.db("job_application_follow_ups").where({ id: followUpId }).update({
      reminder_job_id: null,
      reminder_scheduled_for: null,
      reminder_sent_at: null,
      updated_at: this.db.fn.now(),
    });
  }

  async findValidReminder(
    input: FollowUpReminderQueuePayload,
  ): Promise<FollowUpReminderCandidate | null> {
    const row = await this.baseQuery()
      .where("job_application_follow_ups.id", input.followUpId)
      .where("job_application_follow_ups.job_application_id", input.jobApplicationId)
      .where("job_application_follow_ups.profile_id", input.profileId)
      .where("user_profiles.follow_up_reminders_enabled", true)
      .first();

    const candidate = row ? toFollowUpReminderCandidate(row) : null;

    if (!candidate || candidate.reminderSentAt) {
      return null;
    }

    if (
      candidate.scheduledAt.toISOString() !== new Date(input.followUpAt).toISOString() ||
      candidate.reminderScheduledFor?.toISOString() !== new Date(input.scheduledFor).toISOString()
    ) {
      return null;
    }

    return candidate;
  }

  async listPendingForRecovery(
    now: Date,
    limit = followUpReminderRecoveryBatchLimit,
  ): Promise<FollowUpReminderCandidate[]> {
    const rows = await this.baseQuery()
      .whereNull("job_application_follow_ups.reminder_sent_at")
      .where("user_profiles.follow_up_reminders_enabled", true)
      .where("job_application_follow_ups.scheduled_at", ">=", now)
      .where((query) => {
        query
          .whereNull("job_application_follow_ups.reminder_job_id")
          .orWhereNull("job_application_follow_ups.reminder_scheduled_for")
          .orWhereRaw(
            "job_application_follow_ups.reminder_scheduled_for <> job_application_follow_ups.scheduled_at - (? * interval '1 millisecond')",
            [followUpReminderLeadTimeMs],
          );
      })
      .orderBy("job_application_follow_ups.scheduled_at", "asc")
      .limit(limit);

    return rows.map(toFollowUpReminderCandidate);
  }

  async markSent(input: FollowUpReminderQueuePayload, sentAt: Date): Promise<boolean> {
    const updated = await this.db("job_application_follow_ups")
      .where({ id: input.followUpId })
      .whereNull("reminder_sent_at")
      .where("scheduled_at", new Date(input.followUpAt))
      .where("reminder_scheduled_for", new Date(input.scheduledFor))
      .update({
        reminder_sent_at: sentAt,
        updated_at: this.db.fn.now(),
      });

    return updated > 0;
  }

  async isPendingScheduleCurrent(input: FollowUpReminderQueuePayload): Promise<boolean> {
    const row = await this.db("job_application_follow_ups")
      .where({
        id: input.followUpId,
        job_application_id: input.jobApplicationId,
        profile_id: input.profileId,
        scheduled_at: new Date(input.followUpAt),
      })
      .whereNull("reminder_sent_at")
      .first();
    return Boolean(row);
  }

  private baseQuery() {
    return this.db("job_application_follow_ups")
      .join("user_profiles", "user_profiles.id", "job_application_follow_ups.profile_id")
      .join(
        "job_applications",
        "job_applications.id",
        "job_application_follow_ups.job_application_id",
      )
      .select(
        "job_application_follow_ups.id as follow_up_id",
        "job_application_follow_ups.job_application_id",
        "job_application_follow_ups.profile_id",
        "user_profiles.email as profile_email",
        "user_profiles.follow_up_reminders_enabled",
        "job_applications.company_name",
        "job_applications.role_title",
        "job_application_follow_ups.title",
        "job_application_follow_ups.description",
        "job_application_follow_ups.scheduled_at",
        "job_application_follow_ups.reminder_job_id",
        "job_application_follow_ups.reminder_scheduled_for",
        "job_application_follow_ups.reminder_sent_at",
      );
  }
}

export function getFollowUpReminderScheduledFor(followUpAt: Date): Date {
  return new Date(followUpAt.getTime() - followUpReminderLeadTimeMs);
}

export function shouldRecoverFollowUpReminder(
  candidate: Pick<
    FollowUpReminderCandidate,
    "reminderJobId" | "reminderScheduledFor" | "reminderSentAt" | "scheduledAt"
  >,
  now: Date,
): boolean {
  if (candidate.reminderSentAt || candidate.scheduledAt < now) {
    return false;
  }

  if (!candidate.reminderJobId || !candidate.reminderScheduledFor) {
    return true;
  }

  return (
    candidate.reminderScheduledFor.getTime() !==
    getFollowUpReminderScheduledFor(candidate.scheduledAt).getTime()
  );
}

function toFollowUpReminderCandidate(row: Record<string, unknown>): FollowUpReminderCandidate {
  return {
    followUpId: String(row.follow_up_id),
    jobApplicationId: String(row.job_application_id),
    profileId: String(row.profile_id),
    profileEmail: String(row.profile_email),
    companyName: nullableString(row.company_name),
    roleTitle: nullableString(row.role_title),
    title: String(row.title),
    description: nullableString(row.description),
    scheduledAt: new Date(String(row.scheduled_at)),
    reminderJobId: nullableString(row.reminder_job_id),
    reminderScheduledFor: nullableDate(row.reminder_scheduled_for),
    reminderSentAt: nullableDate(row.reminder_sent_at),
  };
}
