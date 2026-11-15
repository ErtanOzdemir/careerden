import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  formatProfileLinkLabel,
  inferProfileLinkKind,
  MAX_PROFILE_LINKS,
  normalizeProfileLinkUrl,
  PROFILE_LINK_ICONS,
  PROFILE_LINK_KIND_LABELS,
  PROFILE_LINK_KINDS,
  profileLinkKey,
  type ProfileLinkKind,
} from "@careerden/contracts";
import type { ApiProfileLink } from "../api/types.js";
import { cn } from "../lib/utils.js";

/**
 * One editable link row. `kindChosen` records that the user picked the kind themselves; until then
 * the kind follows the URL's hostname as it is typed.
 */
export interface ProfileLinkDraft {
  kind: ProfileLinkKind;
  url: string;
  kindChosen: boolean;
}

/** The rows the editor starts from. A saved kind that differs from the suggestion counts as chosen. */
export function editableProfileLinks(links: readonly ApiProfileLink[]): ProfileLinkDraft[] {
  return links.map((link) => ({
    kind: link.kind,
    url: link.url,
    kindChosen: link.kind !== inferProfileLinkKind(link.url),
  }));
}

/**
 * Why each row cannot be saved, by position, or null for a row that can. Blank rows are fine: they
 * are dropped on save.
 */
export function profileLinkErrors(rows: readonly ProfileLinkDraft[]): (string | null)[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.url.trim()) return null;
    const url = normalizeProfileLinkUrl(row.url);
    if (!url) return "Enter a valid http or https link, such as github.com/ada.";
    const key = profileLinkKey(url);
    if (seen.has(key)) return "This link is already in the list.";
    seen.add(key);
    return null;
  });
}

/** The rows as links to save: blank rows dropped, and schemeless URLs given `https://`. */
export function toProfileLinks(rows: readonly ProfileLinkDraft[]): ApiProfileLink[] {
  return rows.flatMap((row) => {
    const url = normalizeProfileLinkUrl(row.url);
    return url ? [{ kind: row.kind, url }] : [];
  });
}

export function ProfileLinkIcon({
  className,
  kind,
}: {
  className?: string;
  kind: ProfileLinkKind;
}) {
  const icon = PROFILE_LINK_ICONS[kind];
  const paint =
    icon.style === "fill"
      ? { fill: "currentColor" }
      : {
          fill: "none",
          stroke: "currentColor",
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
          strokeWidth: 2,
        };

  return (
    <svg
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      focusable="false"
      viewBox="0 0 24 24"
      {...paint}
    >
      {icon.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export function ProfileLinksView({ links }: { links: readonly ApiProfileLink[] }) {
  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">No links added yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Profile links">
      {links.map((link) => (
        <li key={link.url} className="min-w-0">
          <a
            className="inline-flex max-w-full items-center gap-2 text-sm text-foreground hover:text-primary hover:underline"
            href={link.url}
            rel="noreferrer"
            target="_blank"
            title={`${PROFILE_LINK_KIND_LABELS[link.kind]}: ${link.url}`}
          >
            <ProfileLinkIcon className="text-muted-foreground" kind={link.kind} />
            <span className="truncate">{formatProfileLinkLabel(link.url)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Edits the profile's links as repeatable rows of a kind, a URL, and a remove button. The kind is
 * suggested from the URL while the user has not picked one, and invalid URLs show an inline error
 * once the field loses focus or the user tries to save.
 */
export function ProfileLinksEditor({
  rows,
  onChange,
  showAllErrors = false,
}: {
  rows: ProfileLinkDraft[];
  onChange: (rows: ProfileLinkDraft[]) => void;
  showAllErrors?: boolean;
}) {
  const errors = profileLinkErrors(rows);

  function update(index: number, change: (row: ProfileLinkDraft) => ProfileLinkDraft) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? change(row) : row)));
  }

  function changeUrl(index: number, url: string) {
    update(index, (row) => {
      if (row.kindChosen) return { ...row, url };
      const normalized = normalizeProfileLinkUrl(url);
      return { ...row, url, kind: normalized ? inferProfileLinkKind(normalized) : row.kind };
    });
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No links added yet.</p>}
      {rows.map((row, index) => (
        <ProfileLinkRow
          key={index}
          error={errors[index] ?? null}
          index={index}
          row={row}
          showError={showAllErrors}
          onKindChange={(kind) =>
            update(index, (current) => ({ ...current, kind, kindChosen: true }))
          }
          onRemove={() => onChange(rows.filter((_row, rowIndex) => rowIndex !== index))}
          onUrlChange={(url) => changeUrl(index, url)}
        />
      ))}
      {rows.length < MAX_PROFILE_LINKS && (
        <button
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onChange([...rows, { kind: "website", url: "", kindChosen: false }])}
          type="button"
        >
          <Plus className="size-3" />
          Add link
        </button>
      )}
    </div>
  );
}

function ProfileLinkRow({
  error,
  index,
  onKindChange,
  onRemove,
  onUrlChange,
  row,
  showError,
}: {
  error: string | null;
  index: number;
  onKindChange: (kind: ProfileLinkKind) => void;
  onRemove: () => void;
  onUrlChange: (url: string) => void;
  row: ProfileLinkDraft;
  showError: boolean;
}) {
  const position = index + 1;
  const errorId = `profile-link-${index}-error`;
  const [touched, setTouched] = useState(false);
  const visibleError = showError || touched ? error : null;

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-2 sm:w-40">
          <ProfileLinkIcon className="text-muted-foreground" kind={row.kind} />
          <select
            aria-label={`Link ${position} type`}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            onChange={(event) => onKindChange(event.target.value as ProfileLinkKind)}
            value={row.kind}
          >
            {PROFILE_LINK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {PROFILE_LINK_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <input
          aria-describedby={visibleError ? errorId : undefined}
          aria-invalid={visibleError ? true : undefined}
          aria-label={`Link ${position} URL`}
          className={cn(
            "min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20",
            visibleError ? "border-destructive" : "border-input",
          )}
          inputMode="url"
          onBlur={() => setTouched(true)}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="linkedin.com/in/your-name"
          type="text"
          value={row.url}
        />
        <button
          aria-label={`Remove link ${position}`}
          className="self-end rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive sm:self-auto"
          onClick={onRemove}
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {visibleError && (
        <p className="mt-1 text-xs text-destructive" id={errorId}>
          {visibleError}
        </p>
      )}
    </div>
  );
}
