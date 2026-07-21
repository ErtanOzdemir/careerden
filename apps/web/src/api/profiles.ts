import { ApiError, buildUrl, requestJson } from "./client";
import type {
  ApiDocumentTemplate,
  ApiDocumentTemplateField,
  ApiDocumentTemplateVariableAliases,
  ApiProfile,
  ApiUpdateProfilePayload,
} from "./types";

export const profileUpdatedEvent = "careerden:profile-updated";

export const profilesApi = {
  me(): Promise<ApiProfile> {
    return requestJson<ApiProfile>("/profiles/me");
  },
  get(id: string): Promise<ApiProfile> {
    return requestJson<ApiProfile>(`/profiles/${id}`);
  },
  listDocumentTemplates(id: string): Promise<ApiDocumentTemplate[]> {
    return requestJson<ApiDocumentTemplate[]>(`/profiles/${id}/document-templates`);
  },
  deleteDocumentTemplate(id: string, templateId: string): Promise<void> {
    return requestJson<void>(`/profiles/${id}/document-templates/${templateId}`, {
      method: "DELETE",
    });
  },
  async uploadDocumentTemplate(
    id: string,
    kind: ApiDocumentTemplate["kind"],
    file: File,
  ): Promise<ApiDocumentTemplate> {
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);

    return requestForm<ApiDocumentTemplate>(`/profiles/${id}/document-templates`, body);
  },
  setDefaultDocumentTemplate(id: string, templateId: string): Promise<ApiDocumentTemplate> {
    return requestJson<ApiDocumentTemplate>(
      `/profiles/${id}/document-templates/${templateId}/default`,
      { method: "PATCH" },
    );
  },
  updateDocumentTemplateMappings(
    id: string,
    templateId: string,
    fieldMappings: Record<string, ApiDocumentTemplateField>,
  ): Promise<ApiDocumentTemplate> {
    return requestJson<ApiDocumentTemplate>(
      `/profiles/${id}/document-templates/${templateId}/mappings`,
      {
        body: { fieldMappings },
        method: "PATCH",
      },
    );
  },
  updateDocumentTemplateVariableAliases(
    id: string,
    templateId: string,
    variableAliases: ApiDocumentTemplateVariableAliases,
  ): Promise<ApiDocumentTemplate> {
    return requestJson<ApiDocumentTemplate>(
      `/profiles/${id}/document-templates/${templateId}/variable-aliases`,
      {
        body: { variableAliases },
        method: "PATCH",
      },
    );
  },
  async update(id: string, payload: ApiUpdateProfilePayload): Promise<ApiProfile> {
    const profile = await requestJson<ApiProfile>(`/profiles/${id}`, {
      body: payload,
      method: "PATCH",
    });

    window.dispatchEvent(new CustomEvent<ApiProfile>(profileUpdatedEvent, { detail: profile }));
    return profile;
  },
};

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(buildUrl(path), {
    body,
    credentials: "include",
    method: "POST",
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload, response.statusText), response.status, payload);
  }

  return payload as T;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback || "API request failed";
}
