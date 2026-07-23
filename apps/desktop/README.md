# Careerden Desktop

The Careerden desktop app is the Electron runtime for the React application, local
LinkedIn scraping, and native follow-up notifications. The API and BullMQ workers remain
standalone services; the desktop installer does not embed the backend.

## Runtime Modes

| Mode                   | Renderer                | API routing                                                             |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Development            | Vite development server | The launch URL carries `VITE_API_BASE_URL` as `apiBaseUrl`              |
| Local production build | `apps/desktop/renderer` | Uses the API URL generated during the desktop build                     |
| Packaged installer     | `careerden://app`       | Electron proxies same-origin `/api/*` requests to the generated API URL |

Start the complete development stack from the repository root:

```bash
pnpm dev:desktop
```

In a packaged application, the request path is:

```text
React renderer at careerden://app
            |
            | fetch /api/* with credentials
            v
Electron custom-protocol handler
            |
            | rewrite to DESKTOP_API_BASE_URL and use the default Electron session
            v
Standalone Careerden API
```

The custom protocol serves bundled static assets, falls back to `index.html` for React
Router paths, and handles `/api` as a reverse proxy. The proxy gives the renderer one
stable, secure origin and lets Electron's default session manage authentication cookies.
It also avoids depending on a production web server and avoids cross-origin API and
cookie handling in the renderer.

Better Auth expects an HTTP(S) base URL internally. When the renderer runs on
`careerden://app`, the auth client temporarily constructs requests against
`https://desktop-auth.careerden.invalid`. A custom fetch implementation immediately
rewrites those requests to `careerden://app/api/auth`; the `.invalid` address is only a
local transport placeholder and is never contacted over the network.

## Native Follow-up Notifications

The notification path is:

```text
notifications worker -> notification stored -> Redis notification-change channel
        -> authenticated API SSE stream -> Electron main process
        -> renderer refresh and, when unfocused, an operating-system notification
```

The API exposes `GET /notifications/stream` as an authenticated, profile-scoped
server-sent event stream. Electron connects with the same default session used by the
renderer and local scraping worker, so sign-in and sign-out cookie changes wake the
stream without a second desktop credential store.

Runtime behavior:

- After sign-in, a signed macOS build asks for notification authorization when macOS has
  no prior decision. Existing grants and denials are respected, and no placeholder
  notification is shown while requesting permission.
- A newly created notification always tells the renderer to refresh its notification
  list and unread count when a window exists.
- An operating-system notification is shown only when no Careerden window is focused.
- Clicking the operating-system notification restores and focuses Careerden, opens the
  related application's timeline, and attempts to mark the notification as read.
- Unsupported native notifications do not block the in-app refresh.
- The stream retries transient failures with bounded backoff. Authentication failures
  wait for the desktop session to change; an HTTP 404 disables retries for that run.
- The stream carries new events only. It does not replay old reminders on application
  startup or reconnect, while existing unread items remain available from the normal
  notifications API.

Native notifications are another presentation of notifications created by the follow-up
reminder pipeline, not a separate scheduling channel.

## Build and Package

Build the Electron main process and production renderer from the repository root:

```bash
DESKTOP_API_BASE_URL=https://api.example.com \
  DESKTOP_UPDATE_REPOSITORY=owner/repository \
  CAREERDEN_REQUIRE_DESKTOP_API_BASE_URL=true \
  CAREERDEN_REQUIRE_DESKTOP_UPDATE_REPOSITORY=true \
  pnpm --filter @careerden/desktop build
```

The build writes a validated runtime configuration into the desktop output. The API URL
must be absolute HTTP(S) and cannot contain credentials, a query, or a fragment. A path
prefix is supported. `DESKTOP_API_BASE_URL` is public application configuration embedded
in the installer, so store it as a GitHub repository variable rather than a secret.
`DESKTOP_UPDATE_REPOSITORY` is the public `owner/repository` location whose published
GitHub Releases provide updates and policy metadata.

For non-release local builds, the URL falls back to `http://localhost:3000`. Release
builds set `CAREERDEN_REQUIRE_DESKTOP_API_BASE_URL=true` so an installer cannot be produced
accidentally with that fallback. If `DESKTOP_UPDATE_REPOSITORY` is omitted from a local
build, the packaged updater is disabled instead of falling back to the upstream
repository.

After building, package for the current host platform:

```bash
pnpm --filter @careerden/desktop package
```

Installers are written to `apps/desktop/release`. The GitHub release workflow is the
authoritative way to produce all supported targets and macOS notarization.

## Automatic Updates

Packaged desktop builds use `electron-updater` and public GitHub Releases. Development
builds do not contact the update service. A packaged build checks when the desktop
runtime starts, every hour while it remains open, and when the user selects **Check for
updates** in Settings.

The release workflow sets `DESKTOP_UPDATE_REPOSITORY` from GitHub's current
`owner/repository` context. electron-builder resolves its GitHub provider from the
checkout's `origin`, so a fork's workflow and installers use that fork's releases rather
than Careerden's upstream releases.

There are two independent release inputs:

- electron-builder generates `latest-mac.yml`, `latest.yml`, or `latest-linux.yml` plus
  blockmaps while packaging. These files identify the latest published version and the
  correct platform asset.
- [`release-policy.json`](release-policy.json) contains only the minimum supported
  version. The release workflow validates it and publishes the same content as
  `careerden-desktop-update-policy.json`.

Optional updates download automatically. When ready, the user can restart immediately,
choose **Later**, or let the app install the downloaded update when it quits. If the
installed version is lower than `minimumSupportedVersion`, a non-dismissible update
screen replaces the application until the required update is installed.

The last valid policy is cached under Electron's user-data directory. A fresh valid
policy always replaces the cache, including a lower minimum used for an emergency
rollback. If GitHub is unreachable, an already cached mandatory policy remains enforced;
without such a cache the application fails open and remains usable. Do not put a GitHub
token or other repository credential in the desktop client.

While this repository is private, unauthenticated installed clients cannot read release
metadata. Their checks fail open and Settings offers a retry. After the repository and
its published releases become public, the same updater-capable build can discover
updates without another configuration change. Builds older than `0.2.0` do not contain
the updater and must be upgraded to `0.2.0` or newer manually once.

No staged rollout percentage is configured, so every eligible client sees a published
release. If staging is introduced later, electron-updater stores a stable per-installation
identifier and compares its deterministic percentage with `stagingPercentage` from the
generated update metadata.

## Draft Release Workflow

Pushing a tag matching `v*.*.*` starts
`.github/workflows/desktop-release.yml`. The tag must exactly match `v` plus the version
in `apps/desktop/package.json`; for example, version `0.2.0` requires tag `v0.2.0`.

### One-time GitHub configuration

Create this repository variable:

- `DESKTOP_API_BASE_URL`: the production API base URL embedded in every installer.

`DESKTOP_UPDATE_REPOSITORY` requires no repository variable. GitHub Actions supplies it
automatically from its current repository context.

Create these GitHub Actions secrets for signed and notarized macOS builds:

- `CSC_LINK`: the Developer ID Application certificate, normally as a base64 value or
  secure URL accepted by electron-builder.
- `CSC_KEY_PASSWORD`: the certificate password.
- `APPLE_ID`: the Apple account used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: an app-specific password for that account.
- `APPLE_TEAM_ID`: the Apple Developer team identifier.

Windows and Linux builds currently have no configured code-signing credentials.

### Manual steps for each release

1. Update `apps/desktop/package.json` to the intended version and include that change in
   the release commit.
2. Decide whether older clients must be blocked. Keep
   `apps/desktop/release-policy.json` unchanged for an optional update, or set
   `minimumSupportedVersion` to the new version for a required update. The minimum
   cannot be greater than the package version.
3. Confirm the target API URL and the GitHub variable/secrets above, then run the full
   repository quality gates.
4. Merge or otherwise place the exact release commit on the protected/default branch.
5. Create and push the matching tag:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

6. Wait for every platform job and the draft-release job to succeed.
7. Download and smoke-test the installers, review the generated release notes, and
   compare installer hashes with `SHA256SUMS.txt`.
8. Confirm the platform `latest*.yml`, blockmap, and
   `careerden-desktop-update-policy.json` assets are present. Publish the draft manually
   in GitHub only after verification. Drafts are invisible to installed updaters.

The workflow builds these assets:

- macOS universal DMG and ZIP, signed and notarized.
- Windows x64 NSIS installer.
- Linux x64 AppImage.
- Platform `latest*.yml` metadata and update blockmaps generated by electron-builder.
- `careerden-desktop-update-policy.json`, validated from the tracked policy source.
- `SHA256SUMS.txt` containing a SHA-256 checksum for every release asset.

A checksum detects an incomplete, corrupted, or unexpectedly modified download. It is an
integrity check, not proof of publisher identity; code signing and a trusted release page
provide that separate authenticity signal.

On a system with GNU coreutils, verify every downloaded asset from the same directory
with:

```bash
sha256sum --check SHA256SUMS.txt
```

Rerunning a workflow may replace assets while its release remains a draft. The workflow
refuses to overwrite an already published release, so never move or reuse a published
version tag.

## Current Distribution Limits

- Windows installers are unsigned and may trigger operating-system reputation warnings.
- Linux AppImages are not signed by this workflow.
- Playwright browser binaries are not bundled in the installers; production distribution
  must provision a compatible browser before relying on local LinkedIn scraping.
- macOS signing and notarization require real Apple credentials and should be verified in
  GitHub Actions before publishing.
- Automatic updates require a public published GitHub Release; private repository assets
  are deliberately not authenticated from installed clients.
- Marketing download buttons remain placeholders until verified release assets are
  published and connected to the download experience.
