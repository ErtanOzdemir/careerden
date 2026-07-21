import type { DocumentTemplate, DocumentTemplateVariableAliases } from "@careerden/domain";

export function hasValidCoverLetterContentMapping(template: DocumentTemplate): boolean {
  const mappings = Object.entries(template.fieldMappings);
  const contentMapping = mappings[0];

  return (
    template.kind === "cover_letter" &&
    mappings.length === 1 &&
    contentMapping !== undefined &&
    contentMapping[1] === "cover_letter_content" &&
    template.placeholders.includes(contentMapping[0]) &&
    !hasConfiguredDocumentTemplateVariableAliases(template.variableAliases)
  );
}

export function hasConfiguredDocumentTemplateVariableAliases(
  variableAliases: DocumentTemplateVariableAliases,
): boolean {
  return containsConfiguredAlias(variableAliases);
}

function containsConfiguredAlias(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.some(containsConfiguredAlias);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(containsConfiguredAlias);
  }

  return false;
}
