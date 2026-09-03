import { useState } from "react";
import { Check, Lightbulb, Loader2, Plus } from "lucide-react";
import type { DocumentFieldRef } from "@careerden/contracts";
import { emptyRichDocument, fieldRefToDomId } from "@careerden/contracts";
import type { ApiApplyFieldTipFieldRef, ApiDocumentContent, ApiProfile, RichDocument } from "../api/types.js";
import type { JobApplication } from "../types.js";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { updateEnhancementDescription } from "./ApplicationPackCustomizer.js";
import { cn } from "../lib/utils.js";

interface TipGroup {
  key: string;
  label: string;
  field: DocumentFieldRef;
  tips: string[];
  kind: "list" | "prose";
}

interface TipsPanelProps {
  aiMatch?: JobApplication["aiMatch"];
  content?: ApiDocumentContent;
  jobApplicationId: string;
  profile?: ApiProfile;
  readOnly?: boolean;
  onContentChange: (content: ApiDocumentContent) => void;
  /** Called after a tip is applied so the caller can switch to the CV tab and flash the field. */
  onTipApplied: (fieldDomId: string) => void;
}

export function TipsPanel({
  aiMatch,
  content,
  jobApplicationId,
  profile,
  readOnly = false,
  onContentChange,
  onTipApplied,
}: TipsPanelProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const groups = aiMatch ? buildTipGroups(aiMatch, profile) : [];
  const hasTips = groups.some((group) => group.tips.length > 0);

  async function applyProseTip(group: TipGroup, tip: string, tipKey: string) {
    if (!content || readOnly) return;
    const fieldRef = toProseFieldRef(group.field);
    if (!fieldRef) return;

    setPendingKey(tipKey);
    setErrorKey(null);
    try {
      const currentValue = readProseValue(content, group.field);
      const { value } = await jobApplicationsApi.applyFieldTip(jobApplicationId, {
        field: fieldRef,
        currentValue,
        tip,
      });
      onContentChange(writeProseValue(content, group.field, value));
      onTipApplied(fieldRefToDomId(group.field));
    } catch {
      setErrorKey(tipKey);
    } finally {
      setPendingKey(null);
    }
  }

  function applyListTip(group: TipGroup, tip: string) {
    if (!content || readOnly) return;
    const suggestion = extractSuggestedItem(tip);

    if (group.field.type === "skills" && !includesCaseInsensitive(content.skillSuggestions, suggestion)) {
      onContentChange({ ...content, skillSuggestions: [...content.skillSuggestions, suggestion] });
    } else if (
      group.field.type === "certifications" &&
      !includesCaseInsensitive(content.certificationSuggestions, suggestion)
    ) {
      onContentChange({
        ...content,
        certificationSuggestions: [...content.certificationSuggestions, suggestion],
      });
    }
    onTipApplied(fieldRefToDomId(group.field));
  }

  return (
    <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lightbulb className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Improvement tips</h3>
          <p className="text-xs text-muted-foreground">Click a tip to apply it to your CV</p>
        </div>
      </div>

      {!aiMatch && (
        <p className="text-sm text-muted-foreground">
          Tips will appear here once AI analysis completes.
        </p>
      )}
      {aiMatch && !hasTips && (
        <p className="text-sm text-muted-foreground">
          No tips right now — your CV already looks strong for this role.
        </p>
      )}

      <div className="space-y-4">
        {groups
          .filter((group) => group.tips.length > 0)
          .map((group) => (
            <div className="space-y-2" key={group.key}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.tips.map((tip, tipIndex) => {
                  const tipKey = `${group.key}-${tipIndex}`;
                  const isPending = pendingKey === tipKey;
                  const hasError = errorKey === tipKey;
                  const suggestion = group.kind === "list" ? extractSuggestedItem(tip) : undefined;
                  const alreadyAdded =
                    group.kind === "list" &&
                    content !== undefined &&
                    suggestion !== undefined &&
                    (group.field.type === "skills"
                      ? includesCaseInsensitive(content.skillSuggestions, suggestion)
                      : group.field.type === "certifications"
                        ? includesCaseInsensitive(content.certificationSuggestions, suggestion)
                        : false);

                  return (
                    <div key={tipKey}>
                      <button
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
                        )}
                        disabled={readOnly || isPending || alreadyAdded}
                        onClick={() =>
                          group.kind === "prose"
                            ? void applyProseTip(group, tip, tipKey)
                            : applyListTip(group, tip)
                        }
                        type="button"
                      >
                        <span className="mt-0.5 shrink-0 text-muted-foreground">
                          {isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : alreadyAdded ? (
                            <Check className="size-3.5 text-success" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                        </span>
                        <span>{tip}</span>
                      </button>
                      {hasError && (
                        <p className="mt-1 px-1 text-[0.7rem] text-destructive">
                          Couldn't apply this tip. Try again.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
}

function buildTipGroups(
  aiMatch: NonNullable<JobApplication["aiMatch"]>,
  profile?: ApiProfile,
): TipGroup[] {
  const groups: TipGroup[] = [];

  if (aiMatch.summaryTips.length > 0) {
    groups.push({
      key: "summary",
      label: "Summary",
      field: { type: "summary" },
      tips: aiMatch.summaryTips,
      kind: "prose",
    });
  }

  for (const entry of aiMatch.experienceTips) {
    if (entry.tips.length === 0) continue;
    const experience = profile?.experience[entry.index];
    groups.push({
      key: `experience-${entry.index}`,
      label: experience ? `${experience.title} · ${experience.company}` : `Experience ${entry.index + 1}`,
      field: { type: "experience", index: entry.index },
      tips: entry.tips,
      kind: "prose",
    });
  }

  for (const entry of aiMatch.educationTips) {
    if (entry.tips.length === 0) continue;
    const education = profile?.education[entry.index];
    groups.push({
      key: `education-${entry.index}`,
      label: education?.institution ?? `Education ${entry.index + 1}`,
      field: { type: "education", index: entry.index },
      tips: entry.tips,
      kind: "prose",
    });
  }

  for (const entry of aiMatch.projectTips) {
    if (entry.tips.length === 0) continue;
    const project = profile?.projects[entry.index];
    groups.push({
      key: `project-${entry.index}`,
      label: project?.name ?? `Project ${entry.index + 1}`,
      field: { type: "project", index: entry.index },
      tips: entry.tips,
      kind: "prose",
    });
  }

  if (aiMatch.skillsTips.length > 0) {
    groups.push({
      key: "skills",
      label: "Skills",
      field: { type: "skills" },
      tips: aiMatch.skillsTips,
      kind: "list",
    });
  }

  if (aiMatch.certificationsTips.length > 0) {
    groups.push({
      key: "certifications",
      label: "Certifications",
      field: { type: "certifications" },
      tips: aiMatch.certificationsTips,
      kind: "list",
    });
  }

  return groups;
}

function toProseFieldRef(field: DocumentFieldRef): ApiApplyFieldTipFieldRef | undefined {
  switch (field.type) {
    case "summary":
      return { type: "summary" };
    case "experience":
      return { type: "experience", index: field.index };
    case "education":
      return { type: "education", index: field.index };
    case "project":
      return { type: "project", index: field.index };
    default:
      return undefined;
  }
}

function readProseValue(content: ApiDocumentContent, field: DocumentFieldRef): RichDocument {
  switch (field.type) {
    case "summary":
      return content.customizedSummary;
    case "experience":
      return (
        content.experienceEnhancements.find((item) => item.experienceIndex === field.index)
          ?.description ?? emptyRichDocument()
      );
    case "education":
      return (
        content.educationEnhancements.find((item) => item.educationIndex === field.index)
          ?.description ?? emptyRichDocument()
      );
    case "project":
      return (
        content.projectEnhancements.find((item) => item.projectIndex === field.index)
          ?.description ?? emptyRichDocument()
      );
    default:
      return emptyRichDocument();
  }
}

function writeProseValue(
  content: ApiDocumentContent,
  field: DocumentFieldRef,
  value: RichDocument,
): ApiDocumentContent {
  switch (field.type) {
    case "summary":
      return { ...content, customizedSummary: value };
    case "experience":
      return updateEnhancementDescription(content, "experience", field.index, value);
    case "education":
      return updateEnhancementDescription(content, "education", field.index, value);
    case "project":
      return updateEnhancementDescription(content, "projects", field.index, value);
    default:
      return content;
  }
}

/**
 * Tips for skills/certifications are written to name the suggested item plainly (e.g. "Add
 * Kubernetes — it's a required skill for this role"), so applying one is a deterministic list
 * append with no AI call. This pulls just the item name out of that sentence.
 */
function extractSuggestedItem(tip: string): string {
  const afterAdd = tip.match(/^add\s+(.+)/i)?.[1] ?? tip;
  const beforePunctuation = afterAdd.split(/[—\-,.;:]/)[0];
  return (beforePunctuation ?? afterAdd).trim();
}

function includesCaseInsensitive(values: string[], value: string): boolean {
  return values.some((candidate) => candidate.toLowerCase() === value.toLowerCase());
}
