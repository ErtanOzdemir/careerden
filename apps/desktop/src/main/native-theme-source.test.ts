import { describe, expect, it } from "vitest";
import { setNativeThemeSource, type NativeThemeSource } from "./native-theme-source.js";

describe("setNativeThemeSource", () => {
  it.each<NativeThemeSource>(["system", "light", "dark"])(
    "sets the native theme source to %s",
    (source) => {
      const nativeTheme = { themeSource: "system" as NativeThemeSource };

      setNativeThemeSource(nativeTheme, source);

      expect(nativeTheme.themeSource).toBe(source);
    },
  );

  it.each([undefined, null, true, 0, "auto", "LIGHT", {}, []])(
    "rejects invalid source %j without changing the native theme",
    (source) => {
      const nativeTheme = { themeSource: "light" as NativeThemeSource };

      expect(() => setNativeThemeSource(nativeTheme, source)).toThrow(TypeError);
      expect(nativeTheme.themeSource).toBe("light");
    },
  );
});
