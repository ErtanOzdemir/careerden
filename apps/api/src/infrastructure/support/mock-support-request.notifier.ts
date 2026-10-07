import type {
  SupportRequestNotification,
  SupportRequestNotifier,
} from "../../domain/support/support-request-notifier.js";

export class MockSupportRequestNotifier implements SupportRequestNotifier {
  async notify(_request: SupportRequestNotification): Promise<void> {
    await Promise.resolve();
  }
}
