# AI-Enhanced CV Field Toggle & Wizard Expansion Design

## Goal

Add per-field AI/Original toggles to the CV wizard so users can explicitly choose
which version of each enhanced field to use. Expand the wizard from 5 steps
(Summary + Experience only) to 8 steps covering all CV sections: Summary,
Experience, Skills, Education, Projects, Certifications.

## Current State

The `AiMatchCard` wizard has 5 steps (Match, Summary, Experience, Skills,
Approval) and already includes side-by-side Original vs AI comparison with
Tiptap-based rich text editing. However, there is no explicit toggle — AI
content is always used when available. Only Summary and Experience get
AI-editable content stored in `DocumentContent`.

## Data Model Changes

### DocumentContent (domain: `packages/domain/src/documents/rich-document.ts`)

```typescript
interface DocumentContentSelections {
  customizedSummary?: "ai" | "original";
  skills?: "ai" | "original";
  certifications?: "ai" | "original";
  experience: Record<string, {
    description?: "ai" | "original";
    achievements: Record<string, "ai" | "original">;
  }>;
  education: Record<string, {
    description?: "ai" | "original";
    achievements: Record<string, "ai" | "original">;
  }>;
  projects: Record<string, {
    description?: "ai" | "original";
    achievements: Record<string, "ai" | "original">;
  }>;
}

interface DocumentContent {
  customizedSummary: RichDocument;
  experienceEnhancements: DocumentContentExperienceEnhancement[];
  // New fields
  skillSuggestions: string[];
  educationEnhancements: DocumentContentEducationEnhancement[];
  projectEnhancements: DocumentContentProjectEnhancement[];
  certificationSuggestions: string[];
  selections: DocumentContentSelections;
}
```

**New enhancement types:**

```typescript
interface DocumentContentEducationEnhancement {
  educationIndex: number;
  description?: RichDocument;
  achievements: RichDocument[];
}

interface DocumentContentProjectEnhancement {
  projectIndex: number;
  description?: RichDocument;
  achievements: RichDocument[];
}
```

### MatchAnalysisResult (domain: `packages/domain/src/matching/match-analysis.ts`)

```typescript
interface MatchAnalysisResult {
  // ... existing fields ...
  skillSuggestions?: string[];
  educationEnhancements?: EducationEnhancement[];
  projectEnhancements?: ProjectEnhancement[];
  certificationSuggestions?: string[];
}
```

## Wizard Step Changes

**Old:** Match → Summary → Experience → Skills → Approval (5 steps)
**New:** Match → Summary → Experience → Skills → Education → Projects → Certifications → Approval (8 steps)

### Per-field UI pattern

Each enhanced field shows:
1. A toggle segment control: "AI" | "Original"
2. When AI selected: rich text editor (Tiptap) for editing the AI content
3. When Original selected: read-only display of the original profile text
4. Default selection: "ai" for all fields (backward compatible)

The existing `ExperienceComparisonRow` gets generalized to a reusable
`EnhancedFieldRow` component.

### New steps

| Step | Fields | Toggle granularity |
|------|--------|--------------------|
| Summary | 1 field | Per-field |
| Experience | Per-experience: description + achievements | Per description, per achievement |
| Skills | Skill list (tags) | Per-section |
| Education | Per-education: description + achievements | Per description, per achievement |
| Projects | Per-project: description + achievements | Per description, per achievement |
| Certifications | Certification list (tags) | Per-section |

## AI & Backend Changes

### AI prompt expansion (`run-match-analysis.ts`)

Add output instructions for new fields: `skillSuggestions`, `educationEnhancements`,
`projectEnhancements`, `certificationSuggestions`. All are optional for backward
compat with existing AI providers.

### Schema validation

- `ai-match-result.schema.ts`: Add optional fields for new AI output types
- `rich-document.schema.ts`: Expand `documentContentSchema` with new fields + selections
- All new fields are optional with sensible defaults (`[]` or `{}`)

### Template rendering (`generate-documents.ts`)

`toTemplateData` checks `selections` per field:
```
if (selections.summary === "original") → profile.summary
else → documentContent.customizedSummary (default: AI)
```
Same pattern for skills, education, projects, certifications.

### `documentContentFromMatchAnalysis`

Expands to convert the new AI string results to `RichDocument` format.

## Migration

All new `DocumentContent` fields are optional with defaults:
- `selections` defaults to `{}` (empty = use AI, current behavior)
- `skillSuggestions`, `certificationSuggestions` default to `[]`
- `educationEnhancements`, `projectEnhancements` default to `[]`

Existing `documentContent` JSON in the DB is valid as-is. No migration SQL needed.

## Files Changed

| Layer | File |
|-------|------|
| Domain | `packages/domain/src/documents/rich-document.ts` |
| Domain | `packages/domain/src/matching/match-analysis.ts` |
| Contracts | `packages/contracts/src/documents/rich-document.schema.ts` |
| Contracts | `packages/contracts/src/matching/ai-match-result.schema.ts` |
| Application | `packages/application/src/matching/run-match-analysis.ts` |
| Application | `packages/application/src/documents/generate-documents.ts` |
| Web types | `apps/web/src/api/types.ts` |
| Web mappers | `apps/web/src/api/mappers.ts` |
| Web wizard | `apps/web/src/components/AiMatchCard.tsx` |
| Web editor | `apps/web/src/components/RichTextEditor.tsx` (minor: toggle support) |

## Testing

| Layer | What to test |
|-------|-------------|
| Domain | `documentContentFromMatchAnalysis` handles new fields; selection defaults |
| Contracts | Expanded Zod schemas validate old and new shapes |
| Application | `toTemplateData` respects selections (AI vs original per field) |
| API | `PUT /:id/document-content` accepts expanded shape; `GET` returns selections |
| Web UI | Each wizard step renders toggle; toggle state persists across save |
