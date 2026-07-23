import type { DesktopPlatformId } from "@/lib/desktop-release";

export function PlatformLogo({ platform }: { platform: DesktopPlatformId }) {
  if (platform === "macos") {
    return (
      <svg aria-hidden="true" className="platform-logo" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.61 1.09Zm3.38-3.07C16.37 2.82 16.93 1.4 16.77 0c-1.21.05-2.66.81-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.72-.69 3.56-1.7Z"
        />
      </svg>
    );
  }

  if (platform === "windows") {
    return (
      <svg aria-hidden="true" className="platform-logo" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="m2 3.3 8.7-1.2v8.7H2V3.3Zm9.7-1.35L22 .5v10.3H11.7V1.95ZM2 11.8h8.7v8.7L2 19.3v-7.5Zm9.7 0H22v10.3l-10.3-1.45V11.8Z"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="platform-logo" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M12 1.5c-3.04 0-4.65 2.3-4.65 5.68 0 1.46-.3 2.43-1.15 3.7-1.03 1.54-2.2 3.28-2.2 5.62 0 2.06.83 3.24 2.47 3.52.8.14 1.45-.03 2.02-.35.94.85 2.16 1.33 3.51 1.33s2.57-.48 3.51-1.33c.57.32 1.22.49 2.02.35C19.17 19.74 20 18.56 20 16.5c0-2.34-1.17-4.08-2.2-5.62-.85-1.27-1.15-2.24-1.15-3.7C16.65 3.8 15.04 1.5 12 1.5Z"
      />
      <ellipse cx="12" cy="15.1" fill="var(--platform-logo-cutout, #fff)" rx="4.15" ry="4.8" />
      <ellipse cx="10.15" cy="7.1" fill="var(--platform-logo-cutout, #fff)" rx="1.35" ry="1.85" />
      <ellipse cx="13.85" cy="7.1" fill="var(--platform-logo-cutout, #fff)" rx="1.35" ry="1.85" />
      <circle cx="10.45" cy="7.35" r=".42" fill="currentColor" />
      <circle cx="13.55" cy="7.35" r=".42" fill="currentColor" />
      <path fill="var(--platform-logo-cutout, #fff)" d="m12 8.1 2.2 1.2-2.2 1.35L9.8 9.3 12 8.1Z" />
      <path
        fill="currentColor"
        d="M8.2 20.25c-.8-.08-2.42.18-3.26.75-.45.31-.35.83.18.96 1.45.36 3.23.14 4.23-.58l-1.15-1.13Zm7.6 0c.8-.08 2.42.18 3.26.75.45.31.35.83-.18.96-1.45.36-3.23.14-4.23-.58l1.15-1.13Z"
      />
    </svg>
  );
}
