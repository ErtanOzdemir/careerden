import { requestJson } from "./client.js";

export type SupportRequestReason = "bug_report" | "feature_request" | "other";

export interface SubmitSupportRequestInput {
  reason: SupportRequestReason;
  description: string;
}

export const supportApi = {
  submit(input: SubmitSupportRequestInput) {
    return requestJson<{ accepted: true }>("/support/requests", {
      method: "POST",
      body: input,
    });
  },
};
