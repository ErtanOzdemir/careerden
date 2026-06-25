import type {
  DocumentTemplate,
  DocumentTemplateField,
  DocumentTemplateVariableAliases,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationInterview,
  JobApplicationStatus,
  ProfileEducation,
  ProfileExperience,
  ProfileProject,
  UserProfile,
} from "@link2cv/domain";

export function toJobApplication(row: Record<string, unknown>): JobApplication {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    sourceUrl: nullableString(row.source_url),
    status: row.status as JobApplicationStatus,
    failureReason: nullableString(row.failure_reason),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
    tracking: {
      companyName: nullableString(row.company_name),
      roleTitle: nullableString(row.role_title),
      roleType: nullableString(row.role_type),
      jobUrl: nullableString(row.job_url),
      dateApplied: nullableString(row.date_applied),
      applicationStatus: (nullableString(row.application_status) ??
        "applied") as JobApplication["tracking"]["applicationStatus"],
      priority: (nullableString(row.priority) ??
        "medium") as JobApplication["tracking"]["priority"],
      tags: stringArray(row.tags),
      nextFollowUpAt: nullableDate(row.next_follow_up_at),
      lastResponseAt: nullableDate(row.last_response_at),
      metadata: record(row.metadata),
    },
  };
}

export function toGeneratedDocument(row: Record<string, unknown>): GeneratedDocument {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    kind: row.kind as GeneratedDocument["kind"],
    format: (nullableString(row.format) ?? "pdf") as GeneratedDocument["format"],
    fileId: String(row.file_id),
    fileName: String(row.file_name),
    contentType: String(row.content_type),
    createdAt: new Date(String(row.created_at)),
  };
}

export function toJobApplicationEvent(row: Record<string, unknown>): JobApplicationEvent {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    type: row.type as JobApplicationEvent["type"],
    title: String(row.title),
    body: nullableString(row.body),
    occurredAt: new Date(String(row.occurred_at)),
    metadata: record(row.metadata),
    createdAt: new Date(String(row.created_at)),
  };
}

export function toJobApplicationContact(row: Record<string, unknown>): JobApplicationContact {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    name: String(row.name),
    role: nullableString(row.role),
    email: nullableString(row.email),
    phone: nullableString(row.phone),
    linkedInUrl: nullableString(row.linkedin_url),
    notes: nullableString(row.notes),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export function toJobApplicationInterview(row: Record<string, unknown>): JobApplicationInterview {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    title: String(row.title),
    type: nullableString(row.type),
    scheduledAt: new Date(String(row.scheduled_at)),
    status: row.status as JobApplicationInterview["status"],
    notes: nullableString(row.notes),
    prepNotes: nullableString(row.prep_notes),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export function toUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    profession: nullableString(row.profession),
    headline: nullableString(row.headline),
    location: nullableString(row.location),
    links: stringArray(row.links),
    summary: nullableString(row.summary),
    skills: stringArray(row.skills),
    experience: jsonArray<ProfileExperience>(row.experience),
    education: jsonArray<ProfileEducation>(row.education),
    certifications: stringArray(row.certifications),
    projects: jsonArray<ProfileProject>(row.projects),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export function toDocumentTemplate(row: Record<string, unknown>): DocumentTemplate {
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

export function toDocumentTemplateVariableAliases(value: unknown): DocumentTemplateVariableAliases {
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

export function nullableString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function nullableDate(value: unknown): Date | undefined {
  return value ? new Date(String(value)) : undefined;
}

export function stringArray(value: unknown): string[] {
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

export function record(value: unknown): Record<string, unknown> {
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

function jsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}
