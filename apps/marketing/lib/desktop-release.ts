export type DesktopPlatformId = "macos" | "windows" | "linux";

export type DesktopDownload = {
  platform: DesktopPlatformId;
  platformName: string;
  format: string;
  architecture: string;
  fileName: string;
  size: string;
  url: string;
};

export const desktopRelease = {
  version: "0.2.0",
  publishedLabel: "July 23, 2026",
  releaseNotesUrl: "https://github.com/ErtanOzdemir/careerden/releases/tag/v0.2.0",
  downloads: [
    {
      platform: "macos",
      platformName: "macOS",
      format: "DMG",
      architecture: "Universal",
      fileName: "Careerden-0.2.0-universal.dmg",
      size: "219.8 MB",
      url: "https://github.com/ErtanOzdemir/careerden/releases/download/v0.2.0/Careerden-0.2.0-universal.dmg",
    },
    {
      platform: "windows",
      platformName: "Windows",
      format: "EXE",
      architecture: "64-bit",
      fileName: "Careerden-0.2.0-x64.exe",
      size: "100.6 MB",
      url: "https://github.com/ErtanOzdemir/careerden/releases/download/v0.2.0/Careerden-0.2.0-x64.exe",
    },
    {
      platform: "linux",
      platformName: "Linux",
      format: "AppImage",
      architecture: "64-bit",
      fileName: "Careerden-0.2.0-x86_64.AppImage",
      size: "133.0 MB",
      url: "https://github.com/ErtanOzdemir/careerden/releases/download/v0.2.0/Careerden-0.2.0-x86_64.AppImage",
    },
  ] satisfies DesktopDownload[],
} as const;
