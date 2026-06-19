import type { Knex } from "knex";
import type {
  CreateDocumentTemplateInput,
  CreateUserProfileInput,
  DocumentTemplate,
  DocumentTemplateField,
  DocumentTemplateVariableAliases,
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  UpdateUserProfileInput,
  UserProfile,
  UserProfileRepository,
} from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class PostgresUserProfileRepository implements UserProfileRepository {
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

function toUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    profession: nullableString(row.profession),
    headline: nullableString(row.headline),
    location: nullableString(row.location),
    links: stringArray(row.links),
    summary: nullableString(row.summary),
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    experience: Array.isArray(row.experience) ? (row.experience as ProfileExperience[]) : [],
    education: Array.isArray(row.education) ? (row.education as ProfileEducation[]) : [],
    certifications: Array.isArray(row.certifications) ? row.certifications.map(String) : [],
    projects: Array.isArray(row.projects) ? (row.projects as ProfileProject[]) : [],
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function nullableString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toDocumentTemplate(row: Record<string, unknown>): DocumentTemplate {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    kind: row.kind as DocumentTemplate["kind"],
    format: row.format as DocumentTemplate["format"],
    fileId: String(row.file_id),
    fileName: String(row.file_name),
    contentType: String(row.content_type),
    size: Number(row.size),
    placeholders: stringArray(row.placeholders),
    fieldMappings: record(row.field_mappings) as Record<string, DocumentTemplateField>,
    variableAliases: toDocumentTemplateVariableAliases(row.variable_aliases),
    isDefault: Boolean(row.is_default),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function toDocumentTemplateVariableAliases(value: unknown): DocumentTemplateVariableAliases {
  const parsed = record(value);
  const fields =
    typeof parsed.fields === "object" && parsed.fields !== null && !Array.isArray(parsed.fields)
      ? (parsed.fields as DocumentTemplateVariableAliases["fields"])
      : {};
  const selectedEducation =
    typeof parsed.selectedEducation === "object" &&
    parsed.selectedEducation !== null &&
    !Array.isArray(parsed.selectedEducation)
      ? (parsed.selectedEducation as DocumentTemplateVariableAliases["selectedEducation"])
      : undefined;
  const selectedExperiences =
    typeof parsed.selectedExperiences === "object" &&
    parsed.selectedExperiences !== null &&
    !Array.isArray(parsed.selectedExperiences)
      ? (parsed.selectedExperiences as DocumentTemplateVariableAliases["selectedExperiences"])
      : undefined;
  const linkItems = Array.isArray(parsed.linkItems)
    ? (parsed.linkItems as DocumentTemplateVariableAliases["linkItems"])
    : undefined;

  return {
    fields,
    ...(linkItems ? { linkItems } : {}),
    ...(selectedEducation ? { selectedEducation } : {}),
    ...(selectedExperiences ? { selectedExperiences } : {}),
  };
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}
