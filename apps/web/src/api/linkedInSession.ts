import { requestJson } from "./client";
import type { ApiLinkedInSessionStatusResult } from "./types";

export const linkedInSessionApi = {
  status(): Promise<ApiLinkedInSessionStatusResult> {
    return requestJson<ApiLinkedInSessionStatusResult>("/linkedin-session/status");
  },

  start(): Promise<ApiLinkedInSessionStatusResult> {
    return requestJson<ApiLinkedInSessionStatusResult>("/linkedin-session/start", {
      method: "POST",
    });
  },

  save(): Promise<ApiLinkedInSessionStatusResult> {
    return requestJson<ApiLinkedInSessionStatusResult>("/linkedin-session/save", {
      method: "POST",
    });
  },
};
