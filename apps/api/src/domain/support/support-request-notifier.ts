export type SupportRequestReason = "bug_report" | "feature_request" | "other";

export interface SupportRequestNotification {
  user: {
    id: string;
    email: string;
    name: string;
  };
  reason: SupportRequestReason;
  description: string;
}

export interface SupportRequestNotifier {
  notify(request: SupportRequestNotification): Promise<void>;
}
