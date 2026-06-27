# Template Variable Mapping UI — Design Spec

**Date:** 2026-06-27  
**Status:** Approved  
**Approach:** Two-Tier Mapping (Approach A)

## Overview

Add an interactive variable mapping section to the TemplateManager page so users can manually map each profile field to a template placeholder (DOCX variable). The UI presents mappings from the profile side (field → placeholder) and inverts behind the scenes to match the existing `fieldMappings` (placeholder → field) and `variableAliases` storage models.

## Motivation

- The current TemplateManager shows a static, hardcoded reference list of 6 template variables — purely informational.
- Both `PATCH /mappings` and `PATCH /variable-aliases` API endpoints exist but have no UI.
- Users need to visually connect their profile data to template placeholders after uploading a DOCX template.

## Component Architecture

### New Files

| File                                                       | Purpose                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/web/src/components/TemplateVariableMapping.tsx`      | Mapping panel — renders per-template field rows with dropdowns |
| `apps/web/src/components/TemplateVariableMapping.test.tsx` | Component tests                                                |

### Modified Files

| File                                       | Change                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/pages/TemplateManager.tsx`   | Replace static variable reference panel (lines 126–147) with `<TemplateVariableMapping>`. Each `TemplateGroup` card gains an expandable mapping section.                                                                     |
| `apps/api/src/profiles/profiles.routes.ts` | Relax `fieldMappings` validation at lines 207–220 to allow mapped placeholders with empty string `""` as the field value (unmapped). Currently requires every placeholder key to have a valid `DocumentTemplateField` value. |

### No New Backend Files

The existing data model, API endpoints, and renderer logic handle everything needed.

### Component Tree

```
TemplateManager
├── Upload area (existing)
├── TemplateGroup (modified)
│   ├── Template header (name, format, date, badges — existing)
│   ├── Actions (Set default, More options — existing)
│   └── TemplateVariableMapping (NEW — expandable section)
│       ├── FlatFieldRow[] — one per canonical field (20 rows)
│       │   ├── Field label + current profile value preview
│       │   └── Dropdown (placeholder options from template + "Unmapped")
│       └── CompoundFieldGroup[] — selected_experiences, selected_education, links
│           └── ItemSubFieldRow[] — per-item × per-sub-field
│               ├── Sub-field label + value preview
│               └── Dropdown
│       └── "Save Mapping" button
```

## Data Flow & State Management

### State Model

`TemplateVariableMapping` maintains two local state objects:

1. **Flat mappings** — `Record<string, string>`  
   `{ [DocumentTemplateField]: placeholderName | "" }`  
   Initialized by inverting the template's existing `fieldMappings`:

   ```
   Object.entries(template.fieldMappings).reduce(
     (acc, [placeholder, field]) => ({ ...acc, [field]: placeholder }),
     {}
   )
   ```

   Missing canonical fields default to `""` (unmapped).

2. **Sub-field aliases** — `DocumentTemplateVariableAliases`  
   Initialized from the template's existing `variableAliases`. Only the `items[]` arrays are edited; the `fields` (default) level is preserved untouched.

### Props

```typescript
interface TemplateVariableMappingProps {
  template: ApiDocumentTemplate;
  profile: ApiProfile;
  onSave: (
    templateId: string,
    mappings: {
      fieldMappings: Record<string, DocumentTemplateField>;
      variableAliases: DocumentTemplateVariableAliases;
    },
  ) => Promise<void>;
}
```

### Save Pipeline

```
Save clicked
  ↓
Invert flat state: { [field]: placeholder } → { [placeholder]: field }
    (exclude entries where placeholder is "")
  ↓
Assemble variableAliases from sub-field state
    (merge per-item aliases with preserved defaults)
  ↓
PATCH /:profileId/document-templates/:templateId/mappings
  ↓
PATCH /:profileId/document-templates/:templateId/variable-aliases
  ↓
Toast: success or error
```

### Field Value Preview

| Field                      | Preview Source                                         | Example                         |
| -------------------------- | ------------------------------------------------------ | ------------------------------- |
| `full_name`                | `profile.fullName`                                     | `"John Doe"`                    |
| `email`                    | `profile.email`                                        | `"john@acme.com"`               |
| `profession`               | `profile.profession`                                   | `"Engineer"`                    |
| `headline`                 | `profile.headline`                                     | `"Senior Developer"`            |
| `location`                 | `profile.location`                                     | `"New York"`                    |
| `summary`                  | `profile.summary`                                      | `"Experienced..."` (truncated)  |
| `skills`                   | `profile.skills.join(", ")`                            | `"React, Node, TS"` (truncated) |
| `experience_list`          | `profile.experience.map(e => e.title).join(", ")`      | `"SE, Sr SE, Lead"`             |
| `education_list`           | `profile.education.map(e => e.institution).join(", ")` | `"MIT, Stanford"`               |
| `links`                    | `profile.links.join(", ")`                             | `"github, linkedin"`            |
| `company_name`             | AI-generated                                           | `"-- (auto-generated)"`         |
| `role_title`               | AI-generated                                           | `"-- (auto-generated)"`         |
| `job_description`          | AI-generated                                           | `"-- (auto-generated)"`         |
| `job_location`             | AI-generated                                           | `"-- (auto-generated)"`         |
| `customized_summary`       | AI-generated                                           | `"-- (auto-generated)"`         |
| `missing_skills`           | AI-generated                                           | `"-- (auto-generated)"`         |
| `strong_skills`            | AI-generated                                           | `"-- (auto-generated)"`         |
| `recommended_achievements` | AI-generated                                           | `"-- (auto-generated)"`         |
| `selected_experiences`     | Complex — per-item sub-fields below                    | See compound fields             |
| `selected_education`       | Complex — per-item sub-fields below                    | See compound fields             |

AI-generated fields show `"-- (auto-generated)"` since the profile doesn't contain this data yet (it's produced during document generation).

## UI Layout

### Collapsed State (per template card)

```
┌─────────────────────────────────────────────────────┐
│ 📄 my-cv-template.docx            DOCX · 45 KB      │
│ Uploaded Jun 25, 2026                  [★ Default]   │
│ [Set as Default]  [··· More]                         │
│                                                      │
│ ▸ Variable Mapping  ──────────────────────────────── │
└─────────────────────────────────────────────────────┘
```

### Expanded State

```
┌─────────────────────────────────────────────────────┐
│ ▾ Variable Mapping  ──────────────────────────────── │
│                                                      │
│ Profile field          Value preview          ▾      │
│ ──────────────────────────────────────────────────── │
│ Full Name             "John Doe"              ▾      │
│ Email                 "john@acme.com"         ▾      │
│ Profession            "Engineer"              ▾      │
│ Headline              "Senior Dev"            ▾      │
│ Location              "New York"              ▾      │
│ Summary               "Experienced..."        ▾      │
│ Skills                "React, Node..."        ▾      │
│ Experience List       "3 roles..."            ▾      │
│ Education List        "2 degrees..."          ▾      │
│ Links                 "3 links"               ▾      │
│ Company Name          -- (auto-gen)          ▾      │
│ Role Title            -- (auto-gen)          ▾      │
│ Job Description       -- (auto-gen)          ▾      │
│ Job Location          -- (auto-gen)          ▾      │
│ Customized Summary    -- (auto-gen)          ▾      │
│ Missing Skills        -- (auto-gen)          ▾      │
│ Strong Skills         -- (auto-gen)          ▾      │
│ Rec. Achievements     -- (auto-gen)          ▾      │
│                                                      │
│ ▸ Selected Experiences (3 items)                     │
│ ▸ Selected Education (2 items)                       │
│                                                      │
│ Unmapped placeholders: {{intro}}, {{footer}}         │
│                                                      │
│                              [Save Mapping]           │
└─────────────────────────────────────────────────────┘
```

### Complex Field Expansion

```
│ ▾ Selected Experiences (3 items)                     │
│   ┌── Experience 1 ────────────────────────────────┐ │
│   │ Title         "Software Engineer"        ▾      │ │
│   │ Company       "Acme Corp"                ▾      │ │
│   │ Start Date    "2020-01"                  ▾      │ │
│   │ End Date      "2023-06"                  ▾      │ │
│   │ Period        "3.5 years"                ▾      │ │
│   │ Description   "Led team of 5..."         ▾      │ │
│   │ Skills        "React, TypeScript"        ▾      │ │
│   │ Achievements  "3 items"                  ▾      │ │
│   └──────────────────────────────────────────────┘   │
│   ┌── Experience 2 ────────────────────────────────┐ │
│   │ Title         "Junior Developer"         ▾      │ │
│   │ ...                                            │ │
│   └──────────────────────────────────────────────┘   │
```

### Dropdown Menu

```
┌──────────────────────────┐
│ Unmapped                 │  ← clears the mapping
│ ──────────────────────── │
│ {{full_name}}            │
│ {{email}}                │
│ {{profession}}           │
│ {{headline}}             │
│ {{location}}             │
│ {{summary_text}}         │
│ {{skills_list}}          │
│ {{intro}}                │
│ {{footer}}               │
│ {{exp1_title}}    ✓      │  ← already mapped elsewhere
│ ...                      │
└──────────────────────────┘
```

## Interaction Details

- **Exclusive mapping:** A placeholder can only be assigned to one field. Selecting an already-mapped placeholder steals it from the previous field (the old field resets to "Unmapped").
- **Dropdown checkmarks:** Already-mapped placeholders show a subtle checkmark.
- **Complex fields start collapsed.** A summary badge shows item count and sub-field count.
- **Save is disabled** until at least one mapping has changed from its initial state.
- **Save button shows loading spinner** during API calls.
- **Unmapped placeholder warning** at the bottom of the panel lists any template placeholder that no field maps to.
- **Template with 0 placeholders** shows "No variables detected in this template" and hides the save button.

## Populating variableAliases from the UI

| UI Action                                   | variableAliases Path                                    |
| ------------------------------------------- | ------------------------------------------------------- |
| Experience 1 → Title → `{{exp1_title}}`     | `selectedExperiences.items[0].title = "exp1_title"`     |
| Experience 2 → Company → `{{exp2_company}}` | `selectedExperiences.items[1].company = "exp2_company"` |
| Education 1 → Institution → `{{school}}`    | `selectedEducation.items[0].institution = "school"`     |
| Link 1 → `{{github}}`                       | `linkItems[0].variableName = "github"`                  |

The `fields` (default) level of `variableAliases` is not exposed in this UI and is preserved from the existing template data. Per-item aliases take rendering priority over defaults.

## Rendering Priority (existing behavior, unchanged)

In `buildDocxAliasData()` (`packages/infrastructure/src/documents/docx-template-renderer.ts:78-104`):

1. `variableAliases.fields` — canonical field → custom variable name
2. `variableAliases.linkItems` / `.selectedExperiences` / `.selectedEducation` — per-item aliases
3. `fieldMappings` — fallback for any placeholder not covered by aliases

The new UI populates both `fieldMappings` and `variableAliases` so the renderer resolves data via either path.

## Complexity Handling for Array Fields

| Field                  | Expansion              | Rows Generated                  |
| ---------------------- | ---------------------- | ------------------------------- |
| `selected_experiences` | N items × 8 sub-fields | `profile.experience.length × 8` |
| `selected_education`   | N items × 7 sub-fields | `profile.education.length × 7`  |
| `links`                | N items × 1 sub-field  | `profile.links.length`          |
| `experience_list`      | 1 row (flat)           | 1                               |
| `education_list`       | 1 row (flat)           | 1                               |
| `skills`               | 1 row (flat)           | 1                               |

Complex field groups start collapsed to avoid overwhelming the user. Group items render inside bordered containers with headers.

## Edge Cases

| Case                                                       | Handling                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Template has 0 extracted placeholders                      | Show "No variables detected in this template" message. Save button hidden.                                                           |
| Profile is empty (no fields populated)                     | Show `"-- (empty)"` for value previews. Mapping still works.                                                                         |
| Complex field has 0 items                                  | Show collapsed group with `"(0 items)"` badge. No sub-field rows rendered.                                                           |
| User uploads new template while viewing another's mappings | Templates are listed independently. Expanding a different template loads its own `fieldMappings`/`variableAliases`. No interference. |
| 50+ placeholders in one template                           | Dropdown list has `max-height` with overflow scroll.                                                                                 |
| 10+ experiences (80 sub-field dropdowns)                   | Each experience group is independently collapsible.                                                                                  |
| Concurrent saves (double-click)                            | Save button disabled during API call (loading state).                                                                                |

## Error Handling

| Error                                                     | Response                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| API validation rejects `fieldMappings`                    | The route handler is relaxed (see API change below). Unmapped placeholders sent as `{ placeholder: "" }` — empty strings allowed through.  |
| Network failure                                           | Toast: "Failed to save mapping. Please try again." Local state preserved, user can retry.                                                  |
| `variableAliases` save fails but `fieldMappings` succeeds | Toast: "Field mappings saved, but variable aliases failed: <reason>." Partial persistence is acceptable — user can retry just the aliases. |
| Profile fetch fails                                       | Mapping component still renders dropdowns. Value previews show `"— (unavailable)"`.                                                        |

## API Change

**File:** `apps/api/src/profiles/profiles.routes.ts:207-220`

Current validation requires every `placeholders` value is a valid `DocumentTemplateField`. Change to accept empty string `""` as sentinel for unmapped placeholders:

```typescript
// Before (simplified):
fieldMappingsSchema = z.record(z.string(), documentTemplateFieldSchema);

// After:
fieldMappingsSchema = z.record(z.string(), z.union([documentTemplateFieldSchema, z.literal("")]));
```

Unmapped placeholders are omitted from the renderer's `addFieldMappings()` logic — the existing code at `docx-template-renderer.ts:190-206` already skips empty values.

## Testing

### Component Tests (`TemplateVariableMapping.test.tsx`)

- Renders all 20 flat canonical fields with dropdowns
- Dropdown populates with template's extracted placeholders
- Selecting a placeholder updates local state
- Selecting "Unmapped" clears a field's mapping
- Already-mapped placeholders show checkmark in other dropdowns
- Complex fields expand/collapse on click
- Complex fields render correct number of items × sub-fields based on profile data
- Save button calls `onSave` with correctly inverted `fieldMappings` and assembled `variableAliases`
- Save button disabled when no changes from initial state
- Save button disabled during save (loading)
- Empty template (0 placeholders) shows "No variables" message, hides save button
- Unmapped placeholder warning displays remaining placeholders
- Existing `fieldMappings` are correctly inverted to initialize flat state
- Existing `variableAliases` are correctly loaded into sub-field state
- Edge case: profile with 0 experiences shows collapsed group with "(0 items)"

## Verification Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
```
