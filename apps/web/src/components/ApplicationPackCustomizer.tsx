import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Brain,
  BriefcaseBusiness,
  ChevronDown,
  FileText,
  GraduationCap,
  Mail,
  Plus,
  Rocket,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import type {
  ApiApplicationPackPreferences,
  ApiDocumentContent,
  ApiProfile,
  RichDocument,
} from "../api/types.js";
import type { HtmlTemplateDefinition } from "@careerden/contracts";
import { mergeRichDocumentsAsProse, richDocumentFromText } from "@careerden/contracts";
import { cn } from "../lib/utils.js";
import RichTextEditor, { RichTextViewer } from "./RichTextEditor.js";
import { buttonVariants } from "./ui/button.js";

interface ApplicationPackCustomizerProps {
  content: ApiDocumentContent;
  preferences: ApiApplicationPackPreferences;
  profile?: ApiProfile;
  templates: HtmlTemplateDefinition[];
  onContentChange: (content: ApiDocumentContent) => void;
  onPreferencesChange: (preferences: ApiApplicationPackPreferences) => void;
}

type SelectionSource = "ai" | "original";
type EnhancementSection = "education" | "experience" | "projects";

const emptyDocument: RichDocument = { version: 1, blocks: [] };

export function ApplicationPackCustomizer({
  content,
  onContentChange,
  onPreferencesChange,
  preferences,
  profile,
  templates,
}: ApplicationPackCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const experienceIndexes = useMemo(
    () =>
      collectIndexes(
        profile?.experience.length ?? 0,
        content.experienceEnhancements.map((item) => item.experienceIndex),
      ),
    [content.experienceEnhancements, profile?.experience.length],
  );
  const educationIndexes = useMemo(
    () =>
      collectIndexes(
        profile?.education.length ?? 0,
        content.educationEnhancements.map((item) => item.educationIndex),
      ),
    [content.educationEnhancements, profile?.education.length],
  );
  const projectIndexes = useMemo(
    () =>
      collectIndexes(
        profile?.projects.length ?? 0,
        content.projectEnhancements.map((item) => item.projectIndex),
      ),
    [content.projectEnhancements, profile?.projects.length],
  );
  const originalSummary =
    profile?.summaryRichText ??
    (profile?.summary ? richDocumentFromText(profile.summary) : undefined);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Settings2 className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Customize this pack</span>
            <span className="block text-xs text-muted-foreground">
              Compare profile content, edit AI suggestions, and choose what appears
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {isOpen ? "Hide" : "Show"}
          <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
        </span>
      </button>

      {isOpen && (
        <div className="space-y-5 border-t border-border px-5 py-5">
          <PreferenceFields
            onChange={onPreferencesChange}
            preferences={preferences}
            templates={templates}
          />
          <ProfileIdentity profile={profile} />

          <div className="space-y-3">
            <CustomizationSection
              countLabel={sourceLabel(content.selections.customizedSummary)}
              icon={<FileText className="size-4" />}
              title="Summary"
            >
              <ComparisonRichTextField
                aiDocument={content.customizedSummary}
                aiLabel="AI-tailored summary"
                editorLabel="Edit AI CV summary"
                originalDocument={originalSummary}
                originalLabel="Profile summary"
                selection={selectionOrAi(content.selections.customizedSummary)}
                selectionLabel="Summary source"
                onAiChange={(customizedSummary) =>
                  onContentChange({ ...content, customizedSummary })
                }
                onSelectionChange={(selection) =>
                  onContentChange(updateTopLevelSelection(content, "customizedSummary", selection))
                }
              />
            </CustomizationSection>

            <CustomizationSection
              countLabel={formatItemCount(experienceIndexes.length)}
              icon={<BriefcaseBusiness className="size-4" />}
              title="Experience"
            >
              {experienceIndexes.length > 0 ? (
                <div className="space-y-4">
                  {experienceIndexes.map((index) => {
                    const experience = profile?.experience[index];
                    const enhancement = content.experienceEnhancements.find(
                      (item) => item.experienceIndex === index,
                    );
                    const selection = content.selections.experience[String(index)];
                    const originalDescription =
                      experience?.descriptionRichText ??
                      (experience?.description
                        ? richDocumentFromText(experience.description)
                        : undefined);

                    return (
                      <ContentItemCard
                        key={index}
                        metadata={formatPeriod(experience?.startDate, experience?.endDate)}
                        title={
                          experience
                            ? `${experience.title} · ${experience.company}`
                            : `Experience ${index + 1}`
                        }
                      >
                        <ComparisonRichTextField
                          aiDocument={enhancement?.description}
                          aiLabel="AI-tailored description"
                          editorLabel={`Edit AI experience ${index + 1} description`}
                          originalDocument={originalDescription}
                          originalLabel="Profile description"
                          selection={selectionOrAi(selection?.description)}
                          selectionLabel={`Experience ${index + 1} description source`}
                          onAiChange={(description) =>
                            onContentChange(
                              updateEnhancementDescription(
                                content,
                                "experience",
                                index,
                                description,
                              ),
                            )
                          }
                          onSelectionChange={(source) =>
                            onContentChange(
                              updateItemSelection(content, "experience", index, source),
                            )
                          }
                        />
                      </ContentItemCard>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="No experience is available in the profile or AI draft." />
              )}
            </CustomizationSection>

            <CustomizationSection
              countLabel={formatItemCount(content.skillSuggestions.length, "suggestion")}
              icon={<Brain className="size-4" />}
              title="Skills"
            >
              <ListComparison
                aiLabel="AI-tailored skills"
                aiValues={content.skillSuggestions}
                itemName="skill"
                originalLabel="Profile skills"
                originalValues={profile?.skills ?? []}
                selection={selectionOrAi(content.selections.skills)}
                selectionLabel="Skills source"
                onAiChange={(skillSuggestions) => onContentChange({ ...content, skillSuggestions })}
                onSelectionChange={(selection) =>
                  onContentChange(updateTopLevelSelection(content, "skills", selection))
                }
              />
            </CustomizationSection>

            <CustomizationSection
              countLabel={formatItemCount(educationIndexes.length)}
              icon={<GraduationCap className="size-4" />}
              title="Education"
            >
              {educationIndexes.length > 0 ? (
                <div className="space-y-4">
                  {educationIndexes.map((index) => {
                    const education = profile?.education[index];
                    const enhancement = content.educationEnhancements.find(
                      (item) => item.educationIndex === index,
                    );
                    const selection = content.selections.education[String(index)];
                    const degree = [education?.degree, education?.field].filter(Boolean).join(", ");
                    const originalDescription =
                      education?.descriptionRichText ??
                      (education?.description
                        ? richDocumentFromText(education.description)
                        : undefined);

                    return (
                      <ContentItemCard
                        key={index}
                        metadata={[degree, formatPeriod(education?.startDate, education?.endDate)]
                          .filter(Boolean)
                          .join(" · ")}
                        title={education?.institution ?? `Education ${index + 1}`}
                      >
                        <ComparisonRichTextField
                          aiDocument={enhancement?.description}
                          aiLabel="AI-tailored details"
                          editorLabel={`Edit AI education ${index + 1} description`}
                          originalDocument={originalDescription}
                          originalLabel="Profile description"
                          selection={selectionOrAi(selection?.description)}
                          selectionLabel={`Education ${index + 1} description source`}
                          onAiChange={(description) =>
                            onContentChange(
                              updateEnhancementDescription(
                                content,
                                "education",
                                index,
                                description,
                              ),
                            )
                          }
                          onSelectionChange={(source) =>
                            onContentChange(
                              updateItemSelection(content, "education", index, source),
                            )
                          }
                        />
                      </ContentItemCard>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="No education is available in the profile or AI draft." />
              )}
            </CustomizationSection>

            <CustomizationSection
              countLabel={formatItemCount(projectIndexes.length)}
              icon={<Rocket className="size-4" />}
              title="Projects"
            >
              {projectIndexes.length > 0 ? (
                <div className="space-y-4">
                  {projectIndexes.map((index) => {
                    const project = profile?.projects[index];
                    const enhancement = content.projectEnhancements.find(
                      (item) => item.projectIndex === index,
                    );
                    const selection = content.selections.projects[String(index)];
                    const originalDescription = mergeRichDocumentsAsProse(
                      project?.descriptionRichText ??
                        (project?.description
                          ? richDocumentFromText(project.description)
                          : undefined),
                      ...(project?.achievements ?? []).map(richDocumentFromText),
                    );

                    return (
                      <ContentItemCard
                        key={index}
                        metadata={[project?.url, ...(project?.skills ?? [])]
                          .filter(Boolean)
                          .join(" · ")}
                        title={project?.name ?? `Project ${index + 1}`}
                      >
                        <ComparisonRichTextField
                          aiDocument={enhancement?.description}
                          aiLabel="AI-tailored description"
                          editorLabel={`Edit AI project ${index + 1} description`}
                          originalDocument={originalDescription}
                          originalLabel="Profile description"
                          selection={selectionOrAi(selection?.description)}
                          selectionLabel={`Project ${index + 1} description source`}
                          onAiChange={(description) =>
                            onContentChange(
                              updateEnhancementDescription(content, "projects", index, description),
                            )
                          }
                          onSelectionChange={(source) =>
                            onContentChange(updateItemSelection(content, "projects", index, source))
                          }
                        />
                      </ContentItemCard>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="No projects are available in the profile or AI draft." />
              )}
            </CustomizationSection>

            <CustomizationSection
              countLabel={formatItemCount(content.certificationSuggestions.length, "suggestion")}
              icon={<BadgeCheck className="size-4" />}
              title="Certifications"
            >
              <ListComparison
                aiLabel="AI-tailored certifications"
                aiValues={content.certificationSuggestions}
                itemName="certification"
                originalLabel="Profile certifications"
                originalValues={profile?.certifications ?? []}
                selection={selectionOrAi(content.selections.certifications)}
                selectionLabel="Certifications source"
                onAiChange={(certificationSuggestions) =>
                  onContentChange({ ...content, certificationSuggestions })
                }
                onSelectionChange={(selection) =>
                  onContentChange(updateTopLevelSelection(content, "certifications", selection))
                }
              />
            </CustomizationSection>

            <CustomizationSection
              countLabel={content.coverLetterContent ? "Draft ready" : "Empty draft"}
              icon={<Mail className="size-4" />}
              title="Cover Letter"
            >
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  This document has no profile-original version. Edit the generated draft directly.
                </p>
                <RichTextEditor
                  ariaLabel="Edit cover letter"
                  value={content.coverLetterContent ?? emptyDocument}
                  onChange={(coverLetterContent) =>
                    onContentChange({ ...content, coverLetterContent })
                  }
                />
              </div>
            </CustomizationSection>
          </div>
        </div>
      )}
    </section>
  );
}

function CustomizationSection({
  children,
  countLabel,
  icon,
  title,
}: {
  children: ReactNode;
  countLabel: string;
  icon: ReactNode;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background">
      <button
        aria-expanded={isOpen}
        aria-label={`Customize ${title}`}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-1 text-[0.7rem] font-medium text-muted-foreground">
            {countLabel}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </span>
      </button>
      {isOpen && <div className="border-t border-border p-4">{children}</div>}
    </section>
  );
}

function ProfileIdentity({ profile }: { profile?: ApiProfile }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {profile?.fullName ?? "Profile identity unavailable"}
          </p>
          {profile && (
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {[profile.email, profile.location, ...profile.links].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Identity and contact details stay linked to your profile.
          </p>
        </div>
      </div>
      <Link className={buttonVariants({ size: "sm", variant: "outline" })} to="/profile">
        Edit profile
      </Link>
    </div>
  );
}

function ComparisonRichTextField({
  aiDocument,
  aiLabel,
  editorLabel,
  onAiChange,
  onSelectionChange,
  originalDocument,
  originalLabel,
  selection,
  selectionLabel,
}: {
  aiDocument?: RichDocument;
  aiLabel: string;
  editorLabel: string;
  onAiChange: (document: RichDocument) => void;
  onSelectionChange: (selection: SelectionSource) => void;
  originalDocument?: RichDocument;
  originalLabel: string;
  selection: SelectionSource;
  selectionLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Content source</p>
        <SourceToggle label={selectionLabel} onChange={onSelectionChange} value={selection} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={comparisonPanelClass(selection === "original")}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {originalLabel}
          </p>
          {originalDocument ? (
            <RichTextViewer
              ariaLabel={`${selectionLabel} original content`}
              value={originalDocument}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No separate profile text is available. Selecting Profile omits this tailored detail.
            </p>
          )}
        </div>
        <div className={comparisonPanelClass(selection === "ai")}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            {aiLabel}
          </p>
          <RichTextEditor
            ariaLabel={editorLabel}
            onChange={onAiChange}
            value={aiDocument ?? emptyDocument}
          />
        </div>
      </div>
    </div>
  );
}

function ListComparison({
  aiLabel,
  aiValues,
  itemName,
  onAiChange,
  onSelectionChange,
  originalLabel,
  originalValues,
  selection,
  selectionLabel,
}: {
  aiLabel: string;
  aiValues: string[];
  itemName: string;
  onAiChange: (values: string[]) => void;
  onSelectionChange: (selection: SelectionSource) => void;
  originalLabel: string;
  originalValues: string[];
  selection: SelectionSource;
  selectionLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Content source</p>
        <SourceToggle label={selectionLabel} onChange={onSelectionChange} value={selection} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={comparisonPanelClass(selection === "original")}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {originalLabel}
          </p>
          <ReadOnlyTags
            emptyMessage={`No profile ${itemName}s available.`}
            values={originalValues}
          />
        </div>
        <div className={comparisonPanelClass(selection === "ai")}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
            {aiLabel}
          </p>
          <TagEditor itemName={itemName} onChange={onAiChange} values={aiValues} />
        </div>
      </div>
    </div>
  );
}

function TagEditor({
  itemName,
  onChange,
  values,
}: {
  itemName: string;
  onChange: (values: string[]) => void;
  values: string[];
}) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const value = draft.trim();
    if (!value || values.some((candidate) => candidate.toLowerCase() === value.toLowerCase()))
      return;
    onChange([...values, value]);
    setDraft("");
  }

  function moveValue(index: number, offset: -1 | 1) {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= values.length) return;
    const next = [...values];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {values.length > 0 ? (
        <div className="space-y-2">
          {values.map((value, index) => (
            <div
              className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2"
              key={`${value}-${index}`}
            >
              <span className="min-w-0 break-words text-xs font-medium text-foreground">
                {value}
              </span>
              <span className="flex shrink-0 items-center gap-0.5">
                <TagAction
                  disabled={index === 0}
                  label={`Move ${value} earlier`}
                  onClick={() => moveValue(index, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </TagAction>
                <TagAction
                  disabled={index === values.length - 1}
                  label={`Move ${value} later`}
                  onClick={() => moveValue(index, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </TagAction>
                <TagAction
                  label={`Remove ${value}`}
                  onClick={() =>
                    onChange(values.filter((_, candidateIndex) => candidateIndex !== index))
                  }
                >
                  <X className="size-3.5" />
                </TagAction>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No AI suggestions yet. Add one below.</p>
      )}
      <div className="flex gap-2">
        <input
          aria-label={`Add AI ${itemName}`}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          placeholder={`Add ${itemName}`}
          value={draft}
        />
        <button
          aria-label={`Add ${itemName}`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          disabled={!draft.trim()}
          onClick={addValue}
          type="button"
        >
          <Plus className="size-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

function TagAction({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ReadOnlyTags({ emptyMessage, values }: { emptyMessage: string; values: string[] }) {
  return values.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium" key={value}>
          {value}
        </span>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  );
}

function SourceToggle({
  aiLabel = "Use AI",
  label,
  onChange,
  originalLabel = "Use profile",
  value,
}: {
  aiLabel?: string;
  label: string;
  onChange: (value: SelectionSource) => void;
  originalLabel?: string;
  value: SelectionSource;
}) {
  const options = [
    { label: aiLabel, value: "ai" as const },
    { label: originalLabel, value: "original" as const },
  ];

  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((option) => (
        <button
          aria-label={`${label}: ${option.label}`}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ContentItemCard({
  children,
  metadata,
  title,
}: {
  children: ReactNode;
  metadata?: string;
  title: string;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div>
        <h5 className="text-sm font-semibold text-foreground">{title}</h5>
        {metadata && <p className="mt-0.5 text-xs text-muted-foreground">{metadata}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function PreferenceFields({
  onChange,
  preferences,
  templates,
}: {
  onChange: (preferences: ApiApplicationPackPreferences) => void;
  preferences: ApiApplicationPackPreferences;
  templates: HtmlTemplateDefinition[];
}) {
  const cvTemplates = templates.filter((template) => template.kind === "cv");
  const coverTemplates = templates.filter((template) => template.kind === "cover_letter");

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SelectField
        label="Language"
        onChange={(language) => onChange({ ...preferences, language })}
        options={[
          { label: "Auto-detect", value: "auto" },
          { label: "English", value: "en" },
          { label: "Turkish", value: "tr" },
          { label: "German", value: "de" },
          { label: "French", value: "fr" },
        ]}
        value={preferences.language}
      />
      <SelectField
        label="Tone"
        onChange={(tone) =>
          onChange({
            ...preferences,
            tone: tone as ApiApplicationPackPreferences["tone"],
          })
        }
        options={[
          { label: "Professional", value: "professional" },
          { label: "Concise", value: "concise" },
          { label: "Creative", value: "creative" },
        ]}
        value={preferences.tone}
      />
      <TemplateSelect
        kind="CV"
        onChange={(cvTemplateId) =>
          onChange({
            ...preferences,
            ...(cvTemplateId ? { cvTemplateId } : { cvTemplateId: undefined }),
          })
        }
        selectedId={preferences.cvTemplateId}
        templates={cvTemplates}
      />
      <TemplateSelect
        kind="Cover letter"
        onChange={(coverLetterTemplateId) =>
          onChange({
            ...preferences,
            ...(coverLetterTemplateId
              ? { coverLetterTemplateId }
              : { coverLetterTemplateId: undefined }),
          })
        }
        selectedId={preferences.coverLetterTemplateId}
        templates={coverTemplates}
      />
    </div>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <select
        aria-label={label}
        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TemplateSelect({
  kind,
  onChange,
  selectedId,
  templates,
}: {
  kind: string;
  onChange: (templateId: string | undefined) => void;
  selectedId?: string;
  templates: HtmlTemplateDefinition[];
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {kind} template
      <select
        aria-label={`${kind} template`}
        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        onChange={(event) => onChange(event.target.value || undefined)}
        value={selectedId ?? ""}
      >
        <option value="">Default layout</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function updateTopLevelSelection(
  content: ApiDocumentContent,
  field: "certifications" | "customizedSummary" | "skills",
  value: SelectionSource,
): ApiDocumentContent {
  return {
    ...content,
    selections: { ...content.selections, [field]: value },
  };
}

function updateItemSelection(
  content: ApiDocumentContent,
  section: EnhancementSection,
  itemIndex: number,
  value: SelectionSource,
): ApiDocumentContent {
  const sectionSelections = content.selections[section] ?? {};
  const key = String(itemIndex);

  return {
    ...content,
    formatVersion: 2,
    selections: {
      ...content.selections,
      [section]: { ...sectionSelections, [key]: { description: value } },
    },
  };
}

function updateEnhancementDescription(
  content: ApiDocumentContent,
  section: EnhancementSection,
  itemIndex: number,
  description: RichDocument,
): ApiDocumentContent {
  if (section === "experience") {
    const enhancement = content.experienceEnhancements.find(
      (item) => item.experienceIndex === itemIndex,
    ) ?? { experienceIndex: itemIndex };
    return {
      ...content,
      formatVersion: 2,
      experienceEnhancements: replaceEnhancement(
        content.experienceEnhancements,
        "experienceIndex",
        itemIndex,
        { ...enhancement, description },
      ),
    };
  }
  if (section === "education") {
    const enhancement = content.educationEnhancements.find(
      (item) => item.educationIndex === itemIndex,
    ) ?? { educationIndex: itemIndex };
    return {
      ...content,
      formatVersion: 2,
      educationEnhancements: replaceEnhancement(
        content.educationEnhancements,
        "educationIndex",
        itemIndex,
        { ...enhancement, description },
      ),
    };
  }
  const enhancement = content.projectEnhancements.find(
    (item) => item.projectIndex === itemIndex,
  ) ?? { projectIndex: itemIndex };
  return {
    ...content,
    formatVersion: 2,
    projectEnhancements: replaceEnhancement(
      content.projectEnhancements,
      "projectIndex",
      itemIndex,
      { ...enhancement, description },
    ),
  };
}

function replaceEnhancement<T extends Record<K, number>, K extends keyof T>(
  enhancements: T[],
  indexField: K,
  index: number,
  updated: T,
): T[] {
  return [...enhancements.filter((item) => item[indexField] !== index), updated].sort(
    (left, right) => left[indexField] - right[indexField],
  );
}

function collectIndexes(profileCount: number, enhancementIndexes: number[]): number[] {
  return Array.from(
    new Set([...Array.from({ length: profileCount }, (_, index) => index), ...enhancementIndexes]),
  ).sort((left, right) => left - right);
}

function selectionOrAi(selection?: SelectionSource): SelectionSource {
  return selection === "original" ? "original" : "ai";
}

function sourceLabel(selection?: SelectionSource): string {
  return selection === "original" ? "Profile" : "AI-tailored";
}

function formatItemCount(count: number, noun = "item"): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function formatPeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return "";
  return `${startDate || "Start not set"} – ${endDate || "Present"}`;
}

function comparisonPanelClass(selected: boolean): string {
  return cn(
    "rounded-lg border p-4 transition-colors",
    selected ? "border-primary/40 bg-primary/5" : "border-border bg-card",
  );
}
