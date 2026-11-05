// On macOS the desktop window carries a native vibrancy layer, so the sidebar can stay
// translucent and let the blurred desktop show through. Every other platform — and the browser
// build, which has no vibrancy to reveal — keeps the solid sidebar panel.
export const macGlassAttribute = "data-mac-glass";

const reducedTransparencyQuery = "(prefers-reduced-transparency: reduce)";

export function supportsMacGlass(): boolean {
  if (typeof window === "undefined") return false;
  if (window.electronAPI?.platform !== "darwin") return false;

  // "Reduce transparency" in the macOS accessibility settings asks for opaque surfaces.
  return !matchReducedTransparency()?.matches;
}

/** Marks the document so the stylesheet can switch the sidebar to its glass surface. */
export function initializeMacGlass(): () => void {
  const apply = () => applyMacGlass(supportsMacGlass());
  apply();

  const query = matchReducedTransparency();
  if (!query?.addEventListener) return () => {};

  query.addEventListener("change", apply);
  return () => query.removeEventListener("change", apply);
}

function applyMacGlass(enabled: boolean): void {
  if (typeof document === "undefined") return;

  if (enabled) {
    document.documentElement.setAttribute(macGlassAttribute, "");
  } else {
    document.documentElement.removeAttribute(macGlassAttribute);
  }
}

function matchReducedTransparency(): MediaQueryList | undefined {
  try {
    return window.matchMedia?.(reducedTransparencyQuery);
  } catch {
    // Browsers that do not know the media feature should keep the glass surface.
    return undefined;
  }
}
