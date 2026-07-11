import type {
  CreateUserProfileInput,
  UpdateUserProfileInput,
  UserProfile,
} from "./user-profile.js";
import type {
  CreateDocumentTemplateInput,
  DocumentTemplate,
  DocumentTemplateField,
  DocumentTemplateKind,
  DocumentTemplateVariableAliases,
} from "../documents/document-template.js";

export interface UserProfileRepository {
  create(input: CreateUserProfileInput): Promise<UserProfile>;
  findById(id: string): Promise<UserProfile | null>;
  update(id: string, input: UpdateUserProfileInput): Promise<UserProfile | null>;
  createDocumentTemplate(input: CreateDocumentTemplateInput): Promise<DocumentTemplate>;
  findDocumentTemplateById(id: string): Promise<DocumentTemplate | null>;
  findDefaultDocumentTemplate(
    profileId: string,
    kind: DocumentTemplateKind,
  ): Promise<DocumentTemplate | null>;
  listDocumentTemplates(profileId: string): Promise<DocumentTemplate[]>;
  setDefaultDocumentTemplate(profileId: string, id: string): Promise<DocumentTemplate | null>;
  updateDocumentTemplateMappings(
    id: string,
    fieldMappings: Record<string, DocumentTemplateField>,
  ): Promise<DocumentTemplate | null>;
  updateDocumentTemplateVariableAliases(
    id: string,
    variableAliases: DocumentTemplateVariableAliases,
  ): Promise<DocumentTemplate | null>;
}

export interface UserProfileAccessRepository {
  findById(id: string): Promise<UserProfile | null>;
  findUserIdByProfileId(profileId: string): Promise<string | null>;
}

export interface UserProfileAccountRepository
  extends UserProfileRepository, UserProfileAccessRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  createForUserId(userId: string, input: CreateUserProfileInput): Promise<UserProfile>;
}
