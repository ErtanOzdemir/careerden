import type { LinkedInSessionStatusResult } from "./linkedin-session.js";

export interface SessionManager {
  getStatus(): Promise<LinkedInSessionStatusResult>;
  startLogin(): Promise<LinkedInSessionStatusResult>;
  saveLogin(): Promise<LinkedInSessionStatusResult>;
}
