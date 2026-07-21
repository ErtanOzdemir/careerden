export const THEME_STORAGE_KEY = "careerden-theme";

export const themes = ["light", "system", "dark"] as const;

export type Theme = (typeof themes)[number];

const themeChangeListeners = new Set<(theme: Theme) => void>();
let isStorageListenerAttached = false;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.some((theme) => theme === value);
}

export function resolveTheme(value: unknown): Theme {
  return isTheme(value) ? value : "system";
}

export function getStoredTheme(): Theme {
  try {
    return resolveTheme(getLocalStorage()?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function initializeTheme(): Theme {
  const theme = getStoredTheme();
  ensureStorageSynchronization();
  synchronizeTheme(theme);
  return theme;
}

export function setThemePreference(theme: Theme): void {
  applyThemeClass(theme);

  try {
    getLocalStorage()?.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error("Failed to persist theme preference.", error);
  }

  synchronizeNativeTheme(theme);
  notifyThemeChange(theme);
}

export function subscribeToThemeChanges(onChange: (theme: Theme) => void): () => void {
  ensureStorageSynchronization();
  themeChangeListeners.add(onChange);
  return () => themeChangeListeners.delete(onChange);
}

function ensureStorageSynchronization(): void {
  if (typeof window === "undefined" || isStorageListenerAttached) {
    return;
  }

  window.addEventListener("storage", handleStorage);
  isStorageListenerAttached = true;
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== THEME_STORAGE_KEY) {
    return;
  }

  const theme = resolveTheme(event.newValue);
  synchronizeTheme(theme);
  notifyThemeChange(theme);
}

function notifyThemeChange(theme: Theme): void {
  for (const listener of themeChangeListeners) {
    listener(theme);
  }
}

function synchronizeTheme(theme: Theme): void {
  applyThemeClass(theme);
  synchronizeNativeTheme(theme);
}

function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.remove("light", "dark");

  if (theme !== "system") {
    root.classList.add(theme);
  }
}

function synchronizeNativeTheme(theme: Theme): void {
  if (typeof window === "undefined") {
    return;
  }

  const setNativeThemeSource = window.electronAPI?.setNativeThemeSource;
  if (!setNativeThemeSource) {
    return;
  }

  try {
    void setNativeThemeSource(theme).catch((error: unknown) => {
      console.error("Failed to synchronize the native theme.", error);
    });
  } catch (error) {
    console.error("Failed to synchronize the native theme.", error);
  }
}

function getLocalStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
