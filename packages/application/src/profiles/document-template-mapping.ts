import type { DocumentTemplate } from "@link2cv/domain";

export function hasValidCoverLetterContentMapping(template: DocumentTemplate): boolean {
  const contentPlaceholders = Object.entries(template.fieldMappings).filter(
    ([, field]) => field === "cover_letter_content",
  );

  return (
    template.kind === "cover_letter" &&
    contentPlaceholders.length === 1 &&
    template.placeholders.includes(contentPlaceholders[0]![0])
  );
}
