import { useEffect, useState } from "react";
import type { ApiDocumentContent, ApiDocumentContentSelections, RichDocument } from "../api/types";
import type { JobApplication, Profile } from "../types";
import RichTextEditor, { RichTextViewer } from "./RichTextEditor";
import EnhancedFieldRow from "./EnhancedFieldRow";
import { SelectionToggle } from "./link2cv/selection-toggle";
import {
  Award,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Brain,
  BriefcaseBusiness,
  CheckCircle,
  ExternalLink,
  FileText,
  GraduationCap,
  Package,
  Pencil,
  Rocket,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";

interface AiMatchCardProps {
  aiMatch: NonNullable<JobApplication["aiMatch"]>;
  canCreateCv: boolean;
  hasGeneratedDocuments: boolean;
  isCreatingCv: boolean;
  isSavingContent: boolean;
  documentContent: ApiDocumentContent;
  profile?: Profile;
  onSaveContent: (content: ApiDocumentContent) => Promise<void>;
  onCreateCv: () => Promise<void> | void;
}

const wizardSteps = [
  { label: "Match", Icon: BarChart3 },
  { label: "Summary", Icon: FileText },
  { label: "Experience", Icon: BriefcaseBusiness },
  { label: "Skills", Icon: Brain },
  { label: "Education", Icon: GraduationCap },
  { label: "Projects", Icon: Rocket },
  { label: "Certifications", Icon: BadgeCheck },
  { label: "Approval", Icon: CheckCircle },
] as const;

export default function AiMatchCard({
  aiMatch,
  canCreateCv,
  hasGeneratedDocuments,
  isCreatingCv,
  isSavingContent,
  documentContent,
  profile,
  onSaveContent,
  onCreateCv,
}: AiMatchCardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [isApproved, setIsApproved] = useState(false);
  const [draftContent, setDraftContent] = useState(documentContent);

  const scoreRadius = 44;
  const circumference = 2 * Math.PI * scoreRadius;
  const offset = circumference - (aiMatch.score / 100) * circumference;
  const createDisabled = !canCreateCv || !isApproved || isCreatingCv || isSavingContent;

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
  }

  async function handleSaveContent(content: ApiDocumentContent) {
    await onSaveContent(content);
    setDraftContent(content);
    setIsApproved(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI Match Intelligence
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{aiMatch.recommendation}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${scoreBgClass(aiMatch.score)}`}
          >
            {aiMatch.score}% Match
          </span>
        </div>

        <div className="grid grid-cols-[auto,1fr] gap-4 items-center">
          <ScoreRing score={aiMatch.score} offset={offset} circumference={circumference} />
          <div className="min-w-0">
            <p className="text-sm text-foreground/80 line-clamp-3">{aiMatch.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {aiMatch.keywords.slice(0, 4).map((kw) => (
                <span
                  key={kw.keyword}
                  className={`px-2 py-1 rounded text-xs font-semibold border ${
                    kw.match
                      ? "border-success bg-success-soft text-success"
                      : "border-destructive/30 bg-danger-soft text-destructive"
                  }`}
                >
                  {kw.keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card text-foreground overflow-hidden">
        <div className="shrink-0 overflow-x-auto border-b border-border px-4 pt-2 sm:px-6 sm:pt-4">
          <div className="flex min-w-max gap-2">
            {wizardSteps.map((step, index) => (
              <button
                key={step.label}
                className={`px-3 py-2 border-b-2 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                  activeStep === index
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveStep(index)}
                type="button"
              >
                <step.Icon className="size-[18px]" />
                {step.label}
              </button>
            ))}
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {activeStep === 0 && <MatchStep aiMatch={aiMatch} />}
          {activeStep === 1 && (
            <div className="space-y-6">
              <ComparisonRow
                actual={aiMatch.currentSummary}
                document={draftContent.customizedSummary}
                icon="summary"
                isSaving={isSavingContent}
                label="Profile Summary"
                onSave={(value) => handleSaveContent({ ...draftContent, customizedSummary: value })}
                onSelectionChange={(value) =>
                  setDraftContent(updateSelection(draftContent, ["customizedSummary"], value))
                }
                selection={
                  draftContent.selections?.customizedSummary === "original" ? "original" : "ai"
                }
              />
            </div>
          )}
          {activeStep === 2 && (
            <ExperienceStep
              aiMatch={aiMatch}
              documentContent={draftContent}
              isSaving={isSavingContent}
              onContentChange={setDraftContent}
              onSave={handleSaveContent}
            />
          )}
          {activeStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold">Skills Comparison</h2>
              <div className="flex items-center gap-2 mb-4">
                <SelectionToggle
                  value={draftContent.selections?.skills === "original" ? "original" : "ai"}
                  onChange={(value) =>
                    setDraftContent(updateSelection(draftContent, ["skills"], value))
                  }
                  options={[
                    { value: "ai", label: "AI Suggestions" },
                    { value: "original", label: "Profile Skills" },
                  ]}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Profile Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {aiMatch.yourSkills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-muted rounded-full text-xs font-semibold"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                {(draftContent.skillSuggestions ?? []).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">AI Suggestions</h3>
                    <div className="flex flex-wrap gap-2">
                      {draftContent.skillSuggestions?.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-semibold"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeStep === 4 && (
            <div className="space-y-8">
              <h2 className="text-base font-semibold">Education Enhancements</h2>
              {(aiMatch.educationOptimizations ?? []).map((edu, eduIndex) => {
                const enhancement = draftContent.educationEnhancements?.find(
                  (e) => e.educationIndex === eduIndex,
                );
                return (
                  <div key={eduIndex} className="space-y-4">
                    <h3 className="text-base font-semibold">
                      {edu.institution} — {edu.degree}
                    </h3>
                    {edu.items
                      .filter((item) => item.kind === "achievement")
                      .map((item, achievementIndex) => (
                        <EnhancedFieldRow
                          key={`edu-${eduIndex}-${achievementIndex}`}
                          label={`Achievement ${achievementIndex + 1}`}
                          original={item.actual}
                          enhanced={enhancement?.achievements?.[achievementIndex]}
                          selection={
                            draftContent.selections?.education?.[String(eduIndex)]?.achievements?.[
                              String(achievementIndex)
                            ]
                          }
                          onSelectionChange={(value) =>
                            setDraftContent(
                              updateSelection(
                                draftContent,
                                [
                                  "education",
                                  String(eduIndex),
                                  "achievements",
                                  String(achievementIndex),
                                ],
                                value,
                              ),
                            )
                          }
                          onSave={(content) =>
                            setDraftContent(
                              updateEducationAchievement(
                                draftContent,
                                eduIndex,
                                achievementIndex,
                                content,
                              ),
                            )
                          }
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          )}
          {activeStep === 5 && (
            <div className="space-y-8">
              <h2 className="text-base font-semibold">Project Enhancements</h2>
              {(aiMatch.projectOptimizations ?? []).map((project, projectIndex) => {
                const enhancement = draftContent.projectEnhancements?.find(
                  (p) => p.projectIndex === projectIndex,
                );
                const descriptionItem = project.items.find((item) => item.kind === "description");
                const achievementItems = project.items.filter(
                  (item) => item.kind === "achievement",
                );
                return (
                  <div key={projectIndex} className="space-y-4">
                    <h3 className="text-base font-semibold">{project.name}</h3>
                    {descriptionItem && (
                      <EnhancedFieldRow
                        label="Description"
                        original={descriptionItem.actual}
                        enhanced={enhancement?.description}
                        selection={
                          draftContent.selections?.projects?.[String(projectIndex)]?.description
                        }
                        onSelectionChange={(value) =>
                          setDraftContent(
                            updateSelection(
                              draftContent,
                              ["projects", String(projectIndex), "description"],
                              value,
                            ),
                          )
                        }
                        onSave={(content) =>
                          setDraftContent(
                            updateProjectDescription(draftContent, projectIndex, content),
                          )
                        }
                      />
                    )}
                    {achievementItems.map((item, achievementIndex) => (
                      <EnhancedFieldRow
                        key={`proj-${projectIndex}-${achievementIndex}`}
                        label={`Achievement ${achievementIndex + 1}`}
                        original={item.actual}
                        enhanced={enhancement?.achievements?.[achievementIndex]}
                        selection={
                          draftContent.selections?.projects?.[String(projectIndex)]?.achievements?.[
                            String(achievementIndex)
                          ]
                        }
                        onSelectionChange={(value) =>
                          setDraftContent(
                            updateSelection(
                              draftContent,
                              [
                                "projects",
                                String(projectIndex),
                                "achievements",
                                String(achievementIndex),
                              ],
                              value,
                            ),
                          )
                        }
                        onSave={(content) =>
                          setDraftContent(
                            updateProjectAchievement(
                              draftContent,
                              projectIndex,
                              achievementIndex,
                              content,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {activeStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold">Certification Suggestions</h2>
              <div className="flex items-center gap-2 mb-4">
                <SelectionToggle
                  value={draftContent.selections?.certifications === "original" ? "original" : "ai"}
                  onChange={(value) =>
                    setDraftContent(updateSelection(draftContent, ["certifications"], value))
                  }
                  options={[
                    { value: "ai", label: "AI Suggestions" },
                    { value: "original", label: "Profile Certifications" },
                  ]}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Profile Certifications</h3>
                  <div className="flex flex-wrap gap-2">
                    {(profile?.certifications ?? []).map((cert) => (
                      <span
                        key={cert}
                        className="px-3 py-1 bg-muted rounded-full text-xs font-semibold"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
                {(draftContent.certificationSuggestions ?? []).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">AI Suggestions</h3>
                    <div className="flex flex-wrap gap-2">
                      {draftContent.certificationSuggestions?.map((cert) => (
                        <span
                          key={cert}
                          className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-semibold"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeStep === 7 && (
            <ApprovalStep
              canCreateCv={canCreateCv}
              hasGeneratedDocuments={hasGeneratedDocuments}
              isApproved={isApproved}
              isCreatingCv={isCreatingCv}
              onApprovalChange={setIsApproved}
            />
          )}
        </div>

        <footer className="flex shrink-0 flex-col justify-between gap-4 border-t border-border p-4 sm:flex-row sm:items-center sm:p-6">
          <button
            className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
            disabled={activeStep === 0}
            onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
            type="button"
          >
            Back
          </button>
          <div className="flex gap-2 justify-end">
            {activeStep < wizardSteps.length - 1 ? (
              <button
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center gap-2 cursor-pointer"
                onClick={() =>
                  setActiveStep((current) => Math.min(wizardSteps.length - 1, current + 1))
                }
                type="button"
              >
                Next
              </button>
            ) : (
              <button
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={createDisabled}
                onClick={() => void handleCreateCv()}
                type="button"
              >
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
    </div>
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
  const ringColor =
    score >= 70 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90">
        <circle
          className="text-muted"
          cx="48"
          cy="48"
          fill="transparent"
          r="44"
          stroke="currentColor"
          strokeWidth="7"
        />
        <circle
          className={ringColor}
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
        <span
          className={`text-lg font-semibold leading-none ${score >= 70 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive"}`}
        >
          {score}
        </span>
        <span className="text-xs font-semibold uppercase opacity-70">Match</span>
      </div>
    </div>
  );
}

function MatchStep({ aiMatch }: { aiMatch: NonNullable<JobApplication["aiMatch"]> }) {
  const requirements =
    aiMatch.requirements && aiMatch.requirements.length > 0
      ? aiMatch.requirements
      : [
          ...aiMatch.keywords
            .filter((keyword) => keyword.match)
            .map((keyword) => ({
              requirement: keyword.keyword,
              status: "matched" as const,
              evidence: [],
            })),
          ...aiMatch.keywords
            .filter((keyword) => !keyword.match)
            .map((keyword) => ({
              requirement: keyword.keyword,
              status: "missing" as const,
              evidence: [],
            })),
        ];
  const matchedRequirements = requirements.filter(
    (requirement) => requirement.status === "matched",
  );
  const missingRequirements = requirements.filter(
    (requirement) => requirement.status === "partial",
  );
  const notMentionedRequirements = requirements.filter(
    (requirement) => requirement.status === "missing",
  );
  const missingSkillResources = aiMatch.missingSkillResources ?? [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Metric label="Match Score" value={`${aiMatch.score}%`} />
        <Metric label="Strong Skills" value={String(aiMatch.yourSkills.length)} />
        <Metric label="Suggested Skills" value={String(aiMatch.suggestedSkills.length)} />
      </div>
      <section className="space-y-4">
        <h4 className="text-sm font-semibold uppercase text-muted-foreground">
          Requirement Analysis
        </h4>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <RequirementGroup
            emptyMessage="No matched requirements"
            Icon={CheckCircle}
            label="Matched Requirements"
            requirements={matchedRequirements}
            tone="matched"
          />
          <RequirementGroup
            emptyMessage="No partially matched requirements"
            Icon={AlertTriangle}
            label="Partially Matched Requirements"
            requirements={missingRequirements}
            tone="partial"
          />
          <RequirementGroup
            emptyMessage="No unmatched requirements"
            Icon={XCircle}
            label="Unmatched Requirements"
            requirements={notMentionedRequirements}
            tone="missing"
          />
        </div>
      </section>
      {missingSkillResources.length > 0 && (
        <section className="space-y-4">
          <h4 className="text-sm font-semibold uppercase text-muted-foreground">
            Useful links for missing skills
          </h4>
          <div className="grid gap-3">
            {missingSkillResources.map((resource) => (
              <a
                key={`${resource.skill}-${resource.url}`}
                className="rounded-lg border border-border bg-card p-4 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40"
                href={resource.url}
                rel="noreferrer"
                target="_blank"
              >
                <span className="mb-2 flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-xs font-semibold uppercase text-muted-foreground">
                      {resource.skill} · {resource.type}
                    </span>
                    <span className="mt-1 block font-semibold text-foreground">
                      {resource.title}
                    </span>
                  </span>
                  <ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </span>
                <span className="block text-muted-foreground">{resource.reason}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RequirementGroup(props: {
  emptyMessage: string;
  Icon: React.FC<{ className?: string }>;
  label: string;
  requirements: NonNullable<NonNullable<JobApplication["aiMatch"]>["requirements"]>;
  tone: "matched" | "partial" | "missing";
}) {
  const isMatched = props.tone === "matched";
  const isPartial = props.tone === "partial";
  const Icon = props.Icon;
  const toneClasses = isMatched
    ? "border-success bg-success-soft text-success"
    : isPartial
      ? "border-warning/40 bg-warning/10 text-warning"
      : "border-destructive/30 bg-danger-soft text-destructive";

  return (
    <div className={`min-h-36 rounded-lg border p-4 ${toneClasses}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-[18px] shrink-0" />
          <h5 className="text-sm font-semibold leading-tight">{props.label}</h5>
        </div>
        <span className="text-sm font-semibold">{props.requirements.length}</span>
      </div>

      {props.requirements.length > 0 ? (
        <div className="space-y-2">
          {props.requirements.map((requirement) => (
            <div
              key={`${requirement.status}-${requirement.requirement}`}
              className="rounded-lg border border-current/20 bg-card px-3 py-2"
            >
              <p className="break-words text-sm font-semibold text-foreground">
                {requirement.requirement}
              </p>
              {requirement.evidence.length > 0 && (
                <div className="mt-2 space-y-1">
                  {requirement.evidence.map((evidence) => (
                    <p
                      key={evidence}
                      className="break-words text-xs leading-relaxed text-muted-foreground"
                    >
                      {evidence}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{props.emptyMessage}</p>
      )}
    </div>
  );
}

function ExperienceStep({
  aiMatch,
  documentContent,
  isSaving,
  onContentChange,
  onSave,
}: {
  aiMatch: NonNullable<JobApplication["aiMatch"]>;
  documentContent: ApiDocumentContent;
  isSaving: boolean;
  onContentChange: (content: ApiDocumentContent) => void;
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
    <div className="space-y-6">
      {optimizations.map((experience, experienceIndex) => (
        <section
          key={`${experience.company}-${experience.title}`}
          className="rounded-lg border border-border bg-muted/40 p-4 space-y-4"
        >
          <div>
            <h4 className="text-base font-semibold">{experience.title}</h4>
            <p className="text-xs text-muted-foreground">{experience.company}</p>
          </div>
          {experience.items.length > 0 ? (
            <div className="space-y-4">
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
                const selection =
                  item.kind === "description"
                    ? documentContent.selections?.experience?.[String(experienceIndex)]?.description
                    : documentContent.selections?.experience?.[String(experienceIndex)]
                        ?.achievements?.[String(achievementIndex)];

                return (
                  <ComparisonRow
                    key={`${item.kind}-${item.actual}-${index}`}
                    actual={item.actual}
                    document={document}
                    icon={item.kind}
                    isSaving={isSaving}
                    label={item.kind === "description" ? "Role Description" : "Achievement"}
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
                    onSelectionChange={(value) =>
                      onContentChange(
                        updateSelection(
                          documentContent,
                          item.kind === "description"
                            ? ["experience", String(experienceIndex), "description"]
                            : [
                                "experience",
                                String(experienceIndex),
                                "achievements",
                                String(achievementIndex),
                              ],
                          value,
                        ),
                      )
                    }
                    selection={selection === "original" ? "original" : "ai"}
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-card px-4 py-2 text-sm text-muted-foreground">
              No descriptions or achievements added for this experience.
            </p>
          )}
        </section>
      ))}
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
    <div className="w-full max-w-3xl space-y-6">
      <div className="w-full rounded-xl border border-border bg-muted/40 p-5 sm:p-6">
        <h4 className="flex items-center gap-2 whitespace-nowrap text-base font-semibold">
          {hasGeneratedDocuments ? (
            <CheckCircle className="size-5 text-primary" />
          ) : (
            <BadgeCheck className="size-5 text-primary" />
          )}
          <span>{hasGeneratedDocuments ? "Regenerate CV" : "Approve AI changes"}</span>
        </h4>
        {hasGeneratedDocuments ? (
          <div className="mt-3 flex min-h-20 w-full items-center gap-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-4">
            <Package className="size-7 text-primary" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Generated files ready</div>
              <div className="text-xs text-muted-foreground">
                Save any edits, approve them, then regenerate to replace the current files.
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {canCreateCv
              ? "Your current profile inputs and AI-enhanced content are ready for document generation."
              : "AI analysis is not ready for document generation yet."}
          </p>
        )}
      </div>

      <label className="flex w-full items-start gap-3 rounded-lg border border-border p-4 cursor-pointer">
        <input
          checked={isApproved}
          className="mt-1 h-4 w-4 accent-primary"
          disabled={!canCreateCv || isCreatingCv}
          onChange={(event) => onApprovalChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block font-semibold">I approve these CV changes.</span>
          <span className="block text-xs text-muted-foreground mt-1">
            {hasGeneratedDocuments
              ? "Replace the generated CV and cover letter with the saved content."
              : "Create the CV and cover letter from this saved content."}
          </span>
        </span>
      </label>
    </div>
  );
}

function ComparisonRow({
  actual,
  document,
  icon,
  isSaving,
  label,
  onSave,
  onSelectionChange,
  selection,
}: {
  actual: string;
  document?: RichDocument;
  icon: "achievement" | "description" | "summary";
  isSaving: boolean;
  label: string;
  onSave: (document: RichDocument) => Promise<void>;
  onSelectionChange: (selection: "ai" | "original") => void;
  selection: "ai" | "original";
}) {
  const Icon = icon === "achievement" ? Award : FileText;

  return (
    <section className="rounded-lg bg-card p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-[18px] text-primary" />
          <span className="text-sm font-semibold uppercase text-muted-foreground">{label}</span>
        </div>
        <SelectionToggle
          value={selection}
          onChange={onSelectionChange}
          options={[
            { value: "ai", label: "AI Enhanced" },
            { value: "original", label: "Original" },
          ]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:divide-x md:divide-border">
        <div className="space-y-1 md:pr-4">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Actual Version
          </span>
          <p className="text-sm text-muted-foreground">{actual}</p>
        </div>
        <div className="space-y-1 md:pl-4">
          <span className="text-xs font-semibold uppercase text-primary">AI Enhanced Version</span>
          {document ? (
            <EditableRichDocumentField
              ariaLabel={`Enhanced ${label}`}
              document={document}
              isSaving={isSaving}
              onSave={onSave}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
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
      <div className="mb-2 flex items-center justify-between gap-2">
        {title ? <h4 className="text-base font-semibold">{title}</h4> : <span />}
        {!isEditing && (
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
            disabled={isSaving}
            onClick={() => setIsEditing(true)}
            type="button"
          >
            <Pencil className="size-[18px]" />
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <RichTextEditor ariaLabel={ariaLabel} onChange={setDraft} value={draft} />
          <div className="flex justify-end gap-2">
            <button
              className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
              disabled={isSaving}
              onClick={cancelEditing}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              disabled={isSaving}
              onClick={() => void saveEditing()}
              type="button"
            >
              <Save className="size-[18px]" />
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
          achievements: replaceAt(existing.achievements, achievementIndex, document),
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
  return {
    ...documentContent,
    selections: normalizeSelections(selections as ApiDocumentContentSelections),
  };
}

function normalizeSelections(
  selections: ApiDocumentContentSelections,
): ApiDocumentContentSelections {
  return {
    ...selections,
    experience: normalizeIndexSelections(selections.experience),
    education: normalizeIndexSelections(selections.education),
    projects: normalizeIndexSelections(selections.projects),
  };
}

function normalizeIndexSelections(
  selections: ApiDocumentContentSelections["experience"],
): ApiDocumentContentSelections["experience"] {
  return Object.fromEntries(
    Object.entries(selections ?? {}).map(([index, selection]) => [
      index,
      { ...selection, achievements: selection.achievements ?? {} },
    ]),
  );
}

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  const next = [...items];
  next[index] = item;
  return next;
}

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground uppercase font-semibold">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </section>
  );
}

function scoreBgClass(score: number) {
  if (score >= 70) return "bg-success text-success-foreground";
  if (score >= 50) return "bg-warning text-warning-foreground";
  return "bg-destructive text-destructive-foreground";
}
