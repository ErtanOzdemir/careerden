import type { Knex } from "knex";
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
import { toDocumentTemplate, toUserProfile } from "../mappers.js";

export class SqliteUserProfileRepository implements UserProfileRepository {
  constructor(private readonly db: Knex) {}

  async create(input: CreateUserProfileInput): Promise<UserProfile> {
    const id = randomUUID();
    const [row] = await this.db("user_profiles")
      .insert({
        id,
        full_name: input.fullName,
        email: input.email,
        profession: input.profession ?? null,
        headline: input.headline ?? null,
        location: input.location ?? null,
        links: JSON.stringify(input.links ?? []),
        summary: input.summary ?? null,
        skills: JSON.stringify(input.skills),
        experience: JSON.stringify(input.experience),
        education: JSON.stringify(input.education ?? []),
        certifications: JSON.stringify(input.certifications ?? []),
        projects: JSON.stringify(input.projects ?? []),
      })
      .returning("*");

    return toUserProfile(row);
  }

  async findById(id: string): Promise<UserProfile | null> {
    const row = await this.db("user_profiles").where({ id }).first();
    return row ? toUserProfile(row) : null;
  }

  async update(id: string, input: UpdateUserProfileInput): Promise<UserProfile | null> {
    const patch: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
    };

    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.email !== undefined) patch.email = input.email;
    if (input.profession !== undefined) patch.profession = input.profession ?? null;
    if (input.headline !== undefined) patch.headline = input.headline ?? null;
    if (input.location !== undefined) patch.location = input.location ?? null;
    if (input.links !== undefined) patch.links = JSON.stringify(input.links);
    if (input.summary !== undefined) patch.summary = input.summary ?? null;
    if (input.skills !== undefined) patch.skills = JSON.stringify(input.skills);
    if (input.experience !== undefined) patch.experience = JSON.stringify(input.experience);
    if (input.education !== undefined) patch.education = JSON.stringify(input.education);
    if (input.certifications !== undefined) {
      patch.certifications = JSON.stringify(input.certifications);
    }
    if (input.projects !== undefined) patch.projects = JSON.stringify(input.projects);

    const [row] = await this.db("user_profiles").where({ id }).update(patch).returning("*");

    return row ? toUserProfile(row) : null;
  }

  async createDocumentTemplate(input: CreateDocumentTemplateInput): Promise<DocumentTemplate> {
    const id = randomUUID();

    if (input.isDefault) {
      await this.clearDefaultDocumentTemplates(input.profileId, input.kind);
    }

    const [row] = await this.db("document_templates")
      .insert({
        id,
        profile_id: input.profileId,
        kind: input.kind,
        format: input.format,
        file_id: input.fileId,
        file_name: input.fileName,
        content_type: input.contentType,
        size: input.size,
        placeholders: JSON.stringify(input.placeholders),
        field_mappings: JSON.stringify(input.fieldMappings ?? {}),
        variable_aliases: JSON.stringify(input.variableAliases ?? { fields: {} }),
        is_default: input.isDefault ?? false,
      })
      .returning("*");

    return toDocumentTemplate(row);
  }

  async findDocumentTemplateById(id: string): Promise<DocumentTemplate | null> {
    const row = await this.db("document_templates").where({ id }).first();
    return row ? toDocumentTemplate(row) : null;
  }

  async findDefaultDocumentTemplate(
    profileId: string,
    kind: DocumentTemplate["kind"],
  ): Promise<DocumentTemplate | null> {
    const row = await this.db("document_templates")
      .where({ profile_id: profileId, kind, is_default: true })
      .first();
    return row ? toDocumentTemplate(row) : null;
  }

  async listDocumentTemplates(profileId: string): Promise<DocumentTemplate[]> {
    const rows = await this.db("document_templates")
      .where({ profile_id: profileId })
      .orderBy("created_at", "desc");

    return rows.map(toDocumentTemplate);
  }

  async setDefaultDocumentTemplate(
    profileId: string,
    id: string,
  ): Promise<DocumentTemplate | null> {
    const existing = await this.findDocumentTemplateById(id);

    if (!existing || existing.profileId !== profileId) {
      return null;
    }

    await this.clearDefaultDocumentTemplates(profileId, existing.kind);

    const [row] = await this.db("document_templates")
      .where({ id })
      .update({ is_default: true, updated_at: this.db.fn.now() })
      .returning("*");

    return row ? toDocumentTemplate(row) : null;
  }

  async updateDocumentTemplateMappings(
    id: string,
    fieldMappings: Record<string, DocumentTemplateField>,
  ): Promise<DocumentTemplate | null> {
    const [row] = await this.db("document_templates")
      .where({ id })
      .update({
        field_mappings: JSON.stringify(fieldMappings),
        updated_at: this.db.fn.now(),
      })
      .returning("*");

    return row ? toDocumentTemplate(row) : null;
  }

  async updateDocumentTemplateVariableAliases(
    id: string,
    variableAliases: DocumentTemplateVariableAliases,
  ): Promise<DocumentTemplate | null> {
    const [row] = await this.db("document_templates")
      .where({ id })
      .update({
        variable_aliases: JSON.stringify(variableAliases),
        updated_at: this.db.fn.now(),
      })
      .returning("*");

    return row ? toDocumentTemplate(row) : null;
  }

  private async clearDefaultDocumentTemplates(profileId: string, kind: string): Promise<void> {
    await this.db("document_templates")
      .where({ profile_id: profileId, kind })
      .update({ is_default: false, updated_at: this.db.fn.now() });
  }
}
