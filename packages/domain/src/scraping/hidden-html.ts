const voidTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** Elements whose content is never rendered as page text. */
const neverRenderedTags = new Set(["template"]);

const hiddenStyle =
  /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0(?:\.0*)?(?:\s*!important)?\s*(?:;|$)|font-size\s*:\s*0(?:\.0*)?(?:px|em|rem|pt|%)?(?:\s*!important)?\s*(?:;|$))/i;

/**
 * Removes HTML elements a reader cannot see, together with everything inside them: elements with
 * the `hidden` attribute, `aria-hidden="true"`, or an inline style that hides them
 * (`display: none`, `visibility: hidden`, `opacity: 0`, `font-size: 0`), plus `<template>`.
 *
 * Scraped job postings are untrusted, and hidden markup is the obvious place to plant instructions
 * aimed at the AI model rather than the reader. Run this on scraped HTML before converting it to
 * the normalized text that is persisted and sent to the model; keep the original HTML in the raw
 * payload. An unclosed hidden element hides the rest of the input, so it fails closed.
 */
export function stripHiddenHtmlElements(html: string): string {
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g) ?? [];
  const output: string[] = [];
  let hidden: { tag: string; depth: number } | undefined;

  for (const token of tokens) {
    const tag = parseTag(token);

    if (hidden) {
      if (tag?.name === hidden.tag && !tag.selfClosing) {
        hidden.depth += tag.closing ? -1 : 1;
        if (hidden.depth === 0) hidden = undefined;
      }
      continue;
    }

    if (tag && !tag.closing && isHidden(tag)) {
      if (!tag.selfClosing && !voidTags.has(tag.name)) {
        hidden = { tag: tag.name, depth: 1 };
      }
      continue;
    }

    output.push(token);
  }

  return output.join("");
}

interface ParsedTag {
  attributes: string;
  closing: boolean;
  name: string;
  selfClosing: boolean;
}

function parseTag(token: string): ParsedTag | undefined {
  const match = /^<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*?)(\/)?\s*>$/.exec(token);
  if (!match) return undefined;

  return {
    closing: Boolean(match[1]),
    name: (match[2] ?? "").toLowerCase(),
    attributes: match[3] ?? "",
    selfClosing: Boolean(match[4]),
  };
}

function isHidden(tag: ParsedTag): boolean {
  if (neverRenderedTags.has(tag.name)) return true;

  const attributes = parseAttributes(tag.attributes);
  if (attributes.has("hidden")) return true;
  if (attributes.get("aria-hidden")?.trim().toLowerCase() === "true") return true;

  const style = attributes.get("style");
  return style !== undefined && hiddenStyle.test(decodeStyleEntities(style));
}

function parseAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const name = (match[1] ?? "").toLowerCase();
    if (!attributes.has(name)) {
      attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
    }
  }

  return attributes;
}

function decodeStyleEntities(style: string): string {
  return style
    .replaceAll(/&#(\d+);?/g, (_match, code: string) => codePoint(Number(code)))
    .replaceAll(/&#x([0-9a-f]+);?/gi, (_match, code: string) =>
      codePoint(Number.parseInt(code, 16)),
    )
    .replaceAll("&colon;", ":")
    .replaceAll("&semi;", ";");
}

function codePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : "";
}
