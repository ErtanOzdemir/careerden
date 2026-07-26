import { requestForm, requestJson } from "./client";
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
