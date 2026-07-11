import type { JobApplicationChangePublisher } from "@link2cv/domain";

export class JobApplicationChangeNotifier {
  constructor(
    private readonly publisher: JobApplicationChangePublisher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  changed(applicationId: string, profileId: string): Promise<void> {
    return this.publish({
      type: "application.changed",
      applicationId,
      profileId,
      occurredAt: this.now().toISOString(),
    });
  }

  deleted(applicationId: string, profileId: string): Promise<void> {
    return this.publish({
      type: "application.deleted",
      applicationId,
      profileId,
      occurredAt: this.now().toISOString(),
    });
  }

  private async publish(change: Parameters<JobApplicationChangePublisher["publish"]>[0]) {
    try {
      await this.publisher.publish(change);
    } catch (error) {
      console.error("Failed to publish job application realtime change", error);
    }
  }
}
