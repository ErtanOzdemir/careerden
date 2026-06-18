import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { JobApplication } from "../types";

interface AiMatchCardProps {
  aiMatch: NonNullable<JobApplication["aiMatch"]>;
  canCreateCv: boolean;
  hasGeneratedDocuments: boolean;
  isCreatingCv: boolean;
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
  onCreateCv,
}: AiMatchCardProps) {
  const [isOpen, setIsOpen] = useState(canCreateCv && !hasGeneratedDocuments);
  const [activeStep, setActiveStep] = useState(0);
  const [isApproved, setIsApproved] = useState(false);

  const scoreRadius = 44;
  const circumference = 2 * Math.PI * scoreRadius;
  const offset = circumference - (aiMatch.score / 100) * circumference;
  const createDisabled = !canCreateCv || !isApproved || isCreatingCv || hasGeneratedDocuments;

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

  async function handleCreateCv() {
    if (createDisabled) {
      return;
    }

    await onCreateCv();
    setIsOpen(false);
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
                      ? "bg-green-500/20 text-green-300 border-green-500/30"
                      : "bg-red-500/20 text-red-300 border-red-500/30"
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
          {hasGeneratedDocuments ? "Review Created CV" : "Review Match"}
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
                    {hasGeneratedDocuments ? "Documents created" : "Review AI changes"}
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
                {activeStep === 1 && <SummaryStep aiMatch={aiMatch} />}
                {activeStep === 2 && <ExperienceStep aiMatch={aiMatch} />}
                {activeStep === 3 && <SkillsStep aiMatch={aiMatch} />}
                {activeStep === 4 && (
                  <ApprovalStep
                    canCreateCv={canCreateCv}
                    hasGeneratedDocuments={hasGeneratedDocuments}
                    isApproved={isApproved}
                    isCreatingCv={isCreatingCv}
                    onApprovalChange={setIsApproved}
                    onCreateCv={handleCreateCv}
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
                          ? "CV Created"
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
  return (
    <div className="space-y-lg">
      <div className="grid md:grid-cols-3 gap-md">
        <Metric label="Match Score" value={`${aiMatch.score}%`} />
        <Metric label="Strong Skills" value={String(aiMatch.yourSkills.length)} />
        <Metric label="Suggested Skills" value={String(aiMatch.suggestedSkills.length)} />
      </div>
      <section className="space-y-md">
        <h4 className="text-label-md font-bold uppercase text-secondary">Keyword Analysis</h4>
        <div className="flex flex-wrap gap-2">
          {aiMatch.keywords.map((kw) => (
            <span
              key={kw.keyword}
              className={`px-3 py-1 rounded-lg text-label-md border flex items-center gap-1 ${
                kw.match
                  ? "bg-green-500/10 text-green-700 border-green-500/30"
                  : "bg-red-500/10 text-red-700 border-red-500/30"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {kw.match ? "check" : "close"}
              </span>
              {kw.keyword}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryStep({ aiMatch }: { aiMatch: NonNullable<JobApplication["aiMatch"]> }) {
  return (
    <CompareColumns
      enhancedLabel="AI Enhanced Summary"
      enhancedTitle="Tailored CV Summary"
      enhancedValue={aiMatch.enhancedSummary}
      originalLabel="Your Input"
      originalTitle="Current Profile Summary"
      originalValue={aiMatch.currentSummary}
    />
  );
}

function ExperienceStep({ aiMatch }: { aiMatch: NonNullable<JobApplication["aiMatch"]> }) {
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
      {optimizations.map((experience) => (
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
              {experience.items.map((item, index) => (
                <ExperienceComparisonRow
                  key={`${item.kind}-${item.actual}-${index}`}
                  actual={item.actual}
                  enhanced={item.enhanced}
                  kind={item.kind}
                />
              ))}
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
  onCreateCv,
}: {
  canCreateCv: boolean;
  hasGeneratedDocuments: boolean;
  isApproved: boolean;
  isCreatingCv: boolean;
  onApprovalChange: (value: boolean) => void;
  onCreateCv: () => Promise<void>;
}) {
  return (
    <div className="w-full max-w-3xl space-y-lg">
      <div className="w-full rounded-xl border border-outline-variant bg-surface-container-low p-5 sm:p-6">
        <h4 className="flex items-center gap-2 whitespace-nowrap text-body-lg font-bold">
          <span className="material-symbols-outlined text-[20px] text-primary">
            {hasGeneratedDocuments ? "check_circle" : "verified"}
          </span>
          <span>{hasGeneratedDocuments ? "CV already created" : "Approve AI changes"}</span>
        </h4>
        {hasGeneratedDocuments ? (
          <div className="mt-3 flex min-h-20 w-full items-center gap-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-4">
            <span className="material-symbols-outlined text-[28px] text-primary">folder_zip</span>
            <div className="min-w-0">
              <div className="text-body-md font-semibold text-on-surface">
                Generated files ready
              </div>
              <div className="text-body-sm text-secondary">
                Open the document list below to download the CV or cover letter.
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

      {!hasGeneratedDocuments && (
        <label className="flex w-full items-start gap-3 rounded-lg border border-outline-variant p-md cursor-pointer">
          <input
            checked={isApproved}
            className="mt-1 h-4 w-4 accent-primary"
            disabled={!canCreateCv || isCreatingCv}
            onChange={(event) => onApprovalChange(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-bold">I approve these AI-enhanced CV changes.</span>
            <span className="block text-body-sm text-secondary mt-1">
              Create the CV and cover letter from this reviewed match analysis.
            </span>
          </span>
        </label>
      )}

      <button
        className="w-full sm:w-auto px-5 py-3 rounded-lg bg-primary text-on-primary font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={!canCreateCv || !isApproved || isCreatingCv || hasGeneratedDocuments}
        onClick={() => void onCreateCv()}
        type="button"
      >
        <span className="material-symbols-outlined">
          {hasGeneratedDocuments ? "check_circle" : "description"}
        </span>
        {isCreatingCv ? "Creating..." : hasGeneratedDocuments ? "CV Created" : "Create CV"}
      </button>
    </div>
  );
}

function CompareColumns({
  enhancedLabel,
  enhancedTitle,
  enhancedValue,
  originalLabel,
  originalTitle,
  originalValue,
}: {
  enhancedLabel: string;
  enhancedTitle: string;
  enhancedValue: string;
  originalLabel: string;
  originalTitle: string;
  originalValue: string;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-md">
      <TextPanel label={originalLabel} title={originalTitle} tone="neutral" value={originalValue} />
      <TextPanel label={enhancedLabel} title={enhancedTitle} tone="primary" value={enhancedValue} />
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
  enhanced,
  kind,
}: {
  actual: string;
  enhanced?: string;
  kind: "achievement" | "description";
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
          <p className="text-body-md text-on-surface-variant">
            {enhanced ?? "No AI-enhanced version available for this item."}
          </p>
        </div>
      </div>
    </section>
  );
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
