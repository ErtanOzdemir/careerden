export type LinkedInSessionStatus = "missing" | "login_in_progress" | "connected" | "expired";

export interface LinkedInSessionStatusResult {
  status: LinkedInSessionStatus;
  message?: string;
  updatedAt?: Date;
}
