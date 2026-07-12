export const outboxEventTypes = {
  jobApplicationAnalysisRequested: "job-application.analysis-requested",
  storageDelete: "storage.delete",
  followUpReminderSchedule: "follow-up-reminder.schedule",
  followUpReminderCancel: "follow-up-reminder.cancel",
  followUpReminderEmail: "follow-up-reminder.email",
} as const;

export interface AddOutboxEventInput {
  type: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
}

export interface OutboxEvent extends AddOutboxEventInput {
  id: string;
  attemptCount: number;
}

export interface OutboxRepository {
  add(input: AddOutboxEventInput): Promise<OutboxEvent>;
}
