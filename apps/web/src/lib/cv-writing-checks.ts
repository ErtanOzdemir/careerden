import type { DocumentFieldRef } from "@careerden/contracts";
import type { ApiDocumentContent, ApiProfile } from "../api/types.js";
import { draftCvFields } from "./cv-text.js";

export interface WritingIssue {
  field: DocumentFieldRef;
  label: string;
  message: string;
}

const MAX_LINE_WORDS = 35;
const MAX_SUMMARY_WORDS = 90;
const REPEATED_OPENER_THRESHOLD = 3;

/** Openers that describe a duty instead of what the candidate did. Checked at the line start. */
const weakOpeners = [
  "responsible for",
  "worked on",
  "helped",
  "assisted",
  "involved in",
  "participated in",
  "duties included",
  "tasked with",
];

/** Turkish CV lines put the verb last, so these are matched anywhere in the line. */
const weakTurkishPhrases = [
  "sorumluydum",
  "sorumlu olarak",
  "görev aldım",
  "yardımcı oldum",
  "katkıda bulundum",
  "yer aldım",
];

const firstPerson = /^(i|i'm|my|we|our)\b/i;
const openerWord = /^[\p{L}][\p{L}'-]{2,}/u;

/**
 * Deterministic, AI-free checks on the draft CV's wording. They flag patterns recruiters and ATS
 * guides consistently warn about; each message suggests a change without asking for invented facts.
 */
export function findWritingIssues(
  content: ApiDocumentContent,
  profile?: ApiProfile,
): WritingIssue[] {
  const issues: WritingIssue[] = [];
  const fields = draftCvFields(content, profile);
  const openers = new Map<string, { count: number; original: string; field: (typeof fields)[0] }>();

  for (const field of fields) {
    const add = (message: string) =>
      issues.push({ field: field.field, label: field.label, message });
    const words = field.lines.join(" ").split(/\s+/).filter(Boolean).length;

    if (field.field.type === "summary") {
      if (field.lines.length === 0)
        add("The summary is empty — add two or three lines on who you are.");
      else if (words > MAX_SUMMARY_WORDS)
        add(`The summary is ${words} words — recruiters skim, so aim for three or four lines.`);
      continue;
    }

    const weak = field.lines
      .map((line) => weakPhraseIn(line))
      .find((phrase): phrase is string => Boolean(phrase));
    if (weak) add(`Uses “${weak}” — lead with what you did or achieved instead.`);

    const longest = Math.max(0, ...field.lines.map((line) => line.split(/\s+/).length));
    if (longest > MAX_LINE_WORDS)
      add(`One line is ${longest} words — split it or trim it to under 30.`);

    if (field.lines.some((line) => firstPerson.test(line)))
      add("Drop first-person words like “I” or “my” — CV lines usually start with a verb.");

    if (
      field.field.type === "experience" &&
      field.lines.length >= 2 &&
      !field.lines.some((line) => /\d/.test(line))
    )
      add(
        "No numbers here — add a measurable result if you have one (users, team size, time saved).",
      );

    if (field.field.type === "experience") {
      for (const line of field.lines) {
        const opener = line.match(openerWord)?.[0];
        if (!opener) continue;
        const key = opener.toLocaleLowerCase();
        const entry = openers.get(key) ?? { count: 0, original: opener, field };
        entry.count += 1;
        openers.set(key, entry);
      }
    }
  }

  for (const { count, original, field } of openers.values()) {
    if (count >= REPEATED_OPENER_THRESHOLD) {
      issues.push({
        field: field.field,
        label: field.label,
        message: `“${original}” starts ${count} lines across your experience — vary your verbs.`,
      });
    }
  }

  return issues;
}

function weakPhraseIn(line: string): string | undefined {
  const lower = line.toLocaleLowerCase();
  const opener = weakOpeners.find((phrase) => lower.startsWith(phrase));
  if (opener) return line.slice(0, opener.length);
  return weakTurkishPhrases.find((phrase) => lower.includes(phrase));
}
