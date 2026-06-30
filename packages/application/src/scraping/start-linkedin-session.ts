import type { LinkedInSessionStatusResult, SessionManager } from "@link2cv/domain";

export class StartLinkedInSessionUseCase {
  constructor(private readonly sessionManager: SessionManager) {}

  async execute(): Promise<LinkedInSessionStatusResult> {
    return this.sessionManager.startLogin();
  }
}
