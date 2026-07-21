import type { SupportRequestNotification, SupportRequestNotifier } from "@careerden/domain";

export class MockSupportRequestNotifier implements SupportRequestNotifier {
  async notify(_request: SupportRequestNotification): Promise<void> {
    await Promise.resolve();
  }
}
