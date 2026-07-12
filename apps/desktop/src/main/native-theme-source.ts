import type { NativeTheme } from "electron";

export type NativeThemeSource = NativeTheme["themeSource"];

export function setNativeThemeSource(
  nativeTheme: Pick<NativeTheme, "themeSource">,
  source: unknown,
): void {
  if (!isNativeThemeSource(source)) {
    throw new TypeError('Native theme source must be "system", "light", or "dark".');
  }

  nativeTheme.themeSource = source;
}

function isNativeThemeSource(source: unknown): source is NativeThemeSource {
  return source === "system" || source === "light" || source === "dark";
}
