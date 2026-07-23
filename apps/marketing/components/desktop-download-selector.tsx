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

export function DetectedDownloadButton() {
  const detectedPlatform = useDetectedPlatform();
  const detectedDownload = desktopRelease.downloads.find(
    ({ platform }) => platform === detectedPlatform,
  );

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
            Version {desktopRelease.version} · {detectedDownload.architecture} ·{" "}
            {detectedDownload.size} · {desktopRelease.publishedLabel}
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

export function DesktopDownloadGrid() {
  const detectedPlatform = useDetectedPlatform();

  return (
    <div className="download-platform-grid" id="all-downloads">
      {desktopRelease.downloads.map((download) => (
        <article
          className={download.platform === detectedPlatform ? "is-detected" : undefined}
          key={download.platform}
        >
          <div className="download-platform-heading">
            <span className="download-platform-icon">
              <DownloadIcon platform={download.platform} />
            </span>
            <div>
              <h3>{download.platformName}</h3>
              <p>
                {download.architecture} · {download.format}
              </p>
            </div>
            {download.platform === detectedPlatform ? <small>Detected</small> : null}
          </div>

          <DownloadLink download={download} className="download-file-link">
            <span>
              <strong>{download.fileName}</strong>
              <small>{download.size}</small>
            </span>
            <Download aria-hidden="true" />
          </DownloadLink>
        </article>
      ))}
    </div>
  );
}
