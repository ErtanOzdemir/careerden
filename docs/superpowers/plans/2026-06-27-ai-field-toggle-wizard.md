# AI-Enhanced CV Field Toggle & Wizard Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-field AI/Original toggles and expand the wizard from 5 to 8 steps covering all CV sections.

**Architecture:** Extend `DocumentContent` with new AI-enhanced sections and a `selections` map. Update Zod schemas, AI prompt, template rendering, and the React wizard component. All new fields are optional for backward compatibility.

**Tech Stack:** TypeScript 5.7, Zod 3.24, React 19, Tiptap 3, Tailwind CSS 4

## Global Constraints

- All new `DocumentContent` fields must be optional with sensible defaults for backward compatibility
- Selection defaults to `"ai"` when not explicitly set (preserves current behavior)
- Follow existing code conventions: kebab-case filenames, PascalCase React components, `.js` import extensions
- Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check` after each task

---

### Task 1: Domain types — DocumentContent, DocumentContentSelections, MatchAnalysisResult

**Files:**
- Modify: `packages/domain/src/documents/rich-document.ts:57-66`
- Modify: `packages/domain/src/matching/match-analysis.ts:9-24`
- Test: `packages/domain/src/documents/rich-document.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `DocumentContentSelections` interface
  - Expanded `DocumentContent` with `skillSuggestions`, `educationEnhancements`, `projectEnhancements`, `certificationSuggestions`, `selections`
  - `DocumentContentEducationEnhancement` interface
  - `DocumentContentProjectEnhancement` interface
  - Expanded `MatchAnalysisResult` with `skillSuggestions?`, `educationEnhancements?`, `projectEnhancements?`, `certificationSuggestions?`

- [ ] **Step 1: Add DocumentContentSelections and new enhancement types**

In `packages/domain/src/documents/rich-document.ts`, add after line 66:

```typescript
export interface DocumentContentEducationEnhancement {
  educationIndex: number;
  description?: RichDocument;
  achievements: RichDocument[];
}

export interface DocumentContentProjectEnhancement {
  projectIndex: number;
  description?: RichDocument;
  achievements: RichDocument[];
}

export interface DocumentContentSelections {
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
```

- [ ] **Step 2: Expand DocumentContent**

Replace lines 63-66 in `packages/domain/src/documents/rich-document.ts`:

```typescript
export interface DocumentContent {
  customizedSummary: RichDocument;
  experienceEnhancements: DocumentContentExperienceEnhancement[];
  skillSuggestions: string[];
  educationEnhancements: DocumentContentEducationEnhancement[];
  projectEnhancements: DocumentContentProjectEnhancement[];
  certificationSuggestions: string[];
  selections: DocumentContentSelections;
}
```

- [ ] **Step 3: Expand MatchAnalysisResult**

Replace lines 9-18 in `packages/domain/src/matching/match-analysis.ts`:

```typescript
export interface MatchAnalysisResult {
  matchScore: number;
  missingSkills: string[];
  strongSkills: string[];
  recommendedAchievements: string[];
  customizedSummary: string;
  interviewTips: string[];
  coverLetterGuidance?: string[];
  experienceEnhancements?: ExperienceEnhancement[];
  skillSuggestions?: string[];
  educationEnhancements?: EducationEnhancement[];
  projectEnhancements?: ProjectEnhancement[];
  certificationSuggestions?: string[];
}
```

And add after line 24:

```typescript
export interface EducationEnhancement {
  educationIndex: number;
  enhancedDescription?: string;
  enhancedAchievements?: string[];
}

export interface ProjectEnhancement {
  projectIndex: number;
  enhancedDescription?: string;
  enhancedAchievements?: string[];
}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS with no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/documents/rich-document.ts packages/domain/src/matching/match-analysis.ts
git commit -m "feat(domain): add DocumentContentSelections and expand CV section types"
```

---

### Task 2: Domain — documentContentFromMatchAnalysis expansion

**Files:**
- Modify: `packages/domain/src/documents/rich-document.ts:82-100`
- Test: `packages/domain/src/documents/rich-document.test.ts`

**Interfaces:**
- Consumes: Expanded `DocumentContent`, `MatchAnalysisResult` from Task 1
- Produces: Updated `documentContentFromMatchAnalysis` that maps new AI fields to `DocumentContent`

- [ ] **Step 1: Expand documentContentFromMatchAnalysis**

Replace lines 82-100 in `packages/domain/src/documents/rich-document.ts`:

```typescript
export function documentContentFromMatchAnalysis(input: {
  customizedSummary: string;
  experienceEnhancements?: Array<{
    experienceIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }>;
  skillSuggestions?: string[];
  educationEnhancements?: Array<{
    educationIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }>;
  projectEnhancements?: Array<{
    projectIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }>;
  certificationSuggestions?: string[];
}): DocumentContent {
  return {
    customizedSummary: richDocumentFromText(input.customizedSummary),
    experienceEnhancements: (input.experienceEnhancements ?? []).map((enhancement) => ({
      experienceIndex: enhancement.experienceIndex,
      ...(enhancement.enhancedDescription
        ? { description: richDocumentFromText(enhancement.enhancedDescription) }
        : {}),
      achievements: (enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
    })),
    skillSuggestions: input.skillSuggestions ?? [],
    educationEnhancements: (input.educationEnhancements ?? []).map((enhancement) => ({
      educationIndex: enhancement.educationIndex,
      ...(enhancement.enhancedDescription
        ? { description: richDocumentFromText(enhancement.enhancedDescription) }
        : {}),
      achievements: (enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
    })),
    projectEnhancements: (input.projectEnhancements ?? []).map((enhancement) => ({
      projectIndex: enhancement.projectIndex,
      ...(enhancement.enhancedDescription
        ? { description: richDocumentFromText(enhancement.enhancedDescription) }
        : {}),
      achievements: (enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
    })),
    certificationSuggestions: input.certificationSuggestions ?? [],
    selections: {
      experience: {},
      education: {},
      projects: {},
    },
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS. Fix any downstream type errors in callers that pass the old shape.

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/documents/rich-document.ts
git commit -m "feat(domain): expand documentContentFromMatchAnalysis for new CV sections"
```

---

### Task 3: Contract schemas — rich-document.schema.ts expansion

**Files:**
- Modify: `packages/contracts/src/documents/rich-document.schema.ts:101-126`

**Interfaces:**
- Consumes: `DocumentContent`, `DocumentContentSelections` from Task 1
- Produces: Updated `documentContentSchema` and `documentContentDto` with new optional fields

- [ ] **Step 1: Expand documentContentSchema**

Replace lines 101-116 in `packages/contracts/src/documents/rich-document.schema.ts`:

```typescript
const fieldSelectionSchema = z
  .enum(["ai", "original"])
  .optional();

const indexSelectionsSchema = z
  .record(
    z.string(),
    z.object({
      description: fieldSelectionSchema,
      achievements: z.record(z.string(), fieldSelectionSchema),
    }),
  )
  .default({});

const documentContentSelectionsSchema = z
  .object({
    customizedSummary: fieldSelectionSchema,
    skills: fieldSelectionSchema,
    certifications: fieldSelectionSchema,
    experience: indexSelectionsSchema,
    education: indexSelectionsSchema,
    projects: indexSelectionsSchema,
  })
  .strict()
  .default({});

export const documentContentSchema = z
  .object({
    customizedSummary: richDocumentSchema,
    experienceEnhancements: z
      .array(
        z
          .object({
            experienceIndex: z.number().int().min(0),
            description: richDocumentSchema.optional(),
            achievements: z.array(richDocumentSchema).max(100),
          })
          .strict(),
      )
      .max(100),
    skillSuggestions: z.array(z.string().min(1)).max(100).default([]),
    educationEnhancements: z
      .array(
        z
          .object({
            educationIndex: z.number().int().min(0),
            description: richDocumentSchema.optional(),
            achievements: z.array(richDocumentSchema).max(100),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    projectEnhancements: z
      .array(
        z
          .object({
            projectIndex: z.number().int().min(0),
            description: richDocumentSchema.optional(),
            achievements: z.array(richDocumentSchema).max(100),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    certificationSuggestions: z.array(z.string().min(1)).max(100).default([]),
    selections: documentContentSelectionsSchema,
  })
  .strict();
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/documents/rich-document.schema.ts
git commit -m "feat(contracts): expand documentContentSchema for new CV sections and selections"
```

---

### Task 4: Contract schemas — ai-match-result.schema.ts expansion

**Files:**
- Modify: `packages/contracts/src/matching/ai-match-result.schema.ts:3-20`

**Interfaces:**
- Consumes: `MatchAnalysisResult` from Task 1
- Produces: Updated `aiMatchResultSchema` with new optional fields

- [ ] **Step 1: Add new optional fields to aiMatchResultSchema**

Replace lines 3-20 in `packages/contracts/src/matching/ai-match-result.schema.ts`:

```typescript
export const aiMatchResultSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  missingSkills: z.array(z.string().min(1)),
  strongSkills: z.array(z.string().min(1)),
  recommendedAchievements: z.array(z.string().min(1)),
  customizedSummary: z.string().min(1),
  interviewTips: z.array(z.string().min(1)),
  coverLetterGuidance: z.array(z.string().min(1)).optional(),
  experienceEnhancements: z
    .array(
      z.object({
        experienceIndex: z.number().int().min(0),
        enhancedDescription: z.string().min(1).optional(),
        enhancedAchievements: z.array(z.string().min(1)).optional(),
      }),
    )
    .optional(),
  skillSuggestions: z.array(z.string().min(1)).optional(),
  educationEnhancements: z
    .array(
      z.object({
        educationIndex: z.number().int().min(0),
        enhancedDescription: z.string().min(1).optional(),
        enhancedAchievements: z.array(z.string().min(1)).optional(),
      }),
    )
    .optional(),
  projectEnhancements: z
    .array(
      z.object({
        projectIndex: z.number().int().min(0),
        enhancedDescription: z.string().min(1).optional(),
        enhancedAchievements: z.array(z.string().min(1)).optional(),
      }),
    )
    .optional(),
  certificationSuggestions: z.array(z.string().min(1)).optional(),
});
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/matching/ai-match-result.schema.ts
git commit -m "feat(contracts): expand aiMatchResultSchema for new CV sections"
```

---

### Task 5: Application — run-match-analysis.ts AI prompt expansion

**Files:**
- Modify: `packages/application/src/matching/run-match-analysis.ts:31-52`

**Interfaces:**
- Consumes: `aiMatchResultSchema` from Task 4, `documentContentFromMatchAnalysis` from Task 2
- Produces: Updated AI prompt with instructions for new output fields. No signature changes.

- [ ] **Step 1: Expand the prompt with new field instructions**

Replace lines 39-51 in `packages/application/src/matching/run-match-analysis.ts`:

```typescript
        requirementGuidance:
          "Use scrapedJob.requirements as the primary basis for missingSkills, strongSkills, recommendedAchievements, and interviewTips.",
        requiredOutput: {
          matchScore: "Integer 0-100",
          missingSkills: "Skills or criteria from the job that are not evident in the profile",
          strongSkills: "Profile skills that strongly match the job",
          recommendedAchievements: "Existing profile achievements to emphasize",
          customizedSummary: "2-3 sentences for the CV summary",
          interviewTips: "Practical tips for this interview",
          coverLetterGuidance: "Optional guidance for the cover letter",
          experienceEnhancements:
            "Optional array keyed by zero-based profile experience index. Include enhancedDescription and enhancedAchievements only when grounded in the original profile experience.",
          skillSuggestions:
            "Optional. Skills from the profile that are most relevant for this job. Do not invent skills not present in the profile.",
          educationEnhancements:
            "Optional array keyed by zero-based profile education index. Include enhancedDescription and enhancedAchievements only when grounded in the original profile education.",
          projectEnhancements:
            "Optional array keyed by zero-based profile projects index. Include enhancedDescription and enhancedAchievements only when grounded in the original profile projects.",
          certificationSuggestions:
            "Optional. Profile certifications most relevant for this job. Do not invent certifications not present in the profile.",
        },
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/application/src/matching/run-match-analysis.ts
git commit -m "feat(application): expand AI prompt with new CV section fields"
```

---

### Task 6: Application — generate-documents.ts selection-aware toTemplateData

**Files:**
- Modify: `packages/application/src/documents/generate-documents.ts:145-228`

**Interfaces:**
- Consumes: Expanded `DocumentContent` with selections from Task 1
- Produces: Updated `toTemplateData` and `toSelectedExperiences` that respect selections

- [ ] **Step 1: Make toTemplateData selection-aware**

Replace lines 166-168 in `packages/application/src/documents/generate-documents.ts`:

```typescript
    summary:
      documentContent.selections?.customizedSummary === "original"
        ? (profile.summary ? documentContentFromText(profile.summary) : documentContent.customizedSummary)
        : documentContent.customizedSummary,
    raw_summary: profile.summary ?? "",
    skills:
      documentContent.selections?.skills === "original"
        ? profile.skills
        : (documentContent.skillSuggestions.length > 0
            ? documentContent.skillSuggestions
            : profile.skills),
```

Replace lines 169-170:

```typescript
    education_list: profile.education,
    selected_education: toSelectedEducation(profile.education, documentContent),
    experience_list: enhancedExperiences,
```

- [ ] **Step 2: Make toSelectedExperiences selection-aware**

Replace lines 201-228 in `packages/application/src/documents/generate-documents.ts`:

```typescript
function toSelectedExperiences(
  experiences: ProfileExperience[],
  documentContent: DocumentContent,
): Record<string, unknown>[] {
  return experiences.map((experience, index) => {
    const enhancement = documentContent.experienceEnhancements.find(
      (item) => item.experienceIndex === index,
    );
    const selection = documentContent.selections?.experience?.[String(index)];
    const startDate = experience.startDate ?? "";
    const endDate = experience.endDate ?? "";

    const description =
      selection?.description === "original"
        ? (experience.description ? documentContentFromText(experience.description) : undefined)
        : (enhancement?.description ?? (experience.description ? documentContentFromText(experience.description) : undefined));

    const achievements =
      selection?.achievements
        ? experience.achievements.map((achievement, achievementIndex) => {
            const achievementSelection = selection.achievements[String(achievementIndex)];
            if (achievementSelection === "original" || !enhancement?.achievements?.[achievementIndex]) {
              return documentContentFromText(achievement);
            }
            return enhancement.achievements[achievementIndex];
          })
        : (enhancement?.achievements && enhancement.achievements.length > 0
            ? enhancement.achievements
            : experience.achievements.map(documentContentFromText));

    return {
      title: experience.title,
      company: experience.company,
      start_date: startDate,
      end_date: endDate || "Present",
      period: formatPeriod(startDate, endDate),
      description,
      achievements,
      skills: experience.skills ?? [],
    };
  });
}
```

- [ ] **Step 3: Update toSelectedEducation to be selection-aware**

Replace lines 184-199 in `packages/application/src/documents/generate-documents.ts`:

```typescript
function toSelectedEducation(
  education: ProfileEducation[],
  documentContent: DocumentContent,
): Record<string, unknown>[] {
  return education.map((item, index) => {
    const enhancement = documentContent.educationEnhancements.find(
      (e) => e.educationIndex === index,
    );
    const selection = documentContent.selections?.education?.[String(index)];
    const startDate = item.startDate ?? "";
    const endDate = item.endDate ?? "";

    const description =
      selection?.description === "ai" && enhancement?.description
        ? enhancement.description
        : undefined;

    const achievements =
      selection?.achievements
        ? item.achievements.map((achievement, achievementIndex) => {
            const achievementSelection = selection.achievements[String(achievementIndex)];
            if (achievementSelection === "original" || !enhancement?.achievements?.[achievementIndex]) {
              return documentContentFromText(achievement);
            }
            return enhancement.achievements[achievementIndex];
          })
        : (enhancement?.achievements && enhancement.achievements.length > 0
            ? enhancement.achievements
            : item.achievements.map(documentContentFromText));

    return {
      institution: item.institution,
      degree: item.degree ?? "",
      field: item.field ?? "",
      start_date: startDate,
      end_date: endDate || "Present",
      period: formatPeriod(startDate, endDate),
      achievements,
      ...(description ? { description } : {}),
    };
  });
}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/application/src/documents/generate-documents.ts
git commit -m "feat(application): make template rendering selection-aware for all CV sections"
```

---

### Task 7: Web types — api/types.ts ApiDocumentContent expansion

**Files:**
- Modify: `apps/web/src/api/types.ts:237-244`

**Interfaces:**
- Consumes: Expanded `DocumentContent` from Task 1
- Produces: Updated `ApiDocumentContent` matching the expanded backend shape

- [ ] **Step 1: Expand ApiDocumentContent**

Replace lines 237-244 in `apps/web/src/api/types.ts`:

```typescript
export interface ApiDocumentContentSelections {
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

export interface ApiDocumentContent {
  customizedSummary: RichDocument;
  experienceEnhancements: Array<{
    experienceIndex: number;
    description?: RichDocument;
    achievements: RichDocument[];
  }>;
  skillSuggestions: string[];
  educationEnhancements: Array<{
    educationIndex: number;
    description?: RichDocument;
    achievements: RichDocument[];
  }>;
  projectEnhancements: Array<{
    projectIndex: number;
    description?: RichDocument;
    achievements: RichDocument[];
  }>;
  certificationSuggestions: string[];
  selections: ApiDocumentContentSelections;
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS. Fix any downstream references.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/types.ts
git commit -m "feat(web-types): expand ApiDocumentContent for new CV sections and selections"
```

---

### Task 8: Web mappers — api/mappers.ts new field mapping

**Files:**
- Modify: `apps/web/src/api/mappers.ts:127-138`

**Interfaces:**
- Consumes: Expanded `ApiDocumentContent` from Task 7, expanded `ApiMatchAnalysis` from Task 4
- Produces: Updated `mapInitialDocumentContent` that includes new fields; expanded `mapMatchAnalysis` with new sections

- [ ] **Step 1: Expand mapInitialDocumentContent**

Replace lines 127-138 in `apps/web/src/api/mappers.ts`:

```typescript
function mapInitialDocumentContent(match: ApiMatchAnalysis) {
  return {
    customizedSummary: richDocumentFromText(match.customizedSummary),
    experienceEnhancements: (match.experienceEnhancements ?? []).map((enhancement) => ({
      experienceIndex: enhancement.experienceIndex,
      ...(enhancement.enhancedDescription
        ? { description: richDocumentFromText(enhancement.enhancedDescription) }
        : {}),
      achievements: (enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
    })),
    skillSuggestions: match.skillSuggestions ?? [],
    educationEnhancements: (match.educationEnhancements ?? []).map((enhancement) => ({
      educationIndex: enhancement.educationIndex,
      ...(enhancement.enhancedDescription
        ? { description: richDocumentFromText(enhancement.enhancedDescription) }
        : {}),
      achievements: (enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
    })),
    projectEnhancements: (match.projectEnhancements ?? []).map((enhancement) => ({
      projectIndex: enhancement.projectIndex,
      ...(enhancement.enhancedDescription
        ? { description: richDocumentFromText(enhancement.enhancedDescription) }
        : {}),
      achievements: (enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
    })),
    certificationSuggestions: match.certificationSuggestions ?? [],
    selections: {
      experience: {},
      education: {},
      projects: {},
    },
  };
}
```

- [ ] **Step 2: Expand mapMatchAnalysis with new sections**

In `apps/web/src/api/mappers.ts`, add after line 371 (`suggestedSkills: match.missingSkills`):

```typescript
    educationOptimizations: profile?.education.map((education, index) => {
      const enhancement = match.educationEnhancements?.find(
        (item) => item.educationIndex === index,
      );
      return {
        institution: education.institution,
        degree: [education.degree, education.field].filter(Boolean).join(", ") || "Education",
        items: [
          ...(education.achievements.map((achievement, achievementIndex) => ({
            actual: achievement,
            enhanced: enhancement?.enhancedAchievements?.[achievementIndex],
            kind: "achievement" as const,
          }))),
        ],
      };
    }),
    projectOptimizations: profile?.projects.map((project, index) => {
      const enhancement = match.projectEnhancements?.find(
        (item) => item.projectIndex === index,
      );
      return {
        name: project.name,
        items: [
          ...(project.description
            ? [{
                actual: project.description,
                enhanced: enhancement?.enhancedDescription,
                kind: "description" as const,
              }]
            : []),
          ...(project.achievements.map((achievement, achievementIndex) => ({
            actual: achievement,
            enhanced: enhancement?.enhancedAchievements?.[achievementIndex],
            kind: "achievement" as const,
          }))),
        ],
      };
    }),
```

Also add the new fields to the return type in `types.ts` (will be done in Task 9).

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: Type errors in types.ts for the new optimization fields. Address in Task 9.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/mappers.ts
git commit -m "feat(web-mappers): map new CV section AI fields from API"
```

---

### Task 9: Web wizard — AiMatchCard.tsx step structure and EnhancedFieldRow

**Files:**
- Modify: `apps/web/src/components/AiMatchCard.tsx`
- Modify: `apps/web/src/types.ts:88-106`
- Create: `apps/web/src/components/EnhancedFieldRow.tsx`

**Interfaces:**
- Consumes: Expanded `ApiDocumentContent` from Task 7, expanded `aiMatch` from Task 8
- Produces: Reusable `EnhancedFieldRow` component with toggle + rich text editor; updated wizard with 8 steps

- [ ] **Step 1: Expand types.ts aiMatch interface**

In `apps/web/src/types.ts:88-106`, add after line 105:

```typescript
    educationOptimizations?: {
      institution: string;
      degree: string;
      items: ExperienceOptimizationItem[];
    }[];
    projectOptimizations?: {
      name: string;
      items: ExperienceOptimizationItem[];
    }[];
```

- [ ] **Step 2: Create EnhancedFieldRow component**

Create `apps/web/src/components/EnhancedFieldRow.tsx`:

```tsx
import type { RichDocument } from "../api/types";
import { RichTextViewer, RichTextEditor } from "./RichTextEditor";
import { useState } from "react";

export interface EnhancedFieldRowProps {
  label: string;
  original: string;
  enhanced?: RichDocument;
  selection?: "ai" | "original";
  onSelectionChange: (selection: "ai" | "original") => void;
  onSave: (content: RichDocument) => void;
}

export default function EnhancedFieldRow({
  label,
  original,
  enhanced,
  selection = "ai",
  onSelectionChange,
  onSave,
}: EnhancedFieldRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<RichDocument | undefined>(enhanced);

  return (
    <div className="space-y-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-label-md">{label}</h4>
        <div className="flex rounded-full bg-surface-container-highest p-0.5">
          <button
            type="button"
            onClick={() => onSelectionChange("ai")}
            className={`px-3 py-1 rounded-full text-label-sm transition-colors ${
              selection === "ai"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            AI
          </button>
          <button
            type="button"
            onClick={() => onSelectionChange("original")}
            className={`px-3 py-1 rounded-full text-label-sm transition-colors ${
              selection === "original"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Original
          </button>
        </div>
      </div>
      {selection === "ai" && enhanced ? (
        isEditing ? (
          <div>
            <RichTextEditor
              value={draft ?? enhanced}
              onChange={(value) => setDraft(value)}
            />
            <div className="flex gap-2 mt-sm">
              <button
                type="button"
                className="px-3 py-1 bg-primary text-on-primary rounded-full text-label-sm"
                onClick={() => {
                  if (draft) {
                    onSave(draft);
                    setIsEditing(false);
                  }
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-surface-container-high text-on-surface rounded-full text-label-sm"
                onClick={() => {
                  setDraft(enhanced);
                  setIsEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="cursor-pointer border border-transparent hover:border-outline-variant rounded-lg p-md transition-colors"
          >
            <RichTextViewer value={enhanced} />
          </div>
        )
      ) : (
        <div className="bg-surface-container-high rounded-lg p-md text-body-sm text-on-surface opacity-70">
          {original || "No original content available."}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update wizard steps array**

In `apps/web/src/components/AiMatchCard.tsx`, replace lines 18-24:

```tsx
const wizardSteps = [
  { label: "Match", icon: "analytics" },
  { label: "Summary", icon: "subject" },
  { label: "Experience", icon: "work_history" },
  { label: "Skills", icon: "psychology" },
  { label: "Education", icon: "school" },
  { label: "Projects", icon: "rocket_launch" },
  { label: "Certifications", icon: "verified" },
  { label: "Approval", icon: "check_circle" },
] as const;
```

- [ ] **Step 4: Add helper functions for selection updates**

In `AiMatchCard.tsx`, add after line 749 (or near the existing `updateExperienceDocument`):

```tsx
function updateSelection(
  documentContent: ApiDocumentContent,
  path: string[],
  value: "ai" | "original",
): ApiDocumentContent {
  const selections = { ...documentContent.selections };
  let current: Record<string, unknown> = selections;
  for (let i = 0; i < path.length - 1; i++) {
    if (!current[path[i]]) {
      current[path[i]] = {} as Record<string, unknown>;
    }
    current = current[path[i]] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
  return { ...documentContent, selections };
}
```

- [ ] **Step 5: Implement new wizard steps**

Replace the Skills step (around lines 511-517) and add Education, Projects, Certifications steps before Approval:

For Skills step, add toggle alongside tags:

```tsx
{activeStep === 3 && (
  <div className="space-y-lg">
    <h2 className="font-display font-headline-sm">Skills Comparison</h2>
    <div className="flex items-center gap-sm mb-md">
      <span className="text-label-sm font-medium">Use:</span>
      <button
        type="button"
        onClick={() => setDraftContent(updateSelection(draftContent, ["skills"], "ai"))}
        className={`px-3 py-1 rounded-full text-label-sm ${
          draftContent.selections?.skills !== "original"
            ? "bg-primary text-on-primary"
            : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        AI Suggestions
      </button>
      <button
        type="button"
        onClick={() => setDraftContent(updateSelection(draftContent, ["skills"], "original"))}
        className={`px-3 py-1 rounded-full text-label-sm ${
          draftContent.selections?.skills === "original"
            ? "bg-primary text-on-primary"
            : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        Profile Skills
      </button>
    </div>
    <div className="grid md:grid-cols-2 gap-md">
      <div className="space-y-sm">
        <h3 className="font-label-md">Profile Skills</h3>
        <div className="flex flex-wrap gap-2">
          {aiMatch.yourSkills.map((skill) => (
            <span key={skill} className="px-3 py-1 bg-surface-container-high rounded-full text-label-sm">
              {skill}
            </span>
          ))}
        </div>
      </div>
      {draftContent.skillSuggestions.length > 0 && (
        <div className="space-y-sm">
          <h3 className="font-label-md">AI Suggestions</h3>
          <div className="flex flex-wrap gap-2">
            {draftContent.skillSuggestions.map((skill) => (
              <span key={skill} className="px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-label-sm">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

For Education step (new step index 4), iterate educationEnhancements and profile education:

```tsx
{activeStep === 4 && (
  <div className="space-y-xl">
    <h2 className="font-display font-headline-sm">Education Enhancements</h2>
    {profile?.education.map((edu, eduIndex) => {
      const enhancement = draftContent.educationEnhancements.find(
        (e) => e.educationIndex === eduIndex,
      );
      return (
        <div key={eduIndex} className="space-y-md">
          <h3 className="font-label-lg">{edu.institution} — {edu.degree}{edu.field ? `, ${edu.field}` : ""}</h3>
          {edu.achievements.map((achievement, achievementIndex) => (
            <EnhancedFieldRow
              key={`edu-${eduIndex}-${achievementIndex}`}
              label={`Achievement ${achievementIndex + 1}`}
              original={achievement}
              enhanced={enhancement?.achievements?.[achievementIndex]}
              selection={draftContent.selections?.education?.[String(eduIndex)]?.achievements?.[String(achievementIndex)]}
              onSelectionChange={(value) =>
                setDraftContent(
                  updateSelection(draftContent, ["education", String(eduIndex), "achievements", String(achievementIndex)], value),
                )
              }
              onSave={(content) =>
                setDraftContent(
                  updateEducationAchievement(draftContent, eduIndex, achievementIndex, content),
                )
              }
            />
          ))}
        </div>
      );
    })}
  </div>
)}
```

For Projects step (new step index 5):

```tsx
{activeStep === 5 && (
  <div className="space-y-xl">
    <h2 className="font-display font-headline-sm">Project Enhancements</h2>
    {profile?.projects.map((project, projectIndex) => {
      const enhancement = draftContent.projectEnhancements.find(
        (p) => p.projectIndex === projectIndex,
      );
      return (
        <div key={projectIndex} className="space-y-md">
          <h3 className="font-label-lg">{project.name}</h3>
          {project.description && (
            <EnhancedFieldRow
              label="Description"
              original={project.description}
              enhanced={enhancement?.description}
              selection={draftContent.selections?.projects?.[String(projectIndex)]?.description}
              onSelectionChange={(value) =>
                setDraftContent(
                  updateSelection(draftContent, ["projects", String(projectIndex), "description"], value),
                )
              }
              onSave={(content) =>
                setDraftContent(
                  updateProjectDescription(draftContent, projectIndex, content),
                )
              }
            />
          )}
          {project.achievements.map((achievement, achievementIndex) => (
            <EnhancedFieldRow
              key={`proj-${projectIndex}-${achievementIndex}`}
              label={`Achievement ${achievementIndex + 1}`}
              original={achievement}
              enhanced={enhancement?.achievements?.[achievementIndex]}
              selection={draftContent.selections?.projects?.[String(projectIndex)]?.achievements?.[String(achievementIndex)]}
              onSelectionChange={(value) =>
                setDraftContent(
                  updateSelection(draftContent, ["projects", String(projectIndex), "achievements", String(achievementIndex)], value),
                )
              }
              onSave={(content) =>
                setDraftContent(
                  updateProjectAchievement(draftContent, projectIndex, achievementIndex, content),
                )
              }
            />
          ))}
        </div>
      );
    })}
  </div>
)}
```

For Certifications step (new step index 6):

```tsx
{activeStep === 6 && (
  <div className="space-y-lg">
    <h2 className="font-display font-headline-sm">Certification Suggestions</h2>
    <div className="flex items-center gap-sm mb-md">
      <span className="text-label-sm font-medium">Use:</span>
      <button
        type="button"
        onClick={() => setDraftContent(updateSelection(draftContent, ["certifications"], "ai"))}
        className={`px-3 py-1 rounded-full text-label-sm ${
          draftContent.selections?.certifications !== "original"
            ? "bg-primary text-on-primary"
            : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        AI Suggestions
      </button>
      <button
        type="button"
        onClick={() => setDraftContent(updateSelection(draftContent, ["certifications"], "original"))}
        className={`px-3 py-1 rounded-full text-label-sm ${
          draftContent.selections?.certifications === "original"
            ? "bg-primary text-on-primary"
            : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        Profile Certifications
      </button>
    </div>
    <div className="grid md:grid-cols-2 gap-md">
      <div className="space-y-sm">
        <h3 className="font-label-md">Profile Certifications</h3>
        <div className="flex flex-wrap gap-2">
          {(profile?.certifications ?? []).map((cert) => (
            <span key={cert} className="px-3 py-1 bg-surface-container-high rounded-full text-label-sm">
              {cert}
            </span>
          ))}
        </div>
      </div>
      {draftContent.certificationSuggestions.length > 0 && (
        <div className="space-y-sm">
          <h3 className="font-label-md">AI Suggestions</h3>
          <div className="flex flex-wrap gap-2">
            {draftContent.certificationSuggestions.map((cert) => (
              <span key={cert} className="px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-label-sm">
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 6: Add helper functions for education/project content updates**

Add helper functions near `updateExperienceDocument`:

```tsx
function updateEducationAchievement(
  documentContent: ApiDocumentContent,
  educationIndex: number,
  achievementIndex: number,
  content: RichDocument,
): ApiDocumentContent {
  const educationEnhancements = [...documentContent.educationEnhancements];
  const existing = educationEnhancements.find((e) => e.educationIndex === educationIndex);
  if (existing) {
    const achievements = [...existing.achievements];
    achievements[achievementIndex] = content;
    const idx = educationEnhancements.indexOf(existing);
    educationEnhancements[idx] = { ...existing, achievements };
  } else {
    const achievements: RichDocument[] = [];
    achievements[achievementIndex] = content;
    educationEnhancements.push({ educationIndex, achievements });
  }
  return { ...documentContent, educationEnhancements };
}

function updateProjectDescription(
  documentContent: ApiDocumentContent,
  projectIndex: number,
  content: RichDocument,
): ApiDocumentContent {
  const projectEnhancements = [...documentContent.projectEnhancements];
  const existing = projectEnhancements.find((p) => p.projectIndex === projectIndex);
  if (existing) {
    const idx = projectEnhancements.indexOf(existing);
    projectEnhancements[idx] = { ...existing, description: content };
  } else {
    projectEnhancements.push({ projectIndex, description: content, achievements: [] });
  }
  return { ...documentContent, projectEnhancements };
}

function updateProjectAchievement(
  documentContent: ApiDocumentContent,
  projectIndex: number,
  achievementIndex: number,
  content: RichDocument,
): ApiDocumentContent {
  const projectEnhancements = [...documentContent.projectEnhancements];
  const existing = projectEnhancements.find((p) => p.projectIndex === projectIndex);
  if (existing) {
    const achievements = [...existing.achievements];
    achievements[achievementIndex] = content;
    const idx = projectEnhancements.indexOf(existing);
    projectEnhancements[idx] = { ...existing, achievements };
  } else {
    const achievements: RichDocument[] = [];
    achievements[achievementIndex] = content;
    projectEnhancements.push({ projectIndex, achievements });
  }
  return { ...documentContent, projectEnhancements };
}
```

- [ ] **Step 7: Add Summary step toggle**

Update the Summary step to use the toggle pattern. The existing `EditableRichDocumentField` handles the editing — add the toggle above it:

```tsx
{activeStep === 1 && (
  <div className="space-y-lg">
    <div className="flex items-center gap-sm mb-md">
      <span className="text-label-sm font-medium">Use:</span>
      <button
        type="button"
        onClick={() => setDraftContent(updateSelection(draftContent, ["customizedSummary"], "ai"))}
        className={`px-3 py-1 rounded-full text-label-sm ${
          draftContent.selections?.customizedSummary !== "original"
            ? "bg-primary text-on-primary"
            : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        AI Enhanced
      </button>
      <button
        type="button"
        onClick={() => setDraftContent(updateSelection(draftContent, ["customizedSummary"], "original"))}
        className={`px-3 py-1 rounded-full text-label-sm ${
          draftContent.selections?.customizedSummary === "original"
            ? "bg-primary text-on-primary"
            : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        Original
      </button>
    </div>
    <div className="grid md:grid-cols-2 md:divide-x gap-lg">
      <div className="space-y-sm">
        <h3 className="font-label-md">Original Profile Summary</h3>
        <TextPanel>{aiMatch.currentSummary}</TextPanel>
      </div>
      <div className="space-y-sm">
        <h3 className="font-label-md">Tailored CV Summary</h3>
        <EditableRichDocumentField
          value={draftContent.customizedSummary}
          onSave={(value) =>
            setDraftContent({ ...draftContent, customizedSummary: value })
          }
        />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 8: Pass profile prop to AiMatchCard**

The `AiMatchCard` needs access to the profile data (it currently gets `aiMatch` which has a limited view). Update the prop interface at line 7:

```tsx
interface AiMatchCardProps {
  aiMatch: NonNullable<JobApplication["aiMatch"]>;
  canCreateCv: boolean;
  hasGeneratedDocuments: boolean;
  isCreatingCv: boolean;
  isSavingContent: boolean;
  documentContent: ApiDocumentContent;
  profile?: import("../types").Profile;
  onSaveContent: (content: ApiDocumentContent) => Promise<void>;
  onCreateCv: () => Promise<void> | void;
}
```

And destructure `profile` from props.

- [ ] **Step 9: Update approval step index**

Change the Approval step from index 4 to index 7. Update the condition at line 520 from `activeStep === 4` to `activeStep === 7`. Also update the actual step index mapping (step 7 in the array is Approval).

- [ ] **Step 10: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS (after fixing any type mismatches).

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/AiMatchCard.tsx apps/web/src/components/EnhancedFieldRow.tsx apps/web/src/types.ts
git commit -m "feat(web-wizard): add per-field AI/Original toggle and expand to 8 steps"
```

---

### Task 10: Quality gates

**Files:**
- No file changes, verification only.

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: PASS (or fix any violations).

- [ ] **Step 3: Run format check**

```bash
pnpm format:check
```

Expected: PASS.

- [ ] **Step 4: Run build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: PASS. If any tests break (e.g., rich-document.test.ts due to schema changes), fix them.

