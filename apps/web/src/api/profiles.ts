import { requestJson } from "./client";
import type { ApiProfile } from "./types";

export const profilesApi = {
  get(id: string): Promise<ApiProfile> {
    return requestJson<ApiProfile>(`/profiles/${id}`);
  },
};
