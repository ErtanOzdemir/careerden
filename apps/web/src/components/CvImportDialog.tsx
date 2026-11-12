import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Link } from "react-router-dom";
import { aiProviderFailureSchema } from "@careerden/contracts";
import { FileUp, Loader2 } from "lucide-react";
import { Modal } from "./careerden/modal.js";
import { Button, buttonVariants } from "./ui/button.js";
import { ApiError, hasApiErrorCode } from "../api/client.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiProfile, ApiProfileImportDraft } from "../api/types.js";
import { isLocalEdition } from "../edition.js";
import { describeAiFailure } from "../lib/ai-failure-notice.js";
import { aiProviderPath } from "../settings/AiProviderSettings.js";

const acceptedCvTypes =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const maximumCvSize = 10 * 1024 * 1024;

const importSections = [
  "basics",
  "summary",
  "skillGroups",
  "experience",
  "education",
  "projects",
  "certifications",
] as const;

export type CvImportSection = (typeof importSections)[number];

const sectionLabels: Record<CvImportSection, string> = {
  basics: "Basic information",
  summary: "Professional summary",
  skillGroups: "Skills",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
};

const basicFields = ["fullName", "email", "headline", "profession", "location", "links"] as const;

/** The sections the draft has content for, in display order. */
export function availableSections(draft: ApiProfileImportDraft): CvImportSection[] {
  return importSections.filter((section) =>
    section === "basics"
      ? basicFields.some((field) => {
          const value = draft[field];
          return Array.isArray(value) ? value.length > 0 : Boolean(value);
        })
      : section === "summary"
        ? Boolean(draft.summary)
        : (draft[section]?.length ?? 0) > 0,
  );
}

/** Keeps only the fields of the sections the user chose to import. */
export function selectDraftSections(
  draft: ApiProfileImportDraft,
  sections: ReadonlySet<CvImportSection>,
): ApiProfileImportDraft {
  const selected: ApiProfileImportDraft = {};
  if (sections.has("basics")) {
    for (const field of basicFields) {
      if (draft[field] !== undefined) Object.assign(selected, { [field]: draft[field] });
    }
  }
  for (const section of importSections) {
    if (section === "basics" || !sections.has(section) || draft[section] === undefined) continue;
    Object.assign(selected, { [section]: draft[section] });
  }
  return selected;
}

type Stage =
  | { kind: "pick" }
  | { kind: "reading"; fileName: string }
  | { kind: "review"; draft: ApiProfileImportDraft; sections: Set<CvImportSection> };

interface ImportError {
  message: string;
  showSettings: boolean;
}

export function CvImportDialog({
  open,
  onClose,
  onApplied,
  inOnboarding = false,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: (profile: ApiProfile) => void;
  // The wizard hides the app's routes, so a missing provider points back to its own step.
  inOnboarding?: boolean;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [error, setError] = useState<ImportError | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    if (stage.kind === "reading" || isApplying) return;
    setStage({ kind: "pick" });
    setError(null);
    onClose();
  }

  async function readCv(file: File) {
    if (file.size > maximumCvSize) {
      setError({ message: "CV must not exceed 10 MB.", showSettings: false });
      return;
    }

    setError(null);
    setStage({ kind: "reading", fileName: file.name });
    try {
      const draft = await profilesApi.extractFromCv(file);
      const sections = availableSections(draft);
      if (sections.length === 0) {
        setStage({ kind: "pick" });
        setError({
          message: "We couldn't find any profile details in this CV.",
          showSettings: false,
        });
        return;
      }
      setStage({ kind: "review", draft, sections: new Set(sections) });
    } catch (readError) {
      setStage({ kind: "pick" });
      setError(describeImportError(readError, inOnboarding));
    }
  }

  async function apply() {
    if (stage.kind !== "review") return;
    setIsApplying(true);
    setError(null);
    try {
      const profile = await profilesApi.applyCvImport(
        selectDraftSections(stage.draft, stage.sections),
      );
      setStage({ kind: "pick" });
      onApplied(profile);
      onClose();
    } catch (applyError) {
      setError(describeImportError(applyError, inOnboarding));
    } finally {
      setIsApplying(false);
    }
  }

  function toggleSection(section: CvImportSection) {
    if (stage.kind !== "review") return;
    const sections = new Set(stage.sections);
    if (sections.has(section)) sections.delete(section);
    else sections.add(section);
    setStage({ ...stage, sections });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void readCv(file);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readCv(file);
  }

  return (
    <Modal open={open} onClose={close} className="max-w-2xl">
      <h2 className="pr-8 text-base font-semibold text-foreground">Import from your CV</h2>

      {stage.kind === "pick" && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your existing CV and we'll fill in your profile. You can review everything before
            it's saved.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-5 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
              isDragging ? "border-ring bg-muted" : "border-border hover:bg-muted/60"
            }`}
          >
            <FileUp className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Choose a file or drop it here
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, Word (.docx), or text · 10 MB
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={acceptedCvTypes}
            className="hidden"
            aria-label="CV file"
            onChange={handleFileChange}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {isLocalEdition
              ? "The file stays on this device. Only its text is sent to your AI provider to read it."
              : "The file is not stored. Only its text is sent to our AI provider to read it."}
          </p>
        </>
      )}

      {stage.kind === "reading" && (
        <div className="flex flex-col items-center gap-3 py-12 text-center" role="status">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Reading {stage.fileName}…</p>
          <p className="text-xs text-muted-foreground">This usually takes under a minute.</p>
        </div>
      )}

      {stage.kind === "review" && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what to add. Details you've already filled in are kept, and entries your profile
            already has are skipped.
          </p>
          <p
            role="note"
            className="mt-3 rounded-lg bg-warning-soft/60 px-3 py-2 text-xs text-foreground"
          >
            This was read from your CV with AI. Check it before applying; you can edit everything on
            your profile afterwards.
          </p>
          <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {availableSections(stage.draft).map((section) => (
              <label
                key={section}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={stage.sections.has(section)}
                  onChange={() => toggleSection(section)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {sectionLabels[section]}
                  </span>
                  <SectionPreview draft={stage.draft} section={section} />
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      {error && (
        <div role="alert" className="mt-4 text-sm text-destructive">
          {error.message}
          {error.showSettings && isLocalEdition && !inOnboarding && (
            <Link
              to={aiProviderPath}
              onClick={close}
              className={`${buttonVariants({ size: "sm", variant: "outline" })} ml-2`}
            >
              Open AI provider settings
            </Link>
          )}
        </div>
      )}

      {stage.kind === "review" && (
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={isApplying}
            onClick={() => setStage({ kind: "pick" })}
          >
            Choose another file
          </Button>
          <Button disabled={isApplying || stage.sections.size === 0} onClick={() => void apply()}>
            {isApplying ? "Applying…" : "Apply to profile"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function SectionPreview({
  draft,
  section,
}: {
  draft: ApiProfileImportDraft;
  section: CvImportSection;
}) {
  const lines = previewLines(draft, section);
  return (
    <span className="mt-1 block space-y-0.5 text-xs text-muted-foreground">
      {lines.map((line, index) => (
        <span key={index} className="block truncate">
          {line}
        </span>
      ))}
    </span>
  );
}

const maximumPreviewLines = 4;

function previewLines(draft: ApiProfileImportDraft, section: CvImportSection): string[] {
  const lines = ((): string[] => {
    switch (section) {
      case "basics":
        return [
          draft.fullName,
          [draft.headline ?? draft.profession, draft.location].filter(Boolean).join(" · "),
          draft.email,
          ...(draft.links ?? []),
        ].filter((line): line is string => Boolean(line));
      case "summary":
        return [draft.summary ?? ""];
      case "skillGroups":
        return (draft.skillGroups ?? []).map((group) =>
          [group.name, group.skills.join(", ")].filter(Boolean).join(": "),
        );
      case "certifications":
        return draft.certifications ?? [];
      case "experience":
        return (draft.experience ?? []).map((item) =>
          withDates(`${item.title} · ${item.company}`, item.startDate, item.endDate),
        );
      case "education":
        return (draft.education ?? []).map((item) =>
          withDates(
            [item.degree, item.field, item.institution].filter(Boolean).join(" · "),
            item.startDate,
            item.endDate,
          ),
        );
      case "projects":
        return (draft.projects ?? []).map((item) => item.name);
    }
  })();

  if (lines.length <= maximumPreviewLines) return lines;
  return [
    ...lines.slice(0, maximumPreviewLines - 1),
    `and ${lines.length - maximumPreviewLines + 1} more`,
  ];
}

function withDates(text: string, startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return text;
  return `${text} (${startDate ?? "?"} – ${endDate ?? "Present"})`;
}

function describeImportError(error: unknown, inOnboarding: boolean): ImportError {
  if (hasApiErrorCode(error, "ai_provider_not_configured")) {
    return {
      message: inOnboarding
        ? "Importing a CV needs an AI provider. Go back to the AI provider step to add one, or fill in your details yourself."
        : "Add an AI provider to import a CV.",
      showSettings: true,
    };
  }
  if (hasApiErrorCode(error, "ai_provider_error")) {
    const failure = aiProviderFailureSchema.safeParse(
      (error.details as { aiFailure?: unknown }).aiFailure,
    );
    if (failure.success) {
      const notice = describeAiFailure(failure.data, isLocalEdition);
      return { message: notice.message, showSettings: notice.showSettings };
    }
  }
  if (error instanceof ApiError && error.status === 404) {
    return { message: "CV import isn't available right now.", showSettings: false };
  }
  if (error instanceof ApiError && error.status >= 500) {
    return {
      message: "Something went wrong while reading your CV. Try again in a moment.",
      showSettings: false,
    };
  }
  return {
    message: error instanceof Error ? error.message : "Could not import your CV.",
    showSettings: false,
  };
}
