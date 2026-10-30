import { useEffect, useRef, useState } from "react";

// A4 at 96 CSS px/inch, matching the page size the paged preview and PDF renderers use.
const pageWidthPx = 794;
const pageHeightPx = 1123;

// Without Paged.js the template's `@page` margins don't apply, so the first page is approximated
// with equivalent body padding and anything past one page is clipped.
const thumbnailPageStyle = `<style>html,body{overflow:hidden}body{padding:20mm 18mm}</style>`;

/**
 * A static, script-free first-page render of a template, scaled down to fit its card. Cheap enough
 * to show several side by side, unlike the fully paginated preview.
 */
export function TemplateThumbnail({ html, title }: { html: string; title: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    function applyScale() {
      if (frame) setScale(frame.clientWidth / pageWidthPx);
    }

    applyScale();
    const observer = new ResizeObserver(applyScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const srcDoc = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${thumbnailPageStyle}</head>`)
    : thumbnailPageStyle + html;

  return (
    <div className="relative aspect-[210/297] w-full overflow-hidden bg-white" ref={frameRef}>
      {scale > 0 && (
        <iframe
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
          // Scripts stay disabled. Without allow-same-origin, Chromium isolates each frame in its
          // own process, and the packaged desktop app leaves those frames unpainted.
          sandbox="allow-same-origin"
          srcDoc={srcDoc}
          style={{ height: pageHeightPx, transform: `scale(${scale})`, width: pageWidthPx }}
          tabIndex={-1}
          title={title}
        />
      )}
    </div>
  );
}
