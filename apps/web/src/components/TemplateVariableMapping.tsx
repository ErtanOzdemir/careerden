import { useState, useMemo } from "react";
import { Button } from "./ui/button.js";
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
    case "selected_education":
      return `${profile.education.length} item${profile.education.length !== 1 ? "s" : ""}`;
    case "selected_experiences":
      return `${profile.experience.length} item${profile.experience.length !== 1 ? "s" : ""}`;
    default:
      return "--";
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
        <ChevronDown
          className={cn("size-3 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-48 w-full min-w-[200px] overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
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
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  <span>{`{{${p}}}`}</span>
                  {alreadyUsed && (
                    <span className="ml-auto text-[0.65rem] text-muted-foreground">mapped</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

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
      (next.selectedExperiences.items[expIndex].fields as Record<string, string>)[subField] =
        placeholder;
    } else {
      delete (
        next.selectedExperiences.items[expIndex].fields as Record<string, string | undefined>
      )[subField];
    }
    onChangeAliases(next);
  }

  function getCurrentValue(expIndex: number, subField: string): string {
    return (
      (
        aliases.selectedExperiences?.items?.[expIndex]?.fields as Record<string, string | undefined>
      )?.[subField] ?? ""
    );
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
          ({itemCount} item{itemCount !== 1 ? "s" : ""}, {itemCount * EXPERIENCE_SUB_FIELDS.length}{" "}
          sub-fields)
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
      (next.selectedEducation.items[eduIndex].fields as Record<string, string>)[subField] =
        placeholder;
    } else {
      delete (next.selectedEducation.items[eduIndex].fields as Record<string, string | undefined>)[
        subField
      ];
    }
    onChangeAliases(next);
  }

  function getCurrentValue(eduIndex: number, subField: string): string {
    return (
      (
        aliases.selectedEducation?.items?.[eduIndex]?.fields as Record<string, string | undefined>
      )?.[subField] ?? ""
    );
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
          ({itemCount} item{itemCount !== 1 ? "s" : ""}, {itemCount * EDUCATION_SUB_FIELDS.length}{" "}
          sub-fields)
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
        {profile.links.map((link, linkIndex) => (
          <div key={linkIndex} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{link}</span>
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

interface TemplateVariableMappingProps {
  template: ApiDocumentTemplate;
  profile: ApiProfile;
}

export default function TemplateVariableMapping({
  template,
  profile,
}: TemplateVariableMappingProps) {
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

  const [variableAliases, setVariableAliases] = useState<ApiDocumentTemplateVariableAliases>(() =>
    structuredClone(template.variableAliases),
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
        for (const p of Object.values(item.fields as Record<string, string | undefined>)) {
          if (p) used.add(p);
        }
      }
    }
    const eduItems = variableAliases.selectedEducation?.items;
    if (eduItems) {
      for (const item of eduItems) {
        for (const p of Object.values(item.fields as Record<string, string | undefined>)) {
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
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-5 py-2 text-xs text-muted-foreground">
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
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
          {saveSuccess && <span className="text-xs text-success">Mapping saved</span>}
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
