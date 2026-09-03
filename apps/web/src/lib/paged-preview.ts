/**
 * Vendored as a static asset (`public/vendor/paged.polyfill.js`, copied verbatim from
 * `pagedjs@0.4.3`'s `dist/paged.polyfill.js`) rather than imported from the `pagedjs` package:
 * that subpath isn't listed in the package's `exports` map, so while dev-time esbuild resolution
 * tolerates reaching around it, a production Rollup build fails outright. Re-copy this file when
 * bumping the pagedjs version.
 */
const pagedPolyfillUrl = "/vendor/paged.polyfill.js";
// Sets up `window.PagedConfig` (must run before the polyfill script below). A plain inline
// `<script>` tag would be blocked by the app's CSP (`script-src 'self'`, no `unsafe-inline`), so
// this is an external, same-origin script instead, parameterized via a `data-*` attribute.
const pagedPreviewBridgeUrl = "/vendor/paged-preview-bridge.js";

export interface PagedPreviewResult {
  totalPages: number;
}

export interface PagedPreviewHandle {
  result: Promise<PagedPreviewResult>;
  cancel: () => void;
  /** Scrolls the preview to, and briefly flashes, the element tagged `data-field-ref="domId"`. */
  highlightField: (domId: string) => void;
}

/**
 * Renders `html` as genuinely paginated A4 pages inside a fresh iframe appended to `container`.
 * Paged.js runs *inside its own iframe document* (via the polyfill script, not the `Previewer`
 * class run against the host document) so it gets real, browser-native CSS isolation for free: the
 * template's plain `body`/`header`/`h1`/`p`/`a` selectors can't leak out into the host app, and the
 * host app's own styles can't leak into the rendered pages either — both directions leaked when
 * this ran directly in the host document.
 */
export function renderPagedPreview(html: string, container: HTMLElement): PagedPreviewHandle {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.setAttribute("scrolling", "no");
  iframe.style.cssText = "border:0;display:block;height:0;width:100%;";

  let rendered = false;
  let listenerActive = true;
  let resolveResult: (value: PagedPreviewResult) => void;
  const result = new Promise<PagedPreviewResult>((resolve) => {
    resolveResult = resolve;
  });

  // Stays attached for the handle's whole lifetime (until `cancel()`), not just until the first
  // render completes — `highlightField` calls can arrive at any later point, e.g. minutes after
  // render when the user clicks a tip, and still need their `pagedjs-preview-scroll-to` reply.
  function handleMessage(event: MessageEvent) {
    if (event.source !== iframe.contentWindow || event.data?.requestId !== requestId) return;

    if (event.data.type === "pagedjs-preview-rendered" && !rendered) {
      rendered = true;
      const height = iframe.contentDocument?.documentElement.scrollHeight;
      if (height) iframe.style.height = `${height}px`;
      resolveResult({ totalPages: event.data.total });
      return;
    }

    if (event.data.type === "pagedjs-preview-scroll-to") {
      scrollToRatio(event.data.topRatio, event.data.heightRatio);
    }
  }

  // The iframe itself never scrolls (sized to its full content height), so the only genuinely
  // scrollable ancestor is the host's own scroll container — the direct parent of `container` in
  // `ApplicationPackWorkspace`'s `preview-scroll-area` div. `topRatio`/`heightRatio` come from the
  // bridge script as fractions of the iframe's total (unzoomed) content height; applying them to
  // this container's own (already zoomed) `scrollHeight` lands correctly regardless of zoom level,
  // with no coordinate math needing the zoom factor at all.
  function scrollToRatio(topRatio: number, heightRatio: number) {
    const scrollArea = container.parentElement;
    if (!scrollArea) return;
    const targetTop = topRatio * scrollArea.scrollHeight;
    const targetHeight = heightRatio * scrollArea.scrollHeight;
    const centered = targetTop - scrollArea.clientHeight / 2 + targetHeight / 2;
    const clamped = Math.max(0, Math.min(centered, scrollArea.scrollHeight - scrollArea.clientHeight));
    scrollArea.scrollTo({ top: clamped, behavior: "smooth" });
  }

  function cleanup() {
    if (!listenerActive) return;
    listenerActive = false;
    window.removeEventListener("message", handleMessage);
  }

  window.addEventListener("message", handleMessage);

  container.innerHTML = "";
  iframe.srcdoc = injectPagedPolyfill(html, requestId, resolveAppBackgroundColor());
  container.appendChild(iframe);

  function highlightField(domId: string) {
    // The bridge script finds the element, applies the flash, and replies with
    // `pagedjs-preview-scroll-to` (handled above) so the host can scroll to it.
    iframe.contentWindow?.postMessage(
      { type: "pagedjs-preview-highlight-field", fieldRef: domId },
      "*",
    );
  }

  return { result, cancel: cleanup, highlightField };
}

// Paged.js ships no default screen-preview chrome (confirmed empirically: rendered `.pagedjs_page`
// boxes have a transparent background and zero margin between them), so without this, consecutive
// pages render as one seamless white column with no visible break. This gives each page a paper-like
// card against a visible gap.
function pagedPreviewChromeStyle(gapColor: string): string {
  return `
    <style>
      html, body { background: ${gapColor}; }
      .pagedjs_pages { padding: 20px 0; }
      .pagedjs_page {
        background: #ffffff;
        box-shadow: 0 1px 4px rgba(15, 23, 42, 0.18);
        margin: 0 auto 24px;
      }
      .pagedjs_page:last-child { margin-bottom: 0; }
      [data-field-ref] { transition: background-color 0.3s ease, outline-color 0.3s ease; }
      .pagedjs-field-highlight {
        background-color: rgba(37, 99, 235, 0.12);
        outline: 2px solid #2563eb;
        outline-offset: 3px;
        border-radius: 2px;
      }
    </style>
`;
}

// The iframe's own document can't see the host app's `.dark` class or CSS variables, and relying on
// a `transparent` gap to let the host's real background show through the (unstyled) iframe element
// turned out not to reliably composite across the document boundary in practice — the gap kept
// rendering light even in dark mode. Reading resolved tokens here and baking in an explicit color
// sidesteps cross-frame compositing entirely.
//
// The preview container this renders into (`ApplicationPackWorkspace`'s `preview-scroll-area`) is
// styled `bg-muted/50` sitting on a `bg-card` ancestor — i.e. `--muted` at 50% opacity alpha-composited
// over `--card`, not a flat `--muted`. `color-mix(in oklab, muted 50%, card)` reproduces that same
// composite as an opaque color (verified: matches the real alpha-composited result exactly, since
// both are a 50/50 linear blend in the same color space), so the gap is a true match rather than an
// approximation.
function resolveAppBackgroundColor(): string {
  const style = getComputedStyle(document.documentElement);
  const muted = style.getPropertyValue("--muted").trim();
  const card = style.getPropertyValue("--card").trim();
  if (!muted || !card) return "#e2e8f0";
  return `color-mix(in oklab, ${muted} 50%, ${card})`;
}

function injectPagedPolyfill(html: string, requestId: string, gapColor: string): string {
  const script = `
    ${pagedPreviewChromeStyle(gapColor)}
    <script src="${pagedPreviewBridgeUrl}" data-request-id="${escapeHtmlAttribute(requestId)}"></script>
    <script src="${pagedPolyfillUrl}"></script>
  `;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}</body>`) : html + script;
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
