import type { LinkedInSessionStatusResult, SessionManager } from "@careerden/domain";

export class CheckLinkedInSessionUseCase {
  constructor(private readonly sessionManager: SessionManager) {}

  async execute(): Promise<LinkedInSessionStatusResult> {
    return this.sessionManager.getStatus();
  }
}
