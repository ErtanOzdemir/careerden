import type {
  SupportRequestNotifier,
  SupportRequestReason,
} from "../../domain/support/support-request-notifier.js";

export interface SubmitSupportRequestInput {
  user: {
    id: string;
    email: string;
    name: string;
  };
  reason: SupportRequestReason;
  description: string;
}

export class SubmitSupportRequestUseCase {
  constructor(private readonly notifier: SupportRequestNotifier) {}

  async execute(input: SubmitSupportRequestInput): Promise<void> {
    await this.notifier.notify(input);
  }
}
