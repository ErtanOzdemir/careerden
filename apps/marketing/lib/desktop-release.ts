export type DesktopPlatformId = "macos" | "windows" | "linux";

// Platforms whose downloads the site offers. Releases contain only the platforms in
// apps/desktop/release-editions.json, macOS for now; the Windows and Linux entries below stay so
// they can be offered again once those platforms are released.
export const enabledDesktopPlatforms: readonly DesktopPlatformId[] = ["macos"];

function enabledDownloads(downloads: DesktopDownload[]): DesktopDownload[] {
  return downloads.filter(({ platform }) => enabledDesktopPlatforms.includes(platform));
}

// "macOS", "macOS or Windows", "macOS, Windows, or Linux", from a release's offered downloads.
export function formatPlatformNames(
  downloads: readonly DesktopDownload[],
  type: "conjunction" | "disjunction" = "conjunction",
): string {
  const names = [...new Set(downloads.map(({ platformName }) => platformName))];
  return new Intl.ListFormat("en", { style: "long", type }).format(names);
}

export type DesktopDownload = {
  platform: DesktopPlatformId;
  platformName: string;
  format: string;
  architecture: string;
  fileName: string;
  // Omitted until the release's file sizes are known.
  size?: string;
  url: string;
};

export const desktopRelease = {
  version: "0.2.0",
  publishedLabel: "July 23, 2026",
  releaseNotesUrl: "https://github.com/ErtanOzdemir/careerden/releases/tag/v0.2.0",
  downloads: enabledDownloads([
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
  ]),
} as const;

// Careerden Unplugged's installers, published by the desktop release workflow with the
// CareerdenUnplugged artifact prefix. The version must match apps/desktop/package.json, because
// release tags do.
const unpluggedVersion = "1.0.0";
const unpluggedDownloadBase = `https://github.com/ErtanOzdemir/careerden/releases/download/v${unpluggedVersion}`;

function unpluggedDownload(
  download: Omit<DesktopDownload, "fileName" | "url"> & { suffix: string },
): DesktopDownload {
  const { suffix, ...details } = download;
  const fileName = `CareerdenUnplugged-${unpluggedVersion}-${suffix}`;
  return { ...details, fileName, url: `${unpluggedDownloadBase}/${fileName}` };
}

export const unpluggedRelease = {
  version: unpluggedVersion,
  releaseNotesUrl: `https://github.com/ErtanOzdemir/careerden/releases/tag/v${unpluggedVersion}`,
  downloads: enabledDownloads([
    unpluggedDownload({
      platform: "macos",
      platformName: "macOS",
      format: "DMG",
      architecture: "Apple silicon",
      suffix: "arm64.dmg",
    }),
    unpluggedDownload({
      platform: "macos",
      platformName: "macOS",
      format: "DMG",
      architecture: "Intel",
      suffix: "x64.dmg",
    }),
    unpluggedDownload({
      platform: "windows",
      platformName: "Windows",
      format: "EXE",
      architecture: "64-bit",
      suffix: "x64.exe",
    }),
    unpluggedDownload({
      platform: "linux",
      platformName: "Linux",
      format: "AppImage",
      architecture: "64-bit",
      suffix: "x86_64.AppImage",
    }),
  ]),
} as const;
