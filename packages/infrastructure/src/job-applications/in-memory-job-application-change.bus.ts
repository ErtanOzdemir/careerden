import type {
  JobApplicationChange,
  JobApplicationChangeListener,
  JobApplicationChangePublisher,
  JobApplicationChangeSubscriber,
} from "@careerden/domain";

export class InMemoryJobApplicationChangeBus
  implements JobApplicationChangePublisher, JobApplicationChangeSubscriber
{
  private readonly listeners = new Map<string, Set<JobApplicationChangeListener>>();

  async publish(change: JobApplicationChange): Promise<void> {
    for (const listener of this.listeners.get(change.profileId) ?? []) {
      listener(change);
    }
  }

  async subscribe(profileId: string, listener: JobApplicationChangeListener): Promise<() => void> {
    const listeners = this.listeners.get(profileId) ?? new Set<JobApplicationChangeListener>();
    listeners.add(listener);
    this.listeners.set(profileId, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this.listeners.delete(profileId);
      }
    };
  }
}
