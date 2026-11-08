import type {
  FollowUpReminderQueue,
  FollowUpReminderQueuePayload,
  ScheduleFollowUpReminderInput,
  ScheduledFollowUpReminder,
} from "@careerden/domain";

// Node timers overflow above this delay, so longer schedules re-arm until they are due.
const maximumTimerDelayMs = 2 ** 31 - 1;

export interface InProcessFollowUpReminderQueueOptions {
  deliver: (payload: FollowUpReminderQueuePayload) => Promise<unknown>;
  attempts?: number;
  backoffDelayMs?: number;
  now?: () => number;
  onFailed?: (payload: FollowUpReminderQueuePayload, error: unknown) => void;
}

// Delayed reminder jobs held in process timers. Timers do not survive a restart; the follow-up
// reminder recovery runner re-enqueues pending reminders on startup.
export class InProcessFollowUpReminderQueue implements FollowUpReminderQueue {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly deliveries = new Set<Promise<void>>();
  private readonly attempts: number;
  private readonly backoffDelayMs: number;
  private readonly now: () => number;
  private closed = false;

  constructor(private readonly options: InProcessFollowUpReminderQueueOptions) {
    this.attempts = options.attempts ?? 3;
    this.backoffDelayMs = options.backoffDelayMs ?? 5_000;
    this.now = options.now ?? Date.now;
  }

  async enqueue(input: ScheduleFollowUpReminderInput): Promise<ScheduledFollowUpReminder> {
    const jobId = `follow-up-${input.followUpId}`;
    const payload: FollowUpReminderQueuePayload = {
      followUpId: input.followUpId,
      jobApplicationId: input.jobApplicationId,
      profileId: input.profileId,
      followUpAt: input.followUpAt.toISOString(),
      scheduledFor: input.scheduledFor.toISOString(),
    };

    this.clear(jobId);
    this.schedule(jobId, payload, input.scheduledFor.getTime(), 0);

    return { jobId };
  }

  async remove(jobId: string): Promise<void> {
    this.clear(jobId);
  }

  // Cancels scheduled reminders and resolves once deliveries already under way have finished.
  async close(): Promise<void> {
    this.closed = true;
    for (const jobId of [...this.timers.keys()]) this.clear(jobId);
    await Promise.all([...this.deliveries]);
  }

  private schedule(
    jobId: string,
    payload: FollowUpReminderQueuePayload,
    runAt: number,
    attemptsMade: number,
  ): void {
    if (this.closed) return;
    const delay = Math.max(0, runAt - this.now());
    const timer = setTimeout(
      () => {
        if (this.timers.get(jobId) !== timer) return;
        if (runAt > this.now()) {
          this.schedule(jobId, payload, runAt, attemptsMade);
          return;
        }
        this.timers.delete(jobId);
        const delivery = this.run(jobId, payload, attemptsMade).finally(() => {
          this.deliveries.delete(delivery);
        });
        this.deliveries.add(delivery);
      },
      Math.min(delay, maximumTimerDelayMs),
    );
    this.timers.set(jobId, timer);
  }

  private async run(
    jobId: string,
    payload: FollowUpReminderQueuePayload,
    attemptsMade: number,
  ): Promise<void> {
    try {
      await this.options.deliver(payload);
    } catch (error) {
      const attempt = attemptsMade + 1;
      if (attempt >= this.attempts) {
        this.options.onFailed?.(payload, error);
        return;
      }
      // A newer schedule for the same reminder replaces this retry.
      if (this.timers.has(jobId)) return;
      this.schedule(jobId, payload, this.now() + this.backoffDelayMs * 2 ** attemptsMade, attempt);
    }
  }

  private clear(jobId: string): void {
    const timer = this.timers.get(jobId);
    if (timer) clearTimeout(timer);
    this.timers.delete(jobId);
  }
}
