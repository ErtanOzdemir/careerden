import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ApiDocumentContent, RichDocument } from "../api/types";
import type { JobApplication } from "../types";
import RichTextEditor, { RichTextViewer } from "./RichTextEditor";

interface AiMatchCardProps {
  aiMatch: NonNullable<JobApplication["aiMatch"]>;
  canCreateCv: boolean;
  hasGeneratedDocuments: boolean;
  isCreatingCv: boolean;
  isSavingContent: boolean;
  documentContent: ApiDocumentContent;
  onSaveContent: (content: ApiDocumentContent) => Promise<void>;
  onCreateCv: () => Promise<void> | void;
}

const wizardSteps = [
  { label: "Match", icon: "analytics" },
  { label: "Summary", icon: "subject" },
  { label: "Experience", icon: "work_history" },
  { label: "Skills", icon: "psychology" },
  { label: "Approval", icon: "verified" },
] as const;

export default function AiMatchCard({
  aiMatch,
  canCreateCv,
  hasGeneratedDocuments,
  isCreatingCv,
  isSavingContent,
  documentContent,
  onSaveContent,
  onCreateCv,
}: AiMatchCardProps) {
  const [isOpen, setIsOpen] = useState(canCreateCv && !hasGeneratedDocuments);
  const [activeStep, setActiveStep] = useState(0);
  const [isApproved, setIsApproved] = useState(false);
  const [draftContent, setDraftContent] = useState(documentContent);

  const scoreRadius = 44;
  const circumference = 2 * Math.PI * scoreRadius;
  const offset = circumference - (aiMatch.score / 100) * circumference;
  const createDisabled = !canCreateCv || !isApproved || isCreatingCv || isSavingContent;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    setDraftContent(documentContent);
  }, [documentContent]);

  async function handleCreateCv() {
    if (createDisabled) {
      return;
    }

    if (JSON.stringify(draftContent) !== JSON.stringify(documentContent)) {
      await handleSaveContent(draftContent);
    }

    await onCreateCv();
    setIsOpen(false);
  }

  async function handleSaveContent(content: ApiDocumentContent) {
    await onSaveContent(content);
    setDraftContent(content);
    setIsApproved(false);
  }

  return (
    <>
      <section className="bg-inverse-surface text-inverse-on-surface p-lg rounded-xl shadow-lg">
        <div className="flex items-start justify-between gap-md mb-lg">
          <div>
            <h3 className="font-display font-headline-md flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-fixed-dim">auto_awesome</span>
              AI Match Intelligence
            </h3>
            <p className="text-body-sm opacity-70 mt-1">{aiMatch.recommendation}</p>
          </div>
          <span className="bg-primary px-3 py-1 rounded-full text-label-sm font-bold text-on-primary">
            {aiMatch.score}% Match
          </span>
        </div>

        <div className="grid grid-cols-[auto,1fr] gap-md items-center">
          <ScoreRing score={aiMatch.score} offset={offset} circumference={circumference} />
          <div className="min-w-0">
            <p className="text-body-md opacity-80 line-clamp-3">{aiMatch.summary}</p>
            <div className="mt-md flex flex-wrap gap-2">
              {aiMatch.keywords.slice(0, 4).map((kw) => (
                <span
                  key={kw.keyword}
                  className={`px-2 py-1 rounded text-label-sm border ${
                    kw.match
                      ? "border-success-fixed/50 bg-success/30 text-success-fixed"
                      : "border-error-fixed/50 bg-error/30 text-error-fixed"
                  }`}
                >
                  {kw.keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          className="mt-lg w-full bg-primary text-on-primary rounded-lg py-3 px-4 font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isCreatingCv}
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <span className="material-symbols-outlined">rate_review</span>
          {hasGeneratedDocuments ? "Review and regenerate CV" : "Review Match"}
        </button>
      </section>

      {isOpen &&
        createPortal(
          <div
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/50 p-sm backdrop-blur-sm sm:p-md"
            role="dialog"
          >
            <section className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface text-on-surface shadow-2xl sm:max-h-[90dvh]">
              <header className="flex shrink-0 items-start justify-between gap-md border-b border-outline-variant p-md sm:p-lg">
                <div>
                  <h3 className="font-display font-headline-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                    AI Match Intelligence
                  </h3>
                  <p className="text-body-sm text-secondary mt-1">
                    {hasGeneratedDocuments
                      ? "Review and regenerate documents"
                      : "Review AI changes"}
                  </p>
                </div>
                <button
                  className="material-symbols-outlined p-2 rounded-full hover:bg-surface-container-high cursor-pointer"
                  onClick={() => setIsOpen(false)}
                  title="Close"
                  type="button"
                >
                  close
                </button>
              </header>

              <div className="wizard-tabs shrink-0 overflow-x-auto border-b border-outline-variant px-md pt-sm sm:px-lg sm:pt-md">
                <div className="flex min-w-max gap-2">
                  {wizardSteps.map((step, index) => (
                    <button
                      key={step.label}
                      className={`px-3 py-2 border-b-2 text-label-md font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                        activeStep === index
                          ? "border-primary text-primary"
                          : "border-transparent text-secondary hover:text-on-surface"
                      }`}
                      onClick={() => setActiveStep(index)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                      {step.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-md sm:p-lg">
                {activeStep === 0 && <MatchStep aiMatch={aiMatch} />}
                {activeStep === 1 && (
                  <SummaryStep
                    aiMatch={aiMatch}
                    document={draftContent.customizedSummary}
                    isSaving={isSavingContent}
                    onSave={(customizedSummary) =>
                      handleSaveContent({ ...draftContent, customizedSummary })
                    }
                  />
                )}
                {activeStep === 2 && (
                  <ExperienceStep
                    aiMatch={aiMatch}
                    documentContent={draftContent}
                    isSaving={isSavingContent}
                    onSave={handleSaveContent}
                  />
                )}
                {activeStep === 3 && <SkillsStep aiMatch={aiMatch} />}
                {activeStep === 4 && (
                  <ApprovalStep
                    canCreateCv={canCreateCv}
                    hasGeneratedDocuments={hasGeneratedDocuments}
                    isApproved={isApproved}
                    isCreatingCv={isCreatingCv}
                    onApprovalChange={setIsApproved}
                  />
                )}
              </div>

              <footer className="flex shrink-0 flex-col justify-between gap-md border-t border-outline-variant p-md sm:flex-row sm:items-center sm:p-lg">
                <button
                  className="px-4 py-2 rounded-lg border border-outline-variant text-secondary hover:bg-surface-container-high cursor-pointer disabled:opacity-50"
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
                  type="button"
                >
                  Back
                </button>
                <div className="flex gap-2 justify-end">
                  {activeStep < wizardSteps.length - 1 ? (
                    <button
                      className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold flex items-center gap-2 cursor-pointer"
                      onClick={() =>
                        setActiveStep((current) => Math.min(wizardSteps.length - 1, current + 1))
                      }
                      type="button"
                    >
                      Next
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={createDisabled}
                      onClick={() => void handleCreateCv()}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {hasGeneratedDocuments ? "check_circle" : "description"}
                      </span>
                      {isCreatingCv
                        ? "Creating..."
                        : hasGeneratedDocuments
                          ? "Regenerate CV"
                          : "Create CV"}
                    </button>
                  )}
                </div>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

function ScoreRing({
  circumference,
  offset,
  score,
}: {
  circumference: number;
  offset: number;
  score: number;
}) {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90">
        <circle
          className="text-on-surface-variant opacity-30"
          cx="48"
          cy="48"
          fill="transparent"
          r="44"
          stroke="currentColor"
          strokeWidth="7"
        />
        <circle
          className="text-primary-fixed-dim"
          cx="48"
          cy="48"
          fill="transparent"
          r="44"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="7"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-headline-md text-primary-fixed-dim leading-none">
          {score}
        </span>
        <span className="text-label-sm uppercase opacity-70">Match</span>
      </div>
    </div>
  );
}

function MatchStep({ aiMatch }: { aiMatch: NonNullable<JobApplication["aiMatch"]> }) {
  const matchedKeywords = aiMatch.keywords.filter((keyword) => keyword.match);
  const missingKeywords = aiMatch.keywords.filter((keyword) => !keyword.match);

  return (
    <div className="space-y-lg">
      <div className="grid md:grid-cols-3 gap-md">
        <Metric label="Match Score" value={`${aiMatch.score}%`} />
        <Metric label="Strong Skills" value={String(aiMatch.yourSkills.length)} />
        <Metric label="Suggested Skills" value={String(aiMatch.suggestedSkills.length)} />
      </div>
      <section className="space-y-md">
        <h4 className="text-label-md font-bold uppercase text-secondary">Keyword Analysis</h4>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <KeywordGroup
            emptyMessage="No matched keywords"
            icon="check_circle"
            keywords={matchedKeywords.map((keyword) => keyword.keyword)}
            label="Matched Keywords"
            tone="matched"
          />
          <KeywordGroup
            emptyMessage="No missing keywords"
            icon="cancel"
            keywords={missingKeywords.map((keyword) => keyword.keyword)}
            label="Missing Keywords"
            tone="missing"
          />
        </div>
      </section>
    </div>
  );
}

function KeywordGroup(props: {
  emptyMessage: string;
  icon: string;
  keywords: string[];
  label: string;
  tone: "matched" | "missing";
}) {
  const isMatched = props.tone === "matched";

  return (
    <div
      className={`min-h-36 rounded-lg border p-md ${
        isMatched
          ? "border-success-outline bg-success-container"
          : "border-error/50 bg-error-container"
      }`}
    >
      <div
        className={`mb-md flex items-center justify-between gap-sm ${
          isMatched ? "text-on-success-container" : "text-on-error-container"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">{props.icon}</span>
          <h5 className="text-label-md font-bold">{props.label}</h5>
        </div>
        <span className="text-label-md font-bold">{props.keywords.length}</span>
      </div>

      {props.keywords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {props.keywords.map((keyword) => (
            <span
              key={keyword}
              className={`flex items-center gap-1 rounded-lg border bg-white/70 px-3 py-1 text-label-md ${
                isMatched
                  ? "border-success-outline text-on-success-container"
                  : "border-error/50 text-on-error-container"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isMatched ? "check" : "close"}
              </span>
              {keyword}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant">{props.emptyMessage}</p>
      )}
    </div>
  );
}

function SummaryStep({
  aiMatch,
  document,
  isSaving,
  onSave,
}: {
  aiMatch: NonNullable<JobApplication["aiMatch"]>;
  document: RichDocument;
  isSaving: boolean;
  onSave: (document: RichDocument) => Promise<void>;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-md">
      <TextPanel
        label="Your Input"
        title="Current Profile Summary"
        tone="neutral"
        value={aiMatch.currentSummary}
      />
      <section className="rounded-lg border border-primary/40 bg-primary/10 p-md">
        <span className="inline-flex px-2 py-1 rounded text-label-sm font-bold mb-sm bg-primary/20 text-primary">
          AI Enhanced
        </span>
        <EditableRichDocumentField
          ariaLabel="Tailored CV summary"
          document={document}
          isSaving={isSaving}
          onSave={onSave}
          title="Tailored CV Summary"
        />
      </section>
    </div>
  );
}

function ExperienceStep({
  aiMatch,
  documentContent,
  isSaving,
  onSave,
}: {
  aiMatch: NonNullable<JobApplication["aiMatch"]>;
  documentContent: ApiDocumentContent;
  isSaving: boolean;
  onSave: (content: ApiDocumentContent) => Promise<void>;
}) {
  const optimizations =
    aiMatch.experienceOptimizations && aiMatch.experienceOptimizations.length > 0
      ? aiMatch.experienceOptimizations
      : [
          {
            title: "Profile achievements",
            company: "Current profile",
            items: aiMatch.bulletOptimizations.map((item) => ({
              actual: item.original,
              enhanced: item.enhanced,
              kind: "achievement" as const,
            })),
          },
        ];

  return (
    <div className="space-y-lg">
      {optimizations.map((experience, experienceIndex) => (
        <section
          key={`${experience.company}-${experience.title}`}
          className="rounded-lg border border-outline-variant bg-surface-container-low p-md space-y-md"
        >
          <div>
            <h4 className="text-body-lg font-bold">{experience.title}</h4>
            <p className="text-body-sm text-secondary">{experience.company}</p>
          </div>
          {experience.items.length > 0 ? (
            <div className="space-y-md">
              {experience.items.map((item, index) => {
                const enhancement = documentContent.experienceEnhancements.find(
                  (candidate) => candidate.experienceIndex === experienceIndex,
                );
                const achievementIndex = experience.items
                  .slice(0, index)
                  .filter((candidate) => candidate.kind === "achievement").length;
                const document =
                  item.kind === "description"
                    ? enhancement?.description
                    : enhancement?.achievements[achievementIndex];

                return (
                  <ExperienceComparisonRow
                    key={`${item.kind}-${item.actual}-${index}`}
                    actual={item.actual}
                    document={document}
                    isSaving={isSaving}
                    kind={item.kind}
                    onSave={(updatedDocument) =>
                      onSave(
                        updateExperienceDocument(
                          documentContent,
                          experienceIndex,
                          item.kind,
                          achievementIndex,
                          updatedDocument,
                        ),
                      )
                    }
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-outline-variant bg-surface px-md py-sm text-body-md text-secondary">
              No descriptions or achievements added for this experience.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function SkillsStep({ aiMatch }: { aiMatch: NonNullable<JobApplication["aiMatch"]> }) {
  return (
    <div className="grid md:grid-cols-2 gap-md">
      <TagPanel label="Your Input" skills={aiMatch.yourSkills} title="Current Skills" />
      <TagPanel label="AI Suggested" skills={aiMatch.suggestedSkills} title="Suggested Additions" />
    </div>
  );
}

function ApprovalStep({
  canCreateCv,
  hasGeneratedDocuments,
  isApproved,
  isCreatingCv,
  onApprovalChange,
}: {
  canCreateCv: boolean;
  hasGeneratedDocuments: boolean;
  isApproved: boolean;
  isCreatingCv: boolean;
  onApprovalChange: (value: boolean) => void;
}) {
  return (
    <div className="w-full max-w-3xl space-y-lg">
      <div className="w-full rounded-xl border border-outline-variant bg-surface-container-low p-5 sm:p-6">
        <h4 className="flex items-center gap-2 whitespace-nowrap text-body-lg font-bold">
          <span className="material-symbols-outlined text-[20px] text-primary">
            {hasGeneratedDocuments ? "check_circle" : "verified"}
          </span>
          <span>{hasGeneratedDocuments ? "Regenerate CV" : "Approve AI changes"}</span>
        </h4>
        {hasGeneratedDocuments ? (
          <div className="mt-3 flex min-h-20 w-full items-center gap-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-4">
            <span className="material-symbols-outlined text-[28px] text-primary">folder_zip</span>
            <div className="min-w-0">
              <div className="text-body-md font-semibold text-on-surface">
                Generated files ready
              </div>
              <div className="text-body-sm text-secondary">
                Save any edits, approve them, then regenerate to replace the current files.
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-body-md text-secondary">
            {canCreateCv
              ? "Your current profile inputs and AI-enhanced content are ready for document generation."
              : "AI analysis is not ready for document generation yet."}
          </p>
        )}
      </div>

      <label className="flex w-full items-start gap-3 rounded-lg border border-outline-variant p-md cursor-pointer">
        <input
          checked={isApproved}
          className="mt-1 h-4 w-4 accent-primary"
          disabled={!canCreateCv || isCreatingCv}
          onChange={(event) => onApprovalChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block font-bold">I approve these CV changes.</span>
          <span className="block text-body-sm text-secondary mt-1">
            {hasGeneratedDocuments
              ? "Replace the generated CV and cover letter with the saved content."
              : "Create the CV and cover letter from this saved content."}
          </span>
        </span>
      </label>
    </div>
  );
}

function TextPanel({
  label,
  title,
  tone,
  value,
}: {
  label: string;
  title: string;
  tone: "neutral" | "primary";
  value: string;
}) {
  return (
    <section
      className={`rounded-lg border p-md ${
        tone === "primary"
          ? "border-primary/40 bg-primary/10"
          : "border-outline-variant bg-surface-container-low"
      }`}
    >
      <span
        className={`inline-flex px-2 py-1 rounded text-label-sm font-bold mb-sm ${
          tone === "primary" ? "bg-primary/20 text-primary" : "bg-surface-container-high"
        }`}
      >
        {label}
      </span>
      <h4 className="text-body-lg font-bold mb-sm">{title}</h4>
      <p className="text-body-md text-on-surface-variant">{value}</p>
    </section>
  );
}

function ExperienceComparisonRow({
  actual,
  document,
  isSaving,
  kind,
  onSave,
}: {
  actual: string;
  document?: RichDocument;
  isSaving: boolean;
  kind: "achievement" | "description";
  onSave: (document: RichDocument) => Promise<void>;
}) {
  return (
    <section className="rounded-lg bg-surface p-md">
      <div className="mb-sm flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">
          {kind === "description" ? "subject" : "military_tech"}
        </span>
        <span className="text-label-md font-bold uppercase text-secondary">
          {kind === "description" ? "Role Description" : "Achievement"}
        </span>
      </div>
      <div className="grid gap-md md:grid-cols-2 md:divide-x md:divide-outline-variant">
        <div className="space-y-xs">
          <span className="text-label-sm font-bold uppercase text-secondary">Actual Version</span>
          <p className="text-body-md text-on-surface-variant">{actual}</p>
        </div>
        <div className="space-y-xs md:pl-md">
          <span className="text-label-sm font-bold uppercase text-primary">
            AI Enhanced Version
          </span>
          {document ? (
            <EditableRichDocumentField
              ariaLabel={`Enhanced ${kind}`}
              document={document}
              isSaving={isSaving}
              onSave={onSave}
            />
          ) : (
            <p className="text-body-md text-on-surface-variant">
              No AI-enhanced version available for this item.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function EditableRichDocumentField({
  ariaLabel,
  document,
  isSaving,
  onSave,
  title,
}: {
  ariaLabel: string;
  document: RichDocument;
  isSaving: boolean;
  onSave: (document: RichDocument) => Promise<void>;
  title?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(document);

  useEffect(() => {
    if (!isEditing) {
      setDraft(document);
    }
  }, [document, isEditing]);

  function cancelEditing() {
    setDraft(document);
    setIsEditing(false);
  }

  async function saveEditing() {
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch {
      // The parent displays the API error and the local draft remains available.
    }
  }

  return (
    <div>
      <div className="mb-sm flex items-center justify-between gap-sm">
        {title ? <h4 className="text-body-lg font-bold">{title}</h4> : <span />}
        {!isEditing && (
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-label-md font-bold text-primary hover:bg-primary/10"
            disabled={isSaving}
            onClick={() => setIsEditing(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-sm">
          <RichTextEditor ariaLabel={ariaLabel} onChange={setDraft} value={draft} />
          <div className="flex justify-end gap-2">
            <button
              className="rounded-lg border border-outline-variant px-3 py-2 text-label-md font-bold text-secondary hover:bg-surface-container-high disabled:opacity-60"
              disabled={isSaving}
              onClick={cancelEditing}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-label-md font-bold text-on-primary disabled:opacity-60"
              disabled={isSaving}
              onClick={() => void saveEditing()}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <RichTextViewer ariaLabel={ariaLabel} value={document} />
      )}
    </div>
  );
}

function updateExperienceDocument(
  content: ApiDocumentContent,
  experienceIndex: number,
  kind: "achievement" | "description",
  achievementIndex: number,
  document: RichDocument,
): ApiDocumentContent {
  const existing = content.experienceEnhancements.find(
    (enhancement) => enhancement.experienceIndex === experienceIndex,
  ) ?? {
    experienceIndex,
    achievements: [],
  };
  const updated =
    kind === "description"
      ? { ...existing, description: document }
      : {
          ...existing,
          achievements: existing.achievements.map((achievement, index) =>
            index === achievementIndex ? document : achievement,
          ),
        };

  return {
    ...content,
    experienceEnhancements: [
      ...content.experienceEnhancements.filter(
        (enhancement) => enhancement.experienceIndex !== experienceIndex,
      ),
      updated,
    ].sort((left, right) => left.experienceIndex - right.experienceIndex),
  };
}

function TagPanel({ label, skills, title }: { label: string; skills: string[]; title: string }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-low p-md">
      <span className="inline-flex px-2 py-1 rounded text-label-sm font-bold mb-sm bg-surface-container-high">
        {label}
      </span>
      <h4 className="text-body-lg font-bold mb-sm">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {skills.length > 0 ? (
          skills.map((skill) => (
            <span
              key={skill}
              className="px-3 py-1 rounded-lg border border-outline-variant bg-surface text-label-md"
            >
              {skill}
            </span>
          ))
        ) : (
          <span className="text-body-md text-secondary">No items</span>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-low p-md">
      <p className="text-label-md text-secondary uppercase font-bold">{label}</p>
      <p className="text-headline-md font-display mt-1">{value}</p>
    </section>
  );
}
