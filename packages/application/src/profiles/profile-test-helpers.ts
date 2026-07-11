import { vi } from "vitest";
import type { DocumentTemplate, UserProfile, UserProfileAccountRepository } from "@link2cv/domain";

export function createTestProfile(): UserProfile {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "profile-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    autoRunMatchAnalysis: true,
    followUpRemindersEnabled: true,
    links: [],
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createTestTemplate(): DocumentTemplate {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "template-1",
    profileId: "profile-1",
    kind: "cv",
    format: "docx",
    fileId: "file-1",
    fileName: "cv.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 128,
    placeholders: ["full_name"],
    fieldMappings: {},
    variableAliases: { fields: {} },
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createProfileRepository(
  profile: UserProfile = createTestProfile(),
  template: DocumentTemplate = createTestTemplate(),
): UserProfileAccountRepository {
  return {
    create: vi.fn(async () => profile),
    findById: vi.fn(async () => profile),
    update: vi.fn(async () => profile),
    createDocumentTemplate: vi.fn(async () => template),
    findDocumentTemplateById: vi.fn(async () => template),
    findDefaultDocumentTemplate: vi.fn(),
    listDocumentTemplates: vi.fn(async () => []),
    setDefaultDocumentTemplate: vi.fn(async () => template),
    updateDocumentTemplateMappings: vi.fn(async () => template),
    updateDocumentTemplateVariableAliases: vi.fn(async () => template),
    findByUserId: vi.fn(async () => profile),
    createForUserId: vi.fn(async () => profile),
    findUserIdByProfileId: vi.fn(async () => "user-1"),
  };
}
