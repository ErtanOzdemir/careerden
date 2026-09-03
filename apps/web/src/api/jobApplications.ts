import { requestForm, requestJson } from "./client";
import type {
  ApiApplicationPriority,
  ApiApplicationStatus,
  ApiApplyFieldTipFieldRef,
  ApiJobApplicationContact,
  ApiJobApplication,
  ApiJobApplicationAnalytics,
  ApiJobApplicationDetail,
  ApiJobApplicationFollowUp,
  ApiJobApplicationsPage,
  ApiDocumentContent,
  ApiApplicationPackPreferences,
  ApiScrapeBundle,
  RichDocument,
} from "./types";

export interface ListJobApplicationsParams {
  archiveState?: "active" | "archived";
  applicationStatus?: ApiApplicationStatus;
  priority?: ApiApplicationPriority;
  processingStatus?: string;
  processingStatuses?: string;
  profileId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?:
    | "archivedAt"
    | "applicationStatus"
    | "companyName"
    | "dateApplied"
    | "matchScore"
    | "roleTitle"
    | "updatedAt";
  sortDirection?: "asc" | "desc";
}

export interface CreateJobApplicationInput {
  applicationPackPreferences?: ApiApplicationPackPreferences;
  profileId: string;
  sourceUrl?: string;
  jobUrl?: string;
}

export interface CreateManualJobApplicationInput {
  applicationPackPreferences?: ApiApplicationPackPreferences;
  companyDescription?: string;
  companyLogo?: File;
  companyName: string;
  companyWebsiteUrl?: string;
  jobDescription: string;
  jobLocation?: string;
  jobUrl?: string;
  profileId: string;
  roleTitle: string;
}

export interface RequestApplicationPackGenerationInput {
  documentContent?: ApiDocumentContent;
  preferences?: ApiApplicationPackPreferences;
}

export interface ApiDocumentPreview {
  templateId: string;
  html: string;
}

export interface ApiApplicationPackPreview {
  cv: ApiDocumentPreview;
  coverLetter: ApiDocumentPreview;
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
  priority?: ApiApplicationPriority | null;
  salaryCurrency?: string | null;
  salaryMaxAmount?: number | null;
  salaryMinAmount?: number | null;
  salaryPeriod?: "hourly" | "monthly" | "yearly" | null;
  salaryType?: "gross" | "net" | null;
  workStyle?: "hybrid" | "on_site" | "remote" | null;
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
  list(params: ListJobApplicationsParams): Promise<ApiJobApplicationsPage> {
    return requestJson<ApiJobApplicationsPage>("/job-applications", {
      query: {
        ...params,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
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

  archive(id: string): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>(`/job-applications/${id}/archive`, {
      method: "PUT",
    });
  },

  restore(id: string): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>(`/job-applications/${id}/archive`, {
      method: "DELETE",
    });
  },

  create(input: CreateJobApplicationInput): Promise<ApiJobApplication> {
    return requestJson<ApiJobApplication>("/job-applications", {
      method: "POST",
      body: input,
    });
  },

  createManual(input: CreateManualJobApplicationInput): Promise<ApiJobApplication> {
    const body = new FormData();
    body.set("profileId", input.profileId);
    body.set("companyName", input.companyName);
    body.set("roleTitle", input.roleTitle);
    body.set("jobDescription", input.jobDescription);
    if (input.companyDescription) body.set("companyDescription", input.companyDescription);
    if (input.companyWebsiteUrl) body.set("companyWebsiteUrl", input.companyWebsiteUrl);
    if (input.jobLocation) body.set("jobLocation", input.jobLocation);
    if (input.jobUrl) body.set("jobUrl", input.jobUrl);
    if (input.companyLogo) body.set("companyLogo", input.companyLogo);
    if (input.applicationPackPreferences) {
      body.set("applicationPackPreferences", JSON.stringify(input.applicationPackPreferences));
    }

    return requestForm<ApiJobApplication>("/job-applications/manual", body);
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

  requestApplicationPackGeneration(
    id: string,
    input: RequestApplicationPackGenerationInput,
  ): Promise<{ generationAttemptId: string; application: ApiJobApplicationDetail }> {
    return requestJson<{ generationAttemptId: string; application: ApiJobApplicationDetail }>(
      `/job-applications/${id}/application-pack/generations`,
      {
        method: "POST",
        body: input,
      },
    );
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

  previewDocuments(
    id: string,
    input: RequestApplicationPackGenerationInput,
  ): Promise<ApiApplicationPackPreview> {
    return requestJson<ApiApplicationPackPreview>(`/job-applications/${id}/document-preview`, {
      method: "POST",
      body: input,
    });
  },

  async applyFieldTip(
    id: string,
    input: { field: ApiApplyFieldTipFieldRef; currentValue: RichDocument; tip: string },
  ): Promise<{ value: RichDocument }> {
    return requestJson<{ value: RichDocument }>(`/job-applications/${id}/document-content/apply-tip`, {
      method: "POST",
      body: input,
    });
  },
};
