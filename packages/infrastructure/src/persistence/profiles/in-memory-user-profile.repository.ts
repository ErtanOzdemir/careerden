import type {
  CreateDocumentTemplateInput,
  CreateUserProfileInput,
  DocumentTemplate,
  DocumentTemplateField,
  DocumentTemplateVariableAliases,
  UpdateUserProfileInput,
  UserProfile,
  UserProfileRepository,
} from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class InMemoryUserProfileRepository implements UserProfileRepository {
  private readonly profiles = new Map<string, UserProfile>();
  private readonly documentTemplates = new Map<string, DocumentTemplate[]>();

  async create(input: CreateUserProfileInput): Promise<UserProfile> {
    const now = new Date();
    const profile: UserProfile = {
      id: randomUUID(),
      ...input,
      links: input.links ?? [],
      education: input.education ?? [],
      certifications: input.certifications ?? [],
      projects: input.projects ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  async findById(id: string): Promise<UserProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async update(id: string, input: UpdateUserProfileInput): Promise<UserProfile | null> {
    const existing = this.profiles.get(id);

    if (!existing) {
      return null;
    }

    const updated: UserProfile = {
      ...existing,
      ...input,
      education: input.education ?? existing.education,
      certifications: input.certifications ?? existing.certifications,
      projects: input.projects ?? existing.projects,
      updatedAt: new Date(),
    };

    this.profiles.set(id, updated);
    return updated;
  }

  async createDocumentTemplate(input: CreateDocumentTemplateInput): Promise<DocumentTemplate> {
    const now = new Date();
    const existing = this.documentTemplates.get(input.profileId) ?? [];
    const template: DocumentTemplate = {
      id: randomUUID(),
      ...input,
      fieldMappings: input.fieldMappings ?? {},
      variableAliases: input.variableAliases ?? { fields: {} },
      isDefault: input.isDefault ?? existing.length === 0,
      createdAt: now,
      updatedAt: now,
    };
    const next = template.isDefault
      ? existing.map((item) => ({ ...item, isDefault: false, updatedAt: now }))
      : existing;

    this.documentTemplates.set(input.profileId, [...next, template]);
    return template;
  }

  async findDocumentTemplateById(id: string): Promise<DocumentTemplate | null> {
    return (
      [...this.documentTemplates.values()].flat().find((template) => template.id === id) ?? null
    );
  }

  async findDefaultDocumentTemplate(
    profileId: string,
    kind: DocumentTemplate["kind"],
  ): Promise<DocumentTemplate | null> {
    return (
      (this.documentTemplates.get(profileId) ?? []).find(
        (template) => template.kind === kind && template.isDefault,
      ) ?? null
    );
  }

  async listDocumentTemplates(profileId: string): Promise<DocumentTemplate[]> {
    return this.documentTemplates.get(profileId) ?? [];
  }

  async setDefaultDocumentTemplate(
    profileId: string,
    id: string,
  ): Promise<DocumentTemplate | null> {
    const templates = this.documentTemplates.get(profileId) ?? [];
    const selected = templates.find((template) => template.id === id);

    if (!selected) {
      return null;
    }

    const now = new Date();
    const updated = templates.map((template) => ({
      ...template,
      isDefault: template.id === id,
      updatedAt: template.id === id ? now : template.updatedAt,
    }));

    this.documentTemplates.set(profileId, updated);
    return updated.find((template) => template.id === id) ?? null;
  }

  async updateDocumentTemplateMappings(
    id: string,
    fieldMappings: Record<string, DocumentTemplateField>,
  ): Promise<DocumentTemplate | null> {
    const existing = await this.findDocumentTemplateById(id);

    if (!existing) {
      return null;
    }

    const updated: DocumentTemplate = {
      ...existing,
      fieldMappings,
      updatedAt: new Date(),
    };

    this.documentTemplates.set(
      existing.profileId,
      (this.documentTemplates.get(existing.profileId) ?? []).map((template) =>
        template.id === id ? updated : template,
      ),
    );
    return updated;
  }

  async updateDocumentTemplateVariableAliases(
    id: string,
    variableAliases: DocumentTemplateVariableAliases,
  ): Promise<DocumentTemplate | null> {
    const existing = await this.findDocumentTemplateById(id);

    if (!existing) {
      return null;
    }

    const updated: DocumentTemplate = {
      ...existing,
      variableAliases,
      updatedAt: new Date(),
    };

    this.documentTemplates.set(
      existing.profileId,
      (this.documentTemplates.get(existing.profileId) ?? []).map((template) =>
        template.id === id ? updated : template,
      ),
    );
    return updated;
  }
}
