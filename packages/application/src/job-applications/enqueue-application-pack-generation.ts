import type { JobApplication, JobApplicationRepository, OutboxRepository } from "@link2cv/domain";
import { outboxEventTypes } from "@link2cv/domain";
import { randomUUID } from "node:crypto";
import { generatedDocumentFileIds } from "../documents/generate-documents.use-case.js";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";

export async function enqueueApplicationPackGeneration(input: {
  jobApplications: Pick<JobApplicationRepository, "addEvent" | "beginDocumentGeneration">;
  outbox: OutboxRepository;
  jobApplication: JobApplication;
}): Promise<string | null> {
  const generationAttemptId = randomUUID();
  const started = await input.jobApplications.beginDocumentGeneration(
    input.jobApplication.id,
    generationAttemptId,
  );

  if (!started.started) return null;

  if (started.supersededAttemptId) {
    await enqueueStorageDeletions(
      input.outbox,
      generatedDocumentFileIds(input.jobApplication.id, started.supersededAttemptId),
    );
  }

  await input.outbox.add({
    type: outboxEventTypes.applicationPackGenerationRequested,
    aggregateId: input.jobApplication.id,
    payload: {
      jobApplicationId: input.jobApplication.id,
      generationAttemptId,
    },
  });
  await input.jobApplications.addEvent({
    jobApplicationId: input.jobApplication.id,
    type: "processing",
    title: "Application pack generation queued",
    metadata: { generationAttemptId },
  });

  return generationAttemptId;
}
