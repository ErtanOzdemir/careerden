import { requestJson } from "./client";
import type {
  ApiApplicationPriority,
  ApiApplicationStatus,
  ApiJobApplicationContact,
  ApiJobApplication,
  ApiJobApplicationAnalytics,
  ApiJobApplicationDetail,
  ApiJobApplicationFollowUp,
  ApiDocumentContent,
  ApiScrapeBundle,
} from "./types";

export interface ListJobApplicationsParams {
  applicationStatus?: ApiApplicationStatus;
  priority?: ApiApplicationPriority;
  processingStatus?: string;
  profileId: string;
  sortBy?: "applicationStatus" | "companyName" | "dateApplied" | "roleTitle" | "updatedAt";
  sortDirection?: "asc" | "desc";
}

export interface CreateJobApplicationInput {
  profileId: string;
  sourceUrl?: string;
  jobUrl?: string;
}

export interface CreateJobApplicationFromScrapeInput {
  metadata?: Record<string, unknown>;
  scrapeBundle: ApiScrapeBundle;
  sourceUrl: string;
}

export interface SubmitScrapeDataInput {
  claimedBy?: string;
  sourceUrl: string;
  scrapeBundle: ApiScrapeBundle;
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

export interface CreateFollowUpInput {
  title: string;
  description?: string;
  scheduledAt: string;
}

export interface UpdateFollowUpInput {
  title?: string;
  description?: string | null;
  scheduledAt?: string;
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

  createFromScrape(input: CreateJobApplicationFromScrapeInput): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>("/job-applications/from-scrape", {
      method: "POST",
      body: input,
    });
  },

  updateStatus(id: string, status: string): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>(`/job-applications/${id}/status`, {
      method: "PUT",
      body: { status },
    });
  },

  submitScrapeData(id: string, input: SubmitScrapeDataInput): Promise<ApiJobApplicationDetail> {
    return requestJson<ApiJobApplicationDetail>(`/job-applications/${id}/scrape-data`, {
      method: "PUT",
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

  startAnalysis(id: string): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>(`/job-applications/${id}/analysis`, {
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

  listFollowUps(id: string): Promise<ApiJobApplicationFollowUp[]> {
    return requestJson<ApiJobApplicationFollowUp[]>(`/job-applications/${id}/follow-ups`);
  },

  createFollowUp(id: string, input: CreateFollowUpInput): Promise<ApiJobApplicationFollowUp> {
    return requestJson<ApiJobApplicationFollowUp>(`/job-applications/${id}/follow-ups`, {
      method: "POST",
      body: input,
    });
  },

  updateFollowUp(
    id: string,
    followUpId: string,
    input: UpdateFollowUpInput,
  ): Promise<ApiJobApplicationFollowUp> {
    return requestJson<ApiJobApplicationFollowUp>(
      `/job-applications/${id}/follow-ups/${followUpId}`,
      {
        method: "PATCH",
        body: input,
      },
    );
  },

  deleteFollowUp(id: string, followUpId: string): Promise<void> {
    return requestJson<void>(`/job-applications/${id}/follow-ups/${followUpId}`, {
      method: "DELETE",
    });
  },

  async getDocumentDownloadUrl(jobApplicationId: string, document: { id: string }) {
    return requestJson<{ url: string }>(
      `/job-applications/${jobApplicationId}/documents/${document.id}/download`,
    );
  },
};
