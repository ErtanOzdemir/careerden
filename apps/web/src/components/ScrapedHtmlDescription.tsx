interface ScrapedHtmlDescriptionProps {
  html: string;
}

const allowedTags = new Set([
  "A",
  "BR",
  "EM",
  "H1",
  "H2",
  "H3",
  "LI",
  "OL",
  "P",
  "STRONG",
  "U",
  "UL",
]);
const ignoredContentTags = new Set(["BUTTON", "FORM", "NOSCRIPT", "SCRIPT", "STYLE", "SVG"]);

export function ScrapedHtmlDescription({ html }: ScrapedHtmlDescriptionProps) {
  return (
    <div
      className="scraped-description text-sm leading-relaxed text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

function sanitizeHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  sanitizeChildren(template.content);
  return template.innerHTML;
}

function sanitizeChildren(parent: ParentNode): void {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      continue;
    }

    if (!(child instanceof HTMLElement)) {
      child.remove();
      continue;
    }

    if (ignoredContentTags.has(child.tagName)) {
      child.remove();
      continue;
    }

    if (!allowedTags.has(child.tagName)) {
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }

    sanitizeElement(child);
    sanitizeChildren(child);
  }
}

function sanitizeElement(element: HTMLElement): void {
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") : undefined;

  for (const attribute of Array.from(element.attributes)) {
    element.removeAttribute(attribute.name);
  }

  if (element instanceof HTMLAnchorElement) {
    if (!href || !isSafeHttpUrl(href)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    element.setAttribute("href", href);
    element.setAttribute("rel", "noreferrer");
    element.setAttribute("target", "_blank");
  }
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
