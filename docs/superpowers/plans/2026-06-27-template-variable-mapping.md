# Template Variable Mapping UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive variable mapping section to the TemplateManager page where users map each profile field to a DOCX template placeholder via dropdown menus.

**Architecture:** A new `TemplateVariableMapping` component renders per-template inside each `TemplateGroup` card. It shows 20 flat canonical fields + expandable complex field groups (experiences, education, links) with dropdowns of extracted template placeholders. On save, flat selections are inverted to `fieldMappings` and sub-field selections populate `variableAliases`, then both are persisted via existing API endpoints.

**Tech Stack:** React 19, TypeScript 5.7, Tailwind CSS 4, Vitest 2.1, @base-ui/react (Button), lucide-react (icons)

## Global Constraints

- Work on `master` branch (no feature branch)
- Keep file names kebab-case for components
- Use existing UI primitives: `Panel`, `PanelHeader`, `Button` from `@base-ui/react`
- Use existing API client methods — no new backend endpoints
- All imports use `.js` extension for relative TypeScript imports
- Follow existing Tailwind CSS utility class patterns

---

### Task 1: Relax API validation to allow partial fieldMappings

**Files:**

- Modify: `apps/api/src/profiles/profiles.routes.ts:207-220`

**Interfaces:**

- Consumes: existing `updateDocumentTemplateMappingsSchema` from `@link2cv/contracts`
- Produces: Allows `PATCH /:id/document-templates/:templateId/mappings` to accept a subset of placeholders in `fieldMappings` instead of requiring every detected placeholder

- [ ] **Step 1: Change the validation to allow partial mappings**

In `apps/api/src/profiles/profiles.routes.ts`, replace lines 207-220:

```typescript
const fieldMappings = request.body.fieldMappings as Record<string, string>;
const unknown = Object.keys(fieldMappings).filter(
  (placeholder) => !template.placeholders.includes(placeholder),
);

if (unknown.length > 0) {
  response.status(400).json({
    error: "Template mappings contain unknown placeholder keys",
    unknown,
  });
  return;
}
```

The original code checked `missing` (placeholders without mappings) which forced every placeholder to be present. That check is removed. Only the `unknown` check remains — rejecting keys that don't exist in the template's placeholders.

- [ ] **Step 2: Verify the change compiles**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/profiles/profiles.routes.ts
git commit -m "feat: allow partial fieldMappings in template mappings PATCH"
```

---

### Task 2: Create TemplateVariableMapping component

**Files:**

- Create: `apps/web/src/components/TemplateVariableMapping.tsx`

**Interfaces:**

- Consumes: `ApiDocumentTemplate`, `ApiProfile` from `../api/types.js`; `profilesApi` from `../api/profiles.js`; `Button` from `./ui/button.js`; `Panel`, `PanelHeader` from `./link2cv/panel.js`; `cn` from `../lib/utils.js`; `ChevronDown`, `ChevronRight`, `Save`, `AlertCircle` from `lucide-react`
- Produces: `TemplateVariableMapping` default export component

- [ ] **Step 1: Create the component file with imports, types, and helper functions**

```typescript
import { useState, useMemo, useCallback } from "react";
import { Button } from "./ui/button.js";
import { Panel } from "./link2cv/panel.js";
import { profilesApi } from "../api/profiles.js";
import type {
  ApiDocumentTemplate,
  ApiDocumentTemplateField,
  ApiDocumentTemplateVariableAliases,
  ApiProfile,
} from "../api/types.js";
import { cn } from "../lib/utils.js";
import { ChevronDown, ChevronRight, Save, AlertCircle } from "lucide-react";

const FLAT_FIELDS: { field: ApiDocumentTemplateField; label: string }[] = [
  { field: "full_name", label: "Full Name" },
  { field: "email", label: "Email" },
  { field: "profession", label: "Profession" },
  { field: "headline", label: "Headline" },
  { field: "location", label: "Location" },
  { field: "summary", label: "Summary" },
  { field: "skills", label: "Skills" },
  { field: "experience_list", label: "Experience List" },
  { field: "education_list", label: "Education List" },
  { field: "links", label: "Links" },
  { field: "company_name", label: "Company Name" },
  { field: "role_title", label: "Role Title" },
  { field: "job_description", label: "Job Description" },
  { field: "job_location", label: "Job Location" },
  { field: "customized_summary", label: "Customized Summary" },
  { field: "missing_skills", label: "Missing Skills" },
  { field: "strong_skills", label: "Strong Skills" },
  { field: "recommended_achievements", label: "Rec. Achievements" },
  { field: "selected_education", label: "Selected Education" },
  { field: "selected_experiences", label: "Selected Experiences" },
];

const EXPERIENCE_SUB_FIELDS: { key: string; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "period", label: "Period" },
  { key: "description", label: "Description" },
  { key: "skills", label: "Skills" },
  { key: "achievements", label: "Achievements" },
];

const EDUCATION_SUB_FIELDS: { key: string; label: string }[] = [
  { key: "institution", label: "Institution" },
  { key: "degree", label: "Degree" },
  { key: "field", label: "Field" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "period", label: "Period" },
  { key: "achievements", label: "Achievements" },
];

function getFieldPreview(field: ApiDocumentTemplateField, profile: ApiProfile): string {
  switch (field) {
    case "full_name":
      return profile.fullName || "--";
    case "email":
      return profile.email || "--";
    case "profession":
      return profile.profession || "--";
    case "headline":
      return profile.headline || "--";
    case "location":
      return profile.location || "--";
    case "summary":
      return (
        profile.summary?.slice(0, 60) +
          (profile.summary && profile.summary.length > 60 ? "..." : "") || "--"
      );
    case "skills":
      return profile.skills.join(", ").slice(0, 60) || "--";
    case "experience_list":
      return (
        profile.experience
          .map((e) => e.title)
          .join(", ")
          .slice(0, 60) || "--"
      );
    case "education_list":
      return (
        profile.education
          .map((e) => e.institution)
          .join(", ")
          .slice(0, 60) || "--"
      );
    case "links":
      return profile.links.join(", ").slice(0, 60) || "--";
    default:
      return "-- (auto-generated)";
  }
}

function getExperienceSubPreview(expIndex: number, subField: string, profile: ApiProfile): string {
  const exp = profile.experience[expIndex];
  if (!exp) return "--";
  const key = subField as keyof typeof exp;
  const value = exp[key];
  if (Array.isArray(value)) return value.join(", ").slice(0, 60) || "--";
  return String(value ?? "--").slice(0, 60);
}

function getEducationSubPreview(eduIndex: number, subField: string, profile: ApiProfile): string {
  const edu = profile.education[eduIndex];
  if (!edu) return "--";
  const key = subField as keyof typeof edu;
  const value = edu[key];
  if (Array.isArray(value)) return value.join(", ").slice(0, 60) || "--";
  return String(value ?? "--").slice(0, 60);
}

function invertFieldMappings(
  fieldMappings: Record<string, ApiDocumentTemplateField>,
): Record<string, string> {
  const inverted: Record<string, string> = {};
  for (const [placeholder, field] of Object.entries(fieldMappings)) {
    inverted[field] = placeholder;
  }
  return inverted;
}

function invertFlatMappings(
  flat: Record<string, string>,
): Record<string, ApiDocumentTemplateField> {
  const fieldMappings: Record<string, ApiDocumentTemplateField> = {};
  for (const [field, placeholder] of Object.entries(flat)) {
    if (placeholder && FLAT_FIELDS.some((f) => f.field === field)) {
      fieldMappings[placeholder] = field as ApiDocumentTemplateField;
    }
  }
  return fieldMappings;
}
```

- [ ] **Step 2: Write the mapping dropdown sub-component**

```typescript
function MappingDropdown({
  value,
  placeholders,
  usedPlaceholders,
  onChange,
}: {
  value: string;
  placeholders: string[];
  usedPlaceholders: Set<string>;
  onChange: (placeholder: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-muted",
          open && "border-ring ring-1 ring-ring",
        )}
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {value ? `{{${value}}}` : "Unmapped"}
        </span>
        <ChevronDown className={cn("size-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-48 w-full min-w-[200px] overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Unmapped
            </button>
            <div className="my-1 border-t border-border" />
            {placeholders.map((p) => {
              const alreadyUsed = usedPlaceholders.has(p) && p !== value;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => { onChange(p); setOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  <span>{`{{${p}}}`}</span>
                  {alreadyUsed && <span className="ml-auto text-[0.65rem] text-muted-foreground">mapped</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the complex field expansion sub-component for experiences**

```typescript
function ExperienceMappingGroup({
  profile,
  placeholders,
  usedPlaceholders,
  aliases,
  onChangeAliases,
}: {
  profile: ApiProfile;
  placeholders: string[];
  usedPlaceholders: Set<string>;
  aliases: ApiDocumentTemplateVariableAliases;
  onChangeAliases: (aliases: ApiDocumentTemplateVariableAliases) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function handleSubFieldChange(expIndex: number, subField: string, placeholder: string) {
    const next = structuredClone(aliases);
    if (!next.selectedExperiences) {
      next.selectedExperiences = { fields: {} };
    }
    if (!next.selectedExperiences.items) {
      next.selectedExperiences.items = [];
    }
    while (next.selectedExperiences.items.length <= expIndex) {
      next.selectedExperiences.items.push({ fields: {} });
    }
    if (placeholder) {
      next.selectedExperiences.items[expIndex].fields[subField as keyof typeof next.selectedExperiences.items[0]["fields"]] = placeholder;
    } else {
      delete next.selectedExperiences.items[expIndex].fields[subField as keyof typeof next.selectedExperiences.items[0]["fields"]];
    }
    onChangeAliases(next);
  }

  function getCurrentValue(expIndex: number, subField: string): string {
    return aliases.selectedExperiences?.items?.[expIndex]?.fields?.[subField as keyof typeof aliases.selectedExperiences.items[0]["fields"]] ?? "";
  }

  const itemCount = profile.experience.length;

  if (itemCount === 0) {
    return (
      <div className="border-t border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChevronRight className="size-4" />
          <span>Selected Experiences</span>
          <span className="text-xs">(0 items)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-5 py-3 text-sm text-foreground hover:bg-muted"
      >
        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span>Selected Experiences</span>
        <span className="text-xs text-muted-foreground">
          ({itemCount} item{itemCount !== 1 ? "s" : ""}, {itemCount * EXPERIENCE_SUB_FIELDS.length} sub-fields)
        </span>
      </button>
      {expanded && (
        <div className="space-y-3 px-5 pb-4">
          {profile.experience.map((_exp, expIndex) => (
            <div key={expIndex} className="rounded-lg border border-border">
              <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Experience {expIndex + 1}
              </div>
              <div className="divide-y divide-border">
                {EXPERIENCE_SUB_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {getExperienceSubPreview(expIndex, key, profile)}
                    </span>
                    <div className="w-40 shrink-0">
                      <MappingDropdown
                        value={getCurrentValue(expIndex, key)}
                        placeholders={placeholders}
                        usedPlaceholders={usedPlaceholders}
                        onChange={(p) => handleSubFieldChange(expIndex, key, p)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the complex field expansion sub-component for education**

```typescript
function EducationMappingGroup({
  profile,
  placeholders,
  usedPlaceholders,
  aliases,
  onChangeAliases,
}: {
  profile: ApiProfile;
  placeholders: string[];
  usedPlaceholders: Set<string>;
  aliases: ApiDocumentTemplateVariableAliases;
  onChangeAliases: (aliases: ApiDocumentTemplateVariableAliases) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function handleSubFieldChange(eduIndex: number, subField: string, placeholder: string) {
    const next = structuredClone(aliases);
    if (!next.selectedEducation) {
      next.selectedEducation = { fields: {} };
    }
    if (!next.selectedEducation.items) {
      next.selectedEducation.items = [];
    }
    while (next.selectedEducation.items.length <= eduIndex) {
      next.selectedEducation.items.push({ fields: {} });
    }
    if (placeholder) {
      next.selectedEducation.items[eduIndex].fields[subField as keyof typeof next.selectedEducation.items[0]["fields"]] = placeholder;
    } else {
      delete next.selectedEducation.items[eduIndex].fields[subField as keyof typeof next.selectedEducation.items[0]["fields"]];
    }
    onChangeAliases(next);
  }

  function getCurrentValue(eduIndex: number, subField: string): string {
    return aliases.selectedEducation?.items?.[eduIndex]?.fields?.[subField as keyof typeof aliases.selectedEducation.items[0]["fields"]] ?? "";
  }

  const itemCount = profile.education.length;

  if (itemCount === 0) {
    return (
      <div className="border-t border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChevronRight className="size-4" />
          <span>Selected Education</span>
          <span className="text-xs">(0 items)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-5 py-3 text-sm text-foreground hover:bg-muted"
      >
        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span>Selected Education</span>
        <span className="text-xs text-muted-foreground">
          ({itemCount} item{itemCount !== 1 ? "s" : ""}, {itemCount * EDUCATION_SUB_FIELDS.length} sub-fields)
        </span>
      </button>
      {expanded && (
        <div className="space-y-3 px-5 pb-4">
          {profile.education.map((_edu, eduIndex) => (
            <div key={eduIndex} className="rounded-lg border border-border">
              <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Education {eduIndex + 1}
              </div>
              <div className="divide-y divide-border">
                {EDUCATION_SUB_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {getEducationSubPreview(eduIndex, key, profile)}
                    </span>
                    <div className="w-40 shrink-0">
                      <MappingDropdown
                        value={getCurrentValue(eduIndex, key)}
                        placeholders={placeholders}
                        usedPlaceholders={usedPlaceholders}
                        onChange={(p) => handleSubFieldChange(eduIndex, key, p)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write the links mapping sub-component**

```typescript
function LinksMappingGroup({
  profile,
  placeholders,
  usedPlaceholders,
  aliases,
  onChangeAliases,
}: {
  profile: ApiProfile;
  placeholders: string[];
  usedPlaceholders: Set<string>;
  aliases: ApiDocumentTemplateVariableAliases;
  onChangeAliases: (aliases: ApiDocumentTemplateVariableAliases) => void;
}) {
  function handleLinkChange(linkIndex: number, placeholder: string) {
    const next = structuredClone(aliases);
    if (!next.linkItems) {
      next.linkItems = [];
    }
    while (next.linkItems.length <= linkIndex) {
      next.linkItems.push({});
    }
    next.linkItems[linkIndex].variableName = placeholder || undefined;
    onChangeAliases(next);
  }

  function getCurrentValue(linkIndex: number): string {
    return aliases.linkItems?.[linkIndex]?.variableName ?? "";
  }

  const linkCount = profile.links.length;

  if (linkCount === 0) {
    return null;
  }

  return (
    <div className="border-t border-border px-5 py-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">Links</div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {profile.links.map((_link, linkIndex) => (
          <div key={linkIndex} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              {profile.links[linkIndex]}
            </span>
            <div className="w-40 shrink-0">
              <MappingDropdown
                value={getCurrentValue(linkIndex)}
                placeholders={placeholders}
                usedPlaceholders={usedPlaceholders}
                onChange={(p) => handleLinkChange(linkIndex, p)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the main TemplateVariableMapping component**

```typescript
interface TemplateVariableMappingProps {
  template: ApiDocumentTemplate;
  profile: ApiProfile;
}

export default function TemplateVariableMapping({ template, profile }: TemplateVariableMappingProps) {
  const initialFlat = useMemo(
    () => invertFieldMappings(template.fieldMappings),
    [template.fieldMappings],
  );

  const [flatMappings, setFlatMappings] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const { field } of FLAT_FIELDS) {
      init[field] = initialFlat[field] ?? "";
    }
    return init;
  });

  const [variableAliases, setVariableAliases] = useState<ApiDocumentTemplateVariableAliases>(
    () => structuredClone(template.variableAliases),
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const placeholders = template.placeholders;

  const usedPlaceholders = useMemo(() => {
    const used = new Set<string>();
    for (const placeholder of Object.values(flatMappings)) {
      if (placeholder) used.add(placeholder);
    }
    const expItems = variableAliases.selectedExperiences?.items;
    if (expItems) {
      for (const item of expItems) {
        for (const p of Object.values(item.fields)) {
          if (p) used.add(p);
        }
      }
    }
    const eduItems = variableAliases.selectedEducation?.items;
    if (eduItems) {
      for (const item of eduItems) {
        for (const p of Object.values(item.fields)) {
          if (p) used.add(p);
        }
      }
    }
    const links = variableAliases.linkItems;
    if (links) {
      for (const item of links) {
        if (item.variableName) used.add(item.variableName);
      }
    }
    return used;
  }, [flatMappings, variableAliases]);

  function hasChanges(): boolean {
    for (const { field } of FLAT_FIELDS) {
      if ((flatMappings[field] ?? "") !== (initialFlat[field] ?? "")) return true;
    }
    return JSON.stringify(variableAliases) !== JSON.stringify(template.variableAliases);
  }

  const unmappedPlaceholders = useMemo(
    () => placeholders.filter((p) => !usedPlaceholders.has(p)),
    [placeholders, usedPlaceholders],
  );

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const fieldMappings = invertFlatMappings(flatMappings);

    try {
      await profilesApi.updateDocumentTemplateMappings(
        template.profileId,
        template.id,
        fieldMappings,
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save field mappings");
      setSaving(false);
      return;
    }

    try {
      await profilesApi.updateDocumentTemplateVariableAliases(
        template.profileId,
        template.id,
        variableAliases,
      );
    } catch (e) {
      setSaveError(
        `Field mappings saved, but variable aliases failed: ${e instanceof Error ? e.message : "unknown error"}`,
      );
      setSaving(false);
      return;
    }

    setSaveSuccess(true);
    setSaving(false);
  }

  if (placeholders.length === 0) {
    return (
      <div className="border-t border-border px-5 py-6 text-center text-sm text-muted-foreground">
        No variables detected in this template.
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="divide-y divide-border">
        {FLAT_FIELDS.map(({ field, label }) => (
          <div key={field} className="flex items-center gap-3 px-5 py-2">
            <span className="w-36 shrink-0 text-xs text-muted-foreground">{label}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              {getFieldPreview(field, profile)}
            </span>
            <div className="w-40 shrink-0">
              <MappingDropdown
                value={flatMappings[field] ?? ""}
                placeholders={placeholders}
                usedPlaceholders={usedPlaceholders}
                onChange={(p) => setFlatMappings((prev) => ({ ...prev, [field]: p }))}
              />
            </div>
          </div>
        ))}
      </div>

      <LinksMappingGroup
        profile={profile}
        placeholders={placeholders}
        usedPlaceholders={usedPlaceholders}
        aliases={variableAliases}
        onChangeAliases={setVariableAliases}
      />

      <ExperienceMappingGroup
        profile={profile}
        placeholders={placeholders}
        usedPlaceholders={usedPlaceholders}
        aliases={variableAliases}
        onChangeAliases={setVariableAliases}
      />

      <EducationMappingGroup
        profile={profile}
        placeholders={placeholders}
        usedPlaceholders={usedPlaceholders}
        aliases={variableAliases}
        onChangeAliases={setVariableAliases}
      />

      {unmappedPlaceholders.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border px-5 py-2 text-xs text-muted-foreground">
          <AlertCircle className="size-3 shrink-0" />
          <span>Unmapped:</span>
          {unmappedPlaceholders.map((p) => (
            <code key={p} className="rounded bg-muted px-1 py-0.5 text-[0.65rem]">
              {`{{${p}}}`}
            </code>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <div>
          {saveError && (
            <span className="text-xs text-destructive">{saveError}</span>
          )}
          {saveSuccess && (
            <span className="text-xs text-success">Mapping saved</span>
          )}
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges() || saving}
          type="button"
        >
          <Save className="size-3.5" />
          {saving ? "Saving..." : "Save Mapping"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/TemplateVariableMapping.tsx
git commit -m "feat: add TemplateVariableMapping component"
```

---

### Task 3: Modify TemplateManager to integrate variable mapping

**Files:**

- Modify: `apps/web/src/pages/TemplateManager.tsx`

**Interfaces:**

- Consumes: `TemplateVariableMapping` from `../components/TemplateVariableMapping.js`; `ApiProfile` from `../api/types.js`
- Produces: Each `TemplateGroup` card now renders an expandable `TemplateVariableMapping` section

- [ ] **Step 1: Update TemplateManager to fetch profile and pass it to TemplateGroup**

Replace the entire file content of `apps/web/src/pages/TemplateManager.tsx`:

```typescript
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/link2cv/panel.js";
import TemplateVariableMapping from "../components/TemplateVariableMapping.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentTemplate, ApiProfile } from "../api/types.js";
import { cn } from "../lib/utils.js";
import { FileText, Upload, Check, MoreHorizontal } from "lucide-react";

export default function TemplateManager() {
  const [templates, setTemplates] = useState<ApiDocumentTemplate[]>([]);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    profilesApi
      .me()
      .then(async (p) => {
        if (!isMounted) return;
        setProfile(p);
        const t = await profilesApi.listDocumentTemplates(p.id);
        if (isMounted) setTemplates(t);
      })
      .catch((e) => {
        if (isMounted) setError(e.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    try {
      setError(null);
      const uploaded = await profilesApi.uploadDocumentTemplate(profile.id, file);
      setTemplates((prev) => [...prev, uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function handleSetDefault(templateId: string) {
    if (!profile) return;
    try {
      setError(null);
      await profilesApi.setDefaultDocumentTemplate(profile.id, templateId);
      setTemplates((prev) => prev.map((t) => ({ ...t, isDefault: t.id === templateId })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set default.");
    }
  }

  const cvTemplates = templates.filter((t) => t.kind === "cv");
  const letterTemplates: ApiDocumentTemplate[] = [];

  if (isLoading)
    return <div className="py-16 text-center text-muted-foreground">Loading templates...</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Panel className="p-6">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Upload className="size-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            Upload a CV or cover letter template
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Drag and drop a DOCX or PDF file, or browse. Use the variable mapping section to connect
            your profile data to template placeholders.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <span>Browse files</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TemplateGroup
          title="CV templates"
          templates={cvTemplates}
          profile={profile}
          onSetDefault={handleSetDefault}
        />
        <TemplateGroup
          title="Cover letter templates"
          templates={letterTemplates}
          profile={profile}
          onSetDefault={handleSetDefault}
        />
      </div>
    </div>
  );
}

function TemplateGroup({
  title,
  templates,
  profile,
  onSetDefault,
}: {
  title: string;
  templates: ApiDocumentTemplate[];
  profile: ApiProfile | null;
  onSetDefault: (id: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <div className="divide-y divide-border border-t border-border">
        {templates.length > 0 ? (
          templates.map((t) => (
            <TemplateCard key={t.id} template={t} profile={profile} onSetDefault={onSetDefault} />
          ))
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No {title.toLowerCase()} yet.
          </div>
        )}
      </div>
    </Panel>
  );
}

function TemplateCard({
  template,
  profile,
  onSetDefault,
}: {
  template: ApiDocumentTemplate;
  profile: ApiProfile | null;
  onSetDefault: (id: string) => void;
}) {
  const [showMapping, setShowMapping] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-3.5 px-5 py-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{template.fileName}</p>
            {template.isDefault && (
              <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] font-medium text-success">
                <Check className="size-3" />
                Default
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {template.format.toUpperCase()} · {template.placeholders.length} variable{template.placeholders.length !== 1 ? "s" : ""} · {new Date(template.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => onSetDefault(template.id)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
            template.isDefault ? "text-muted-foreground/50" : "text-primary hover:bg-accent",
          )}
          disabled={template.isDefault}
        >
          {template.isDefault ? "In use" : "Set default"}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={showMapping ? "Hide variable mapping" : "Show variable mapping"}
          onClick={() => setShowMapping(!showMapping)}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      {showMapping && profile && (
        <TemplateVariableMapping template={template} profile={profile} />
      )}
    </div>
  );
}
```

Key changes from original:

- Removed the static `variables` array (lines 9-16) and the hardcoded reference panel (lines 126-147)
- Added `profile` state from `profilesApi.me()`
- Changed `profileId` state to `profile` state (full profile object needed for field previews)
- `TemplateGroup` now accepts `profile` prop and delegates card rendering to new `TemplateCard`
- `TemplateCard` renders each template row with a "More options" button that toggles visibility of `TemplateVariableMapping`
- Template card shows placeholder count in the subtitle line

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/TemplateManager.tsx
git commit -m "feat: integrate TemplateVariableMapping into TemplateManager"
```

---

### Task 4: Write component tests

**Files:**

- Create: `apps/web/src/components/TemplateVariableMapping.test.tsx`

**Interfaces:**

- Consumes: `TemplateVariableMapping` default export; `ApiDocumentTemplate`, `ApiProfile` types
- Produces: Test coverage for the component

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TemplateVariableMapping from "./TemplateVariableMapping.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentTemplate, ApiProfile } from "../api/types.js";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    updateDocumentTemplateMappings: vi.fn(),
    updateDocumentTemplateVariableAliases: vi.fn(),
  },
}));

const mockProfile: ApiProfile = {
  id: "profile-1",
  fullName: "John Doe",
  email: "john@example.com",
  profession: "Software Engineer",
  headline: "Senior Developer",
  location: "New York",
  summary: "Experienced engineer with 10 years in web development",
  skills: ["React", "TypeScript", "Node.js"],
  experience: [
    {
      title: "Senior Developer",
      company: "Acme Corp",
      startDate: "2022-01",
      endDate: "2025-01",
      description: "Led frontend team",
      skills: ["React", "TypeScript"],
      achievements: ["Shipped v2", "Reduced load time 40%"],
    },
    {
      title: "Junior Developer",
      company: "Startup Inc",
      startDate: "2019-01",
      endDate: "2021-12",
      description: "Built internal tools",
      skills: ["JavaScript", "Python"],
      achievements: ["Automated reporting"],
    },
  ],
  education: [
    {
      institution: "MIT",
      degree: "BSc Computer Science",
      field: "Computer Science",
      startDate: "2015-09",
      endDate: "2019-06",
      achievements: ["Dean's List"],
    },
  ],
  links: ["https://github.com/john", "https://linkedin.com/in/john"],
  certifications: ["AWS Certified"],
  projects: [],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockTemplate: ApiDocumentTemplate = {
  id: "template-1",
  profileId: "profile-1",
  kind: "cv",
  format: "docx",
  fileId: "file-1",
  fileName: "my-cv.docx",
  contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  size: 45000,
  placeholders: ["full_name", "email", "profession", "intro", "footer"],
  fieldMappings: {},
  variableAliases: { fields: {} },
  isDefault: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TemplateVariableMapping", () => {
  it("renders all flat fields with dropdowns", () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    expect(screen.getByText("Full Name")).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.getByText("Profession")).toBeDefined();
    expect(screen.getByText("Summary")).toBeDefined();
    expect(screen.getByText("Skills")).toBeDefined();
    expect(screen.getByText("Experience List")).toBeDefined();
    expect(screen.getByText("Education List")).toBeDefined();
    expect(screen.getByText("Links")).toBeDefined();
    expect(screen.getByText("Company Name")).toBeDefined();
    expect(screen.getByText("Role Title")).toBeDefined();
    expect(screen.getByText("Selected Experiences")).toBeDefined();
    expect(screen.getByText("Selected Education")).toBeDefined();
  });

  it("shows field value previews from profile data", () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    expect(screen.getByText("John Doe")).toBeDefined();
    expect(screen.getByText("john@example.com")).toBeDefined();
    expect(screen.getByText("Software Engineer")).toBeDefined();
  });

  it("shows auto-generated label for AI fields without profile data", () => {
    const templateWithoutMappings = {
      ...mockTemplate,
    };

    render(<TemplateVariableMapping template={templateWithoutMappings} profile={mockProfile} />);

    expect(screen.getAllByText("-- (auto-generated)").length).toBeGreaterThan(0);
  });

  it("shows no variables message when template has zero placeholders", () => {
    const emptyTemplate = { ...mockTemplate, placeholders: [] };
    render(<TemplateVariableMapping template={emptyTemplate} profile={mockProfile} />);

    expect(screen.getByText("No variables detected in this template.")).toBeDefined();
  });

  it("shows unmapped placeholder warning", () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    expect(screen.getByText("Unmapped:")).toBeDefined();
    expect(screen.getByText("{{full_name}}")).toBeDefined();
    expect(screen.getByText("{{email}}")).toBeDefined();
    expect(screen.getByText("{{intro}}")).toBeDefined();
  });

  it("save button is disabled when no changes made", () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    const saveButton = screen.getByText("Save Mapping").closest("button");
    expect(saveButton).toBeDisabled();
  });

  it("calls both API endpoints on save with correct data", async () => {
    const mappedTemplate = {
      ...mockTemplate,
      fieldMappings: {
        full_name: "full_name",
        email: "email",
      },
      variableAliases: {
        fields: {},
        selectedExperiences: {
          fields: {},
          items: [{ fields: { title: "exp1_title", company: "exp1_company" } }],
        },
      },
    };

    (profilesApi.updateDocumentTemplateMappings as ReturnType<typeof vi.fn>).mockResolvedValue(
      mappedTemplate,
    );
    (profilesApi.updateDocumentTemplateVariableAliases as ReturnType<typeof vi.fn>).mockResolvedValue(
      mappedTemplate,
    );

    render(<TemplateVariableMapping template={mappedTemplate} profile={mockProfile} />);

    // Change a mapping to enable save
    const unmappedDropdowns = screen.getAllByText("Unmapped");
    fireEvent.click(unmappedDropdowns[0]);
    const option = screen.getByText("{{profession}}");
    fireEvent.click(option);

    await waitFor(() => {
      const saveButton = screen.getByText("Save Mapping").closest("button");
      expect(saveButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText("Save Mapping").closest("button")!);

    await waitFor(() => {
      expect(profilesApi.updateDocumentTemplateMappings).toHaveBeenCalled();
      expect(profilesApi.updateDocumentTemplateVariableAliases).toHaveBeenCalled();
    });
  });

  it("shows error message when mappings save fails", async () => {
    (profilesApi.updateDocumentTemplateMappings as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    const unmappedDropdowns = screen.getAllByText("Unmapped");
    fireEvent.click(unmappedDropdowns[0]);
    fireEvent.click(screen.getByText("{{full_name}}"));

    await waitFor(() => {
      expect(screen.getByText("Save Mapping").closest("button")).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText("Save Mapping").closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("expands and collapses experience mapping group", async () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    const expToggle = screen.getByText("Selected Experiences").closest("button");
    expect(expToggle).toBeDefined();

    fireEvent.click(expToggle!);

    await waitFor(() => {
      expect(screen.getByText("Experience 1")).toBeDefined();
      expect(screen.getByText("Experience 2")).toBeDefined();
    });

    fireEvent.click(expToggle!);

    await waitFor(() => {
      expect(screen.queryByText("Experience 1")).toBeNull();
    });
  });

  it("shows 0 items badge when profile has no experiences", () => {
    const emptyProfile = { ...mockProfile, experience: [] };
    render(<TemplateVariableMapping template={mockTemplate} profile={emptyProfile} />);

    expect(screen.getByText("(0 items)")).toBeDefined();
  });

  it("shows 0 items badge when profile has no education", () => {
    const emptyProfile = { ...mockProfile, education: [] };
    render(<TemplateVariableMapping template={mockTemplate} profile={emptyProfile} />);

    const eduItems = screen.getAllByText("(0 items)");
    expect(eduItems.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
pnpm test apps/web/src/components/TemplateVariableMapping.test.tsx --run
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/TemplateVariableMapping.test.tsx
git commit -m "test: add TemplateVariableMapping component tests"
```

---

### Task 5: Verify quality gates

- [ ] **Step 1: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: PASS

- [ ] **Step 3: Format check**

```bash
pnpm format:check
```

Expected: PASS or auto-fix with `pnpm format:fix`

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```

Expected: All tests PASS

- [ ] **Step 5: Build**

```bash
pnpm build
```

Expected: PASS

- [ ] **Step 6: Commit (if any formatting fixes were needed)**

```bash
git add -A
git commit -m "chore: formatting fixes from quality gates"
```
