import { requestJson } from "./client";
import type {
  ApiApplicationPriority,
  ApiApplicationStatus,
  ApiJobApplicationContact,
  ApiJobApplicationInterview,
  ApiJobApplication,
  ApiJobApplicationAnalytics,
  ApiJobApplicationDetail,
  ApiDocumentContent,
} from "./types";

export interface ListJobApplicationsParams {
  applicationStatus?: ApiApplicationStatus;
  priority?: ApiApplicationPriority;
  profileId: string;
  sortBy?: "applicationStatus" | "companyName" | "dateApplied" | "roleTitle" | "updatedAt";
  sortDirection?: "asc" | "desc";
}

export interface CreateJobApplicationInput {
  profileId: string;
  sourceUrl?: string;
}

export interface UpdateJobApplicationInput {
  applicationStatus?: ApiApplicationStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateJobApplicationContactInput {
  email?: string;
  linkedInUrl?: string;
  name: string;
  notes?: string;
  phone?: string;
  role?: string;
}

export interface CreateJobApplicationInterviewInput {
  notes?: string;
  prepNotes?: string;
  scheduledAt: string;
  status?: ApiJobApplicationInterview["status"];
  title: string;
  type?: string;
}

export const jobApplicationsApi = {
  list(params: ListJobApplicationsParams): Promise<ApiJobApplication[]> {
    return requestJson<ApiJobApplication[]>("/job-applications", {
      query: {
        ...params,
        sortBy: params.sortBy ?? "updatedAt",
        sortDirection: params.sortDirection ?? "desc",
      },
    });
  },

  analytics(profileId: string): Promise<ApiJobApplicationAnalytics> {
    return requestJson<ApiJobApplicationAnalytics>("/job-applications/analytics", {
      query: { profileId },
    });
  },

  get(id: string): Promise<ApiJobApplicationDetail> {
    return requestJson<ApiJobApplicationDetail>(`/job-applications/${id}`);
  },

  create(input: CreateJobApplicationInput): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>("/job-applications", {
      method: "POST",
      body: input,
    });
  },

  update(id: string, input: UpdateJobApplicationInput): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>(`/job-applications/${id}`, {
      method: "PATCH",
      body: input,
    });
  },

  delete(id: string): Promise<void> {
    return requestJson<void>(`/job-applications/${id}`, {
      method: "DELETE",
    });
  },

  retry(id: string): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>(`/job-applications/${id}/retry`, {
      method: "POST",
    });
  },

  generateDocuments(id: string): Promise<ApiJobApplicationDetail> {
    return requestJson<ApiJobApplicationDetail>(`/job-applications/${id}/documents/generate`, {
      method: "POST",
    });
  },

  updateDocumentContent(
    id: string,
    documentContent: ApiDocumentContent,
  ): Promise<{ documentContent: ApiDocumentContent }> {
    return requestJson<{ documentContent: ApiDocumentContent }>(
      `/job-applications/${id}/document-content`,
      {
        method: "PUT",
        body: { documentContent },
      },
    );
  },

  createContact(
    jobApplicationId: string,
    input: CreateJobApplicationContactInput,
  ): Promise<ApiJobApplicationContact> {
    return requestJson<ApiJobApplicationContact>(`/job-applications/${jobApplicationId}/contacts`, {
      method: "POST",
      body: input,
    });
  },

  createInterview(
    jobApplicationId: string,
    input: CreateJobApplicationInterviewInput,
  ): Promise<ApiJobApplicationInterview> {
    return requestJson<ApiJobApplicationInterview>(
      `/job-applications/${jobApplicationId}/interviews`,
      {
        method: "POST",
        body: input,
      },
    );
  },

  async getDocumentDownloadUrl(jobApplicationId: string, document: { id: string }) {
    return requestJson<{ url: string }>(
      `/job-applications/${jobApplicationId}/documents/${document.id}/download`,
    );
  },
};
