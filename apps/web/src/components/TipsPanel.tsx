import { useMemo, useState } from "react";
import {
  Check,
  FileText,
  Lightbulb,
  ListOrdered,
  Loader2,
  MessageCircleQuestion,
  Plus,
  SpellCheck,
  Undo2,
  X,
} from "lucide-react";
import type { DocumentFieldRef } from "../contracts/documents/field-ref.js";
import { emptyRichDocument } from "@careerden/contracts";
import { fieldRefToDomId } from "../contracts/documents/field-ref.js";
import type { ApiApplyFieldTipFieldRef, ApiDocumentContent, ApiProfile } from "../api/types.js";
import type { RichDocument } from "@careerden/contracts";
import type { CvListTip, CvTip, GapQuestion, JobApplication } from "../types.js";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { updateEnhancementDescription } from "./ApplicationPackCustomizer.js";
import { Button } from "./ui/button.js";
import { findWritingIssues } from "../lib/cv-writing-checks.js";
import { diffRichDocuments } from "../lib/document-diff.js";
import { computeKeywordCoverage } from "../lib/keyword-coverage.js";
import { orderSkillsByRelevance } from "../lib/skill-relevance.js";
import { cn } from "../lib/utils.js";

type ListKey = "certificationSuggestions" | "skillSuggestions";

interface TipGroupBase {
  key: string;
  label: string;
  field: DocumentFieldRef;
}

type TipGroup =
  | (TipGroupBase & { kind: "prose"; tips: CvTip[] })
  | (TipGroupBase & { kind: "list"; listKey: ListKey; tips: CvListTip[] });

type ProseTipGroup = Extract<TipGroup, { kind: "prose" }>;
type ListTipGroup = Extract<TipGroup, { kind: "list" }>;

/** Where an applied change lands, so the workspace can switch tabs and flash it. */
export type RevealTarget = { kind: "cv"; fieldDomId: string } | { kind: "cover_letter" };

/** Profile fields whose description can take an accepted gap-question answer. */
export type ProfileSavableField = Extract<
  DocumentFieldRef,
  { type: "summary" } | { type: "experience" } | { type: "education" }
>;

/** A rich-text slot in the draft that an AI revision can target. */
interface EditTarget {
  label: string;
  reveal: RevealTarget;
  read: (content: ApiDocumentContent) => RichDocument;
  write: (content: ApiDocumentContent, value: RichDocument) => ApiDocumentContent;
}

/** An AI revision the user has not yet accepted; the draft stays untouched until they do. */
interface Proposal {
  /** Which control the review renders under. */
  anchor: string;
  /** Persisted ids of the tips (or gap question) this proposal applies. */
  appliedIds: string[];
  target: EditTarget;
  before: RichDocument;
  after: RichDocument;
  /** Set for gap-question answers, which may also be written back to the profile. */
  profileField?: ProfileSavableField;
}

/** One accepted change, undoable while the draft still holds exactly what it wrote. */
interface AppliedChange {
  appliedIds: string[];
  label: string;
  reveal: RevealTarget;
  isCurrent: (content: ApiDocumentContent) => boolean;
  revert: (content: ApiDocumentContent) => ApiDocumentContent;
}

interface TipsPanelProps {
  aiMatch?: JobApplication["aiMatch"];
  className?: string;
  content?: ApiDocumentContent;
  jobApplicationId: string;
  profile?: ApiProfile;
  readOnly?: boolean;
  onContentChange: (content: ApiDocumentContent) => void;
  /**
   * Saves the draft right after a change is accepted or undone, so accepted tips stay applied (and
   * cannot be applied again) when the candidate comes back to this application.
   */
  onPersist?: (content: ApiDocumentContent) => Promise<void>;
  /** Called after a change is applied (or a check is clicked) so the caller can show that field. */
  onReveal: (target: RevealTarget) => void;
  /** Writes an accepted gap-question answer into the saved profile, when the user opts in. */
  onSaveToProfile?: (field: ProfileSavableField, value: RichDocument) => Promise<void>;
}

export function TipsPanel({
  aiMatch,
  className,
  content,
  jobApplicationId,
  profile,
  readOnly = false,
  onContentChange,
  onPersist,
  onReveal,
  onSaveToProfile,
}: TipsPanelProps) {
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [error, setError] = useState<{ anchor: string; message: string } | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [history, setHistory] = useState<AppliedChange[]>([]);
  /** A list tip awaiting the user's confirmation that the item is actually true for them. */
  const [confirming, setConfirming] = useState<{ tipKey: string; item: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const groups = aiMatch ? buildTipGroups(aiMatch, profile) : [];
  const hasTips = groups.some((group) => group.tips.length > 0);
  const appliedIds = new Set(content?.appliedTips ?? []);
  const lastChange = history.at(-1);
  const busy = readOnly || pendingAnchor !== null;

  const coverage = useMemo(
    () => (aiMatch && content ? computeKeywordCoverage(aiMatch.keywords, content, profile) : null),
    [aiMatch, content, profile],
  );
  const writingIssues = useMemo(
    () => (content ? findWritingIssues(content, profile) : []),
    [content, profile],
  );
  const relevantSkillOrder = useMemo(() => {
    if (!aiMatch || !content) return null;
    const ordered = orderSkillsByRelevance(
      content.skillSuggestions,
      aiMatch.keywords,
      (aiMatch.requirements ?? []).map((requirement) => requirement.requirement),
    );
    return ordered.some((skill, index) => skill !== content.skillSuggestions[index])
      ? ordered
      : null;
  }, [aiMatch, content]);

  async function propose(
    anchor: string,
    target: EditTarget,
    request: (before: RichDocument) => Promise<{ value: RichDocument }>,
    extras: Pick<Proposal, "appliedIds" | "profileField">,
  ) {
    if (!content || readOnly) return;

    setPendingAnchor(anchor);
    setError(null);
    setProposal(null);
    setConfirming(null);
    setSaveToProfile(false);
    try {
      const before = target.read(content);
      const { value } = await request(before);
      setProposal({ anchor, target, before, after: value, ...extras });
    } catch {
      setError({ anchor, message: "Couldn't get a suggestion. Try again." });
    } finally {
      setPendingAnchor(null);
    }
  }

  function requestTips(anchor: string, group: ProseTipGroup, tips: CvTip[]) {
    const fieldRef = toProseFieldRef(group.field);
    const [first, ...rest] = tips;
    if (!fieldRef || !first) return;

    void propose(
      anchor,
      cvFieldTarget(group.field, group.label),
      (currentValue) =>
        jobApplicationsApi.applyFieldTip(jobApplicationId, {
          field: fieldRef,
          currentValue,
          ...tipRequest(first),
          ...(rest.length > 0 ? { additionalTips: rest.map(tipRequest) } : {}),
        }),
      { appliedIds: tips.map((tip) => tipId(group.key, tip.text)) },
    );
  }

  function requestAnswer(anchor: string, question: GapQuestion, answer: string) {
    const field = question.field;
    void propose(
      anchor,
      cvFieldTarget(field, fieldLabel(field, profile)),
      (currentValue) =>
        jobApplicationsApi.applyFieldTip(jobApplicationId, {
          field,
          currentValue,
          tip: question.question,
          ...(question.requirement ? { requirement: question.requirement } : {}),
          candidateAnswer: answer.trim(),
        }),
      {
        appliedIds: [questionId(question)],
        ...(isProfileSavable(field) && onSaveToProfile ? { profileField: field } : {}),
      },
    );
  }

  function requestCoverLetter() {
    if (!content) return;
    const draft = content;
    void propose(
      "cover-letter",
      coverLetterTarget,
      () => jobApplicationsApi.rewriteCoverLetter(jobApplicationId, draft),
      { appliedIds: [] },
    );
  }

  /** Applies an accepted change to the draft and saves it straight away. */
  function commit(next: ApiDocumentContent) {
    onContentChange(next);
    if (!onPersist) return;
    setError((current) => (current?.anchor === "save" ? null : current));
    onPersist(next).catch(() => {
      setError({
        anchor: "save",
        message: "Couldn't save this change yet. It will be saved when you update the pack.",
      });
    });
  }

  function recordChange(change: AppliedChange) {
    setHistory((changes) => [...changes, change]);
    onReveal(change.reveal);
  }

  async function acceptProposal() {
    if (!content || !proposal) return;
    const { anchor, target, before, after, appliedIds: ids, profileField } = proposal;

    if (!sameDocument(target.read(content), before)) {
      setProposal(null);
      setError({
        anchor,
        message: `${target.label} changed after the suggestion was made. Ask again.`,
      });
      return;
    }

    commit(markApplied(target.write(content, after), ids));
    setProposal(null);
    recordChange({
      appliedIds: ids,
      label: target.label,
      reveal: target.reveal,
      isCurrent: (current) => sameDocument(target.read(current), after),
      revert: (current) => target.write(current, before),
    });

    if (profileField && saveToProfile && onSaveToProfile) {
      try {
        await onSaveToProfile(profileField, after);
      } catch {
        setError({
          anchor,
          message:
            "Added to this CV, but your profile couldn't be updated. Try again from Profile.",
        });
      }
    }
  }

  function applyListTip(group: ListTipGroup, item: string, id: string) {
    if (!content || readOnly) return;
    const suggestion = item.trim().replace(/\s+/g, " ");
    const { listKey } = group;
    setConfirming(null);
    if (!suggestion || includesCaseInsensitive(content[listKey], suggestion)) return;

    commit(markApplied({ ...content, [listKey]: [...content[listKey], suggestion] }, [id]));
    recordChange({
      appliedIds: [id],
      label: group.label,
      reveal: { kind: "cv", fieldDomId: fieldRefToDomId(group.field) },
      isCurrent: (current) => includesCaseInsensitive(current[listKey], suggestion),
      revert: (current) => ({
        ...current,
        [listKey]: current[listKey].filter(
          (candidate) => candidate.toLowerCase() !== suggestion.toLowerCase(),
        ),
      }),
    });
  }

  function applySkillOrder(ordered: string[]) {
    if (!content || readOnly) return;
    const previous = content.skillSuggestions;
    commit({ ...content, skillSuggestions: ordered });
    recordChange({
      appliedIds: [],
      label: "Skills order",
      reveal: { kind: "cv", fieldDomId: fieldRefToDomId({ type: "skills" }) },
      isCurrent: (current) => sameList(current.skillSuggestions, ordered),
      revert: (current) => ({ ...current, skillSuggestions: previous }),
    });
  }

  function undoLastChange() {
    if (!content || !lastChange) return;
    setHistory((changes) => changes.slice(0, -1));
    setError(null);

    if (!lastChange.isCurrent(content)) {
      setError({
        anchor: "undo",
        message: `${lastChange.label} was edited after the change was applied, so it was left as is.`,
      });
      return;
    }

    commit(unmarkApplied(lastChange.revert(content), lastChange.appliedIds));
    onReveal(lastChange.reveal);
  }

  function renderProposal(anchor: string) {
    if (proposal?.anchor !== anchor) return null;
    return (
      <ProposalReview
        onAccept={() => void acceptProposal()}
        onDiscard={() => setProposal(null)}
        onSaveToProfileChange={setSaveToProfile}
        proposal={proposal}
        saveToProfile={saveToProfile}
      />
    );
  }

  function renderError(anchor: string) {
    return error?.anchor === anchor ? (
      <p className="mt-1 px-1 text-[0.7rem] text-destructive">{error.message}</p>
    ) : null;
  }

  return (
    <aside
      className={cn(
        "flex h-fit flex-col gap-5 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-5",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lightbulb className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Improvement tips</h3>
          <p className="text-xs text-muted-foreground">
            Click a tip to preview the change before applying it
          </p>
        </div>
      </div>

      {lastChange && !readOnly && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">
            Applied to <span className="font-medium text-foreground">{lastChange.label}</span>
          </span>
          <Button onClick={undoLastChange} size="xs" variant="ghost">
            <Undo2 /> Undo
          </Button>
        </div>
      )}
      {renderError("undo")}
      {renderError("save")}

      {coverage && coverage.matched.length + coverage.missing.length > 0 && (
        <KeywordCoverageCard matched={coverage.matched} missing={coverage.missing} />
      )}

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

      {groups.some((group) => group.tips.length > 0) && (
        <div className="space-y-4">
          {groups
            .filter((group) => group.tips.length > 0)
            .map((group) => {
              const tipKeyAt = (tipIndex: number) => `${group.key}-${tipIndex}`;
              const openTips =
                group.kind === "prose"
                  ? group.tips.filter((tip) => !appliedIds.has(tipId(group.key, tip.text)))
                  : [];
              const allAnchor = `${group.key}-all`;

              return (
                <div className="space-y-2" key={group.key}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    {group.kind === "prose" && openTips.length >= 2 && (
                      <Button
                        disabled={busy || proposal?.anchor === allAnchor}
                        onClick={() => requestTips(allAnchor, group, openTips)}
                        size="xs"
                        variant="ghost"
                      >
                        {pendingAnchor === allAnchor && <Loader2 className="animate-spin" />}
                        Apply all ({openTips.length})
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {group.tips.map((tip, tipIndex) => {
                      const tipKey = tipKeyAt(tipIndex);
                      const isPending = pendingAnchor === tipKey;
                      const isOpen = proposal?.anchor === tipKey || confirming?.tipKey === tipKey;
                      const alreadyAdded =
                        group.kind === "list" &&
                        content !== undefined &&
                        "item" in tip &&
                        includesCaseInsensitive(content[group.listKey], tip.item);
                      const id = tipId(group.key, tip.text);
                      const isApplied = appliedIds.has(id) || alreadyAdded;

                      function handleClick() {
                        if (group.kind === "prose") {
                          requestTips(tipKey, group, [tip as CvTip]);
                        } else {
                          setProposal(null);
                          setConfirming({ tipKey, item: (tip as CvListTip).item });
                        }
                      }

                      return (
                        <div key={tipKey}>
                          <TipButton
                            applied={isApplied}
                            disabled={busy || isOpen || isApplied}
                            highlighted={isOpen}
                            onClick={handleClick}
                            pending={isPending}
                            requirement={tip.requirement}
                            text={tip.text}
                          />
                          {renderProposal(tipKey)}
                          {confirming?.tipKey === tipKey && group.kind === "list" && (
                            <ListTipConfirm
                              item={confirming.item}
                              label={group.label}
                              onCancel={() => setConfirming(null)}
                              onConfirm={(item) => applyListTip(group, item, id)}
                              onItemChange={(item) => setConfirming({ tipKey, item })}
                            />
                          )}
                          {renderError(tipKey)}
                        </div>
                      );
                    })}
                  </div>
                  {renderProposal(allAnchor)}
                  {renderError(allAnchor)}
                </div>
              );
            })}
        </div>
      )}

      {relevantSkillOrder && !readOnly && (
        <Section icon={<ListOrdered className="size-3.5" />} title="Structure">
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
            <p className="text-foreground">Put the skills this job asks for first.</p>
            <p className="mt-1 text-muted-foreground">
              New order starts with {relevantSkillOrder.slice(0, 4).join(", ")}
              {relevantSkillOrder.length > 4 ? "…" : ""}
            </p>
            <div className="mt-2 flex justify-end">
              <Button disabled={busy} onClick={() => applySkillOrder(relevantSkillOrder)} size="xs">
                Reorder skills
              </Button>
            </div>
          </div>
        </Section>
      )}

      {aiMatch && aiMatch.gapQuestions.length > 0 && (
        <Section icon={<MessageCircleQuestion className="size-3.5" />} title="Fill the gaps">
          <p className="text-xs text-muted-foreground">
            Answer only what is true — your answer is the only new fact the AI may add.
          </p>
          {aiMatch.gapQuestions.map((question, questionIndex) => {
            const anchor = `question-${questionIndex}`;
            const answer = answers[anchor] ?? "";
            const answered = appliedIds.has(questionId(question));

            return (
              <div className="space-y-1.5" key={anchor}>
                <div className="rounded-lg border border-border bg-background p-3 text-xs">
                  <p className="text-foreground">{question.question}</p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    Goes into {fieldLabel(question.field, profile)}
                    {question.requirement ? ` · For: ${question.requirement}` : ""}
                  </p>
                  {answered ? (
                    <p className="mt-2 flex items-center gap-1 text-[0.7rem] text-success">
                      <Check className="size-3" /> Added to your CV
                    </p>
                  ) : (
                    <form
                      className="mt-2 space-y-1.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (answer.trim()) requestAnswer(anchor, question, answer);
                      }}
                    >
                      <textarea
                        aria-label={`Answer: ${question.question}`}
                        className="min-h-14 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        disabled={readOnly}
                        onChange={(event) =>
                          setAnswers((current) => ({ ...current, [anchor]: event.target.value }))
                        }
                        placeholder="Your answer, in your own words"
                        value={answer}
                      />
                      <div className="flex justify-end">
                        <Button
                          disabled={busy || !answer.trim() || proposal?.anchor === anchor}
                          size="xs"
                          type="submit"
                        >
                          {pendingAnchor === anchor && <Loader2 className="animate-spin" />}
                          Use answer
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
                {renderProposal(anchor)}
                {renderError(anchor)}
              </div>
            );
          })}
        </Section>
      )}

      {writingIssues.length > 0 && (
        <Section icon={<SpellCheck className="size-3.5" />} title="Writing checks">
          <ul className="space-y-1.5">
            {writingIssues.slice(0, maxWritingIssues).map((issue, index) => (
              <li key={`${fieldRefToDomId(issue.field)}-${index}`}>
                <button
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => onReveal({ kind: "cv", fieldDomId: fieldRefToDomId(issue.field) })}
                  type="button"
                >
                  <span className="block font-medium text-foreground">{issue.label}</span>
                  <span className="block text-muted-foreground">{issue.message}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {aiMatch && content && !readOnly && (
        <Section icon={<FileText className="size-3.5" />} title="Cover letter">
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
            <p className="text-muted-foreground">
              The first letter was written before your edits. Rewrite it from the CV as it is now.
            </p>
            <div className="mt-2 flex justify-end">
              <Button
                disabled={busy || proposal?.anchor === "cover-letter"}
                onClick={requestCoverLetter}
                size="xs"
                variant="outline"
              >
                {pendingAnchor === "cover-letter" && <Loader2 className="animate-spin" />}
                Rewrite from my CV
              </Button>
            </div>
          </div>
          {renderProposal("cover-letter")}
          {renderError("cover-letter")}
        </Section>
      )}
    </aside>
  );
}

const maxWritingIssues = 8;

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </p>
      {children}
    </section>
  );
}

function TipButton({
  text,
  requirement,
  applied,
  pending,
  highlighted,
  disabled,
  onClick,
}: {
  text: string;
  requirement?: string;
  applied: boolean;
  pending: boolean;
  highlighted: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
        highlighted && "border-primary/40 bg-primary/5",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : applied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Plus className="size-3.5" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block">{text}</span>
        {requirement && (
          <span className="mt-1 block text-[0.7rem] text-muted-foreground">For: {requirement}</span>
        )}
      </span>
    </button>
  );
}

function KeywordCoverageCard({ matched, missing }: { matched: string[]; missing: string[] }) {
  const total = matched.length + missing.length;
  const percent = Math.round((matched.length / total) * 100);

  return (
    <section aria-label="Keyword coverage" className="space-y-2 rounded-lg bg-muted/50 p-3">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-foreground">Job keywords in your CV</span>
        <span className="text-muted-foreground">
          {matched.length} of {total}
        </span>
      </div>
      <div
        aria-label={`${percent}% of job keywords covered`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {missing.length > 0 && (
        <div className="space-y-1">
          <p className="text-[0.7rem] text-muted-foreground">
            Missing — add only the ones you can back up:
          </p>
          <div className="flex flex-wrap gap-1">
            {missing.slice(0, 10).map((keyword) => (
              <span
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[0.7rem] text-foreground"
                key={keyword}
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Skills and certifications are facts about the candidate, so adding one is never automatic: the
 * user confirms the exact name (and may correct it) before it lands on the CV.
 */
function ListTipConfirm({
  item,
  label,
  onCancel,
  onConfirm,
  onItemChange,
}: {
  item: string;
  label: string;
  onCancel: () => void;
  onConfirm: (item: string) => void;
  onItemChange: (item: string) => void;
}) {
  const noun = label.toLowerCase();

  return (
    <form
      aria-label={`Add to ${label}`}
      className="mt-1.5 space-y-2 rounded-lg border border-primary/30 bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (item.trim()) onConfirm(item);
      }}
    >
      <label className="block space-y-1">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Add to {label}
        </span>
        <input
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          onChange={(event) => onItemChange(event.target.value)}
          value={item}
        />
      </label>
      <p className="text-[0.7rem] text-muted-foreground">
        Only add this if it is true for you — recruiters may ask about anything in your {noun}.
      </p>
      <div className="flex justify-end gap-1.5">
        <Button onClick={onCancel} size="xs" type="button" variant="ghost">
          <X /> Cancel
        </Button>
        <Button disabled={!item.trim()} size="xs" type="submit">
          <Check /> Add
        </Button>
      </div>
    </form>
  );
}

function ProposalReview({
  proposal,
  saveToProfile,
  onAccept,
  onDiscard,
  onSaveToProfileChange,
}: {
  proposal: Proposal;
  saveToProfile: boolean;
  onAccept: () => void;
  onDiscard: () => void;
  onSaveToProfileChange: (value: boolean) => void;
}) {
  const segments = diffRichDocuments(proposal.before, proposal.after);
  const hasChanges = segments.some((segment) => segment.type !== "same");

  return (
    <div
      aria-label={`Suggested change for ${proposal.target.label}`}
      className="mt-1.5 space-y-2 rounded-lg border border-primary/30 bg-background p-3"
      role="region"
    >
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Suggested change
      </p>
      {hasChanges ? (
        <p className="max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">
          {segments.map((segment, index) =>
            segment.type === "added" ? (
              <ins className="rounded-sm bg-success/15 no-underline" key={index}>
                {segment.text}
              </ins>
            ) : segment.type === "removed" ? (
              <del className="rounded-sm bg-destructive/10 text-destructive" key={index}>
                {segment.text}
              </del>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          The AI found no truthful change to make here.
        </p>
      )}
      {hasChanges && proposal.profileField && (
        <label className="flex items-start gap-2 text-[0.7rem] text-muted-foreground">
          <input
            checked={saveToProfile}
            className="mt-0.5"
            onChange={(event) => onSaveToProfileChange(event.target.checked)}
            type="checkbox"
          />
          Also save this to my profile, so future applications can use it
        </label>
      )}
      <div className="flex justify-end gap-1.5">
        <Button onClick={onDiscard} size="xs" variant="ghost">
          <X /> Discard
        </Button>
        {hasChanges && (
          <Button onClick={onAccept} size="xs">
            <Check /> Accept
          </Button>
        )}
      </div>
    </div>
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
    groups.push({
      key: `experience-${entry.index}`,
      label: fieldLabel({ type: "experience", index: entry.index }, profile),
      field: { type: "experience", index: entry.index },
      tips: entry.tips,
      kind: "prose",
    });
  }

  for (const entry of aiMatch.educationTips) {
    if (entry.tips.length === 0) continue;
    groups.push({
      key: `education-${entry.index}`,
      label: fieldLabel({ type: "education", index: entry.index }, profile),
      field: { type: "education", index: entry.index },
      tips: entry.tips,
      kind: "prose",
    });
  }

  for (const entry of aiMatch.projectTips) {
    if (entry.tips.length === 0) continue;
    groups.push({
      key: `project-${entry.index}`,
      label: fieldLabel({ type: "project", index: entry.index }, profile),
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
      listKey: "skillSuggestions",
    });
  }

  if (aiMatch.certificationsTips.length > 0) {
    groups.push({
      key: "certifications",
      label: "Certifications",
      field: { type: "certifications" },
      tips: aiMatch.certificationsTips,
      kind: "list",
      listKey: "certificationSuggestions",
    });
  }

  return groups;
}

function fieldLabel(field: DocumentFieldRef, profile?: ApiProfile): string {
  switch (field.type) {
    case "summary":
      return "Summary";
    case "experience": {
      const experience = profile?.experience[field.index];
      return experience
        ? `${experience.title} · ${experience.company}`
        : `Experience ${field.index + 1}`;
    }
    case "education":
      return profile?.education[field.index]?.institution ?? `Education ${field.index + 1}`;
    case "project":
      return profile?.projects[field.index]?.name ?? `Project ${field.index + 1}`;
    case "skills":
      return "Skills";
    case "certifications":
      return "Certifications";
  }
}

function cvFieldTarget(field: DocumentFieldRef, label: string): EditTarget {
  return {
    label,
    reveal: { kind: "cv", fieldDomId: fieldRefToDomId(field) },
    read: (content) => readProseValue(content, field),
    write: (content, value) => writeProseValue(content, field, value),
  };
}

const coverLetterTarget: EditTarget = {
  label: "Cover letter",
  reveal: { kind: "cover_letter" },
  read: (content) => content.coverLetterContent ?? emptyRichDocument(),
  write: (content, value) => ({ ...content, coverLetterContent: value }),
};

function tipRequest(tip: CvTip): { tip: string; requirement?: string; evidence?: string } {
  return {
    tip: tip.text,
    ...(tip.requirement ? { requirement: tip.requirement } : {}),
    ...(tip.evidence ? { evidence: tip.evidence } : {}),
  };
}

function isProfileSavable(field: DocumentFieldRef): field is ProfileSavableField {
  return field.type === "summary" || field.type === "experience" || field.type === "education";
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

function sameDocument(left: RichDocument, right: RichDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Stable id for a tip within this analysis. Built from the field and the tip's wording rather than
 * its position, so it still identifies the same tip after a reload; a re-run analysis resets the
 * saved ids together with the rest of the document content.
 */
function tipId(groupKey: string, text: string): string {
  return `tip:${groupKey}:${text}`;
}

function questionId(question: GapQuestion): string {
  return `question:${question.question}`;
}

function markApplied(content: ApiDocumentContent, ids: string[]): ApiDocumentContent {
  if (ids.length === 0) return content;
  const applied = new Set(content.appliedTips ?? []);
  ids.forEach((id) => applied.add(id));
  return { ...content, appliedTips: [...applied] };
}

function unmarkApplied(content: ApiDocumentContent, ids: string[]): ApiDocumentContent {
  if (ids.length === 0 || !content.appliedTips) return content;
  const removed = new Set(ids);
  return { ...content, appliedTips: content.appliedTips.filter((id) => !removed.has(id)) };
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function includesCaseInsensitive(values: string[], value: string): boolean {
  return values.some((candidate) => candidate.toLowerCase() === value.toLowerCase());
}
