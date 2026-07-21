import type { OutboxRepository } from "@careerden/domain";
import { outboxEventTypes } from "@careerden/domain";

export async function enqueueStorageDeletions(
  outbox: OutboxRepository,
  fileIds: Iterable<string>,
): Promise<void> {
  for (const fileId of new Set(fileIds)) {
    await outbox.add({
      type: outboxEventTypes.storageDelete,
      aggregateId: fileId,
      payload: { fileId },
    });
  }
}
