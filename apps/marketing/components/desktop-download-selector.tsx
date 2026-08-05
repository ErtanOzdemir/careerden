"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, Download } from "lucide-react";
import {
  desktopRelease,
  type DesktopDownload,
  type DesktopPlatformId,
} from "@/lib/desktop-release";
import { PlatformLogo } from "./platform-logo";

type NavigatorDetails = {
  platform?: string;
  userAgent?: string;
  userAgentData?: {
    platform?: string;
  };
};

type DesktopDownloadRelease = {
  version: string;
  publishedLabel: string;
  downloads: readonly DesktopDownload[];
};

export function detectDesktopPlatform({
  platform = "",
  userAgent = "",
  userAgentData,
}: NavigatorDetails): DesktopPlatformId | null {
  const details = `${userAgentData?.platform ?? ""} ${platform} ${userAgent}`;

  if (/Android|iPhone|iPad|iPod/i.test(details)) return null;
  if (/Windows|Win32|Win64/i.test(details)) return "windows";
  if (/Mac|macOS/i.test(details)) return "macos";
  if (/Linux|X11|CrOS/i.test(details)) return "linux";

  return null;
}

function DownloadIcon({ platform }: { platform: DesktopPlatformId }) {
  return <PlatformLogo platform={platform} />;
}

function DownloadLink({
  download,
  className,
  children,
}: {
  download: DesktopDownload;
  className: string;
  children: ReactNode;
}) {
  return (
    <a className={className} href={download.url} rel="noreferrer">
      {children}
    </a>
  );
}

function useDetectedPlatform() {
  const [detectedPlatform, setDetectedPlatform] = useState<DesktopPlatformId | null>(null);

  useEffect(() => {
    setDetectedPlatform(detectDesktopPlatform(window.navigator));
  }, []);

  return detectedPlatform;
}

function formatArchitectureChoices(downloads: readonly DesktopDownload[]) {
  return downloads.map(({ architecture }) => architecture).join(" or ");
}

export function DetectedDownloadButton({
  release = desktopRelease,
}: {
  release?: DesktopDownloadRelease;
} = {}) {
  const detectedPlatform = useDetectedPlatform();
  const detectedDownloads = release.downloads.filter(
    ({ platform }) => platform === detectedPlatform,
  );
  const detectedDownload = detectedDownloads.length === 1 ? detectedDownloads[0] : undefined;
  const detectedPlatformName = detectedDownloads[0]?.platformName;

  return (
    <div className="download-primary-action" aria-live="polite">
      {detectedDownload ? (
        <>
          <DownloadLink download={detectedDownload} className="download-primary-button">
            <DownloadIcon platform={detectedDownload.platform} />
            <span>Download for {detectedDownload.platformName}</span>
            <Download aria-hidden="true" />
          </DownloadLink>
          <p>
            Version {release.version} · {detectedDownload.architecture} · {detectedDownload.size} ·{" "}
            {release.publishedLabel}
          </p>
        </>
      ) : detectedDownloads.length > 1 && detectedPlatform && detectedPlatformName ? (
        <>
          <a className="download-primary-button" href={`#download-${detectedPlatform}`}>
            <DownloadIcon platform={detectedPlatform} />
            <span>Choose your {detectedPlatformName} download</span>
            <ArrowDown aria-hidden="true" />
          </a>
          <p>
            Version {release.version} · {formatArchitectureChoices(detectedDownloads)} ·{" "}
            {release.publishedLabel}
          </p>
        </>
      ) : (
        <>
          <a className="download-primary-button" href="#all-downloads">
            <Download aria-hidden="true" />
            <span>Choose your download</span>
            <ArrowDown aria-hidden="true" />
          </a>
          <p>Available for macOS, Windows, and Linux</p>
        </>
      )}
    </div>
  );
}

export function DesktopDownloadGrid({
  downloads = desktopRelease.downloads,
}: {
  downloads?: readonly DesktopDownload[];
} = {}) {
  const detectedPlatform = useDetectedPlatform();
  const downloadGroups = groupDownloadsByPlatform(downloads);

  return (
    <div className="download-platform-grid" id="all-downloads">
      {downloadGroups.map(({ downloads: platformDownloads, platform, platformName }) => (
        <article
          className={platform === detectedPlatform ? "is-detected" : undefined}
          id={`download-${platform}`}
          key={platform}
        >
          <div className="download-platform-heading">
            <span className="download-platform-icon">
              <DownloadIcon platform={platform} />
            </span>
            <div>
              <h3>{platformName}</h3>
              <p>
                {formatArchitectureChoices(platformDownloads)} ·{" "}
                {formatDownloadFormats(platformDownloads)}
              </p>
            </div>
            {platform === detectedPlatform ? <small>Detected</small> : null}
          </div>

          <div className="download-file-list">
            {platformDownloads.map((download) => (
              <DownloadLink
                download={download}
                className="download-file-link"
                key={download.fileName}
              >
                <span>
                  <strong>{download.fileName}</strong>
                  <small>
                    {platformDownloads.length > 1 ? `${download.architecture} · ` : null}
                    {download.size}
                  </small>
                </span>
                <Download aria-hidden="true" />
              </DownloadLink>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function groupDownloadsByPlatform(downloads: readonly DesktopDownload[]) {
  const groups = new Map<
    DesktopPlatformId,
    {
      platform: DesktopPlatformId;
      platformName: string;
      downloads: DesktopDownload[];
    }
  >();

  for (const download of downloads) {
    const existingGroup = groups.get(download.platform);
    if (existingGroup) {
      existingGroup.downloads.push(download);
    } else {
      groups.set(download.platform, {
        platform: download.platform,
        platformName: download.platformName,
        downloads: [download],
      });
    }
  }

  return [...groups.values()];
}

function formatDownloadFormats(downloads: readonly DesktopDownload[]) {
  return [...new Set(downloads.map(({ format }) => format))].join(" / ");
}
