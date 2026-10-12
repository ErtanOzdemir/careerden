export type CreditActivityKind = "free_monthly_grant" | "subscription_grant" | "analysis_usage";

export interface CreditActivity {
  id: string;
  kind: CreditActivityKind;
  /** Positive when credits were added, negative when they were used. */
  delta: number;
  occurredAt: Date;
  /** Present for analysis usage, including applications that were deleted afterwards. */
  jobApplication?: {
    id: string;
    deleted: boolean;
    roleTitle?: string;
    companyName?: string;
  };
}

export interface CreditActivityReader {
  listRecent(userId: string, limit: number): Promise<CreditActivity[]>;
}
