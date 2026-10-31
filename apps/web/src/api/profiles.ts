import { requestJson } from "./client";
import type { ApiProfile, ApiUpdateOnboardingPayload, ApiUpdateProfilePayload } from "./types";

export const profileUpdatedEvent = "careerden:profile-updated";

export const profilesApi = {
  me(): Promise<ApiProfile> {
    return requestJson<ApiProfile>("/profiles/me");
  },
  get(id: string): Promise<ApiProfile> {
    return requestJson<ApiProfile>(`/profiles/${id}`);
  },
  async update(id: string, payload: ApiUpdateProfilePayload): Promise<ApiProfile> {
    const profile = await requestJson<ApiProfile>(`/profiles/${id}`, {
      body: payload,
      method: "PATCH",
    });

    dispatchProfileUpdated(profile);
    return profile;
  },
  async updateOnboarding(payload: ApiUpdateOnboardingPayload): Promise<ApiProfile> {
    const profile = await requestJson<ApiProfile>("/profiles/me/onboarding", {
      body: payload,
      method: "PATCH",
    });

    dispatchProfileUpdated(profile);
    return profile;
  },
};

function dispatchProfileUpdated(profile: ApiProfile): void {
  window.dispatchEvent(new CustomEvent<ApiProfile>(profileUpdatedEvent, { detail: profile }));
}
