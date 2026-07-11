import type { OutboxRepository } from "@link2cv/domain";
import { outboxEventTypes } from "@link2cv/domain";

export function enqueueJobApplicationChange(
  outbox: OutboxRepository,
  applicationId: string,
  profileId: string,
  type: "application.changed" | "application.deleted" = "application.changed",
): Promise<unknown> {
  return outbox.add({
    type: outboxEventTypes.jobApplicationChange,
    aggregateId: applicationId,
    payload: {
      type,
      applicationId,
      profileId,
      occurredAt: new Date().toISOString(),
    },
  });
}
