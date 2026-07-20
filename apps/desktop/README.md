# Link2CV Desktop

The Link2CV desktop app is the Electron runtime for the React application, local
LinkedIn scraping, and native follow-up notifications. The API and BullMQ workers remain
standalone services; the desktop installer does not embed the backend.

## Runtime Modes

| Mode                   | Renderer                | API routing                                                             |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Development            | Vite development server | The launch URL carries `VITE_API_BASE_URL` as `apiBaseUrl`              |
| Local production build | `apps/desktop/renderer` | Uses the API URL generated during the desktop build                     |
| Packaged installer     | `link2cv://app`         | Electron proxies same-origin `/api/*` requests to the generated API URL |

Start the complete development stack from the repository root:

```bash
pnpm dev:desktop
```

In a packaged application, the request path is:

```text
React renderer at link2cv://app
            |
            | fetch /api/* with credentials
            v
Electron custom-protocol handler
            |
            | rewrite to DESKTOP_API_BASE_URL and use the default Electron session
            v
Standalone Link2CV API
```

The custom protocol serves bundled static assets, falls back to `index.html` for React
Router paths, and handles `/api` as a reverse proxy. The proxy gives the renderer one
stable, secure origin and lets Electron's default session manage authentication cookies.
It also avoids depending on a production web server and avoids cross-origin API and
cookie handling in the renderer.

Better Auth expects an HTTP(S) base URL internally. When the renderer runs on
`link2cv://app`, the auth client temporarily constructs requests against
`https://desktop-auth.link2cv.invalid`. A custom fetch implementation immediately
rewrites those requests to `link2cv://app/api/auth`; the `.invalid` address is only a
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

- A newly created notification always tells the renderer to refresh its notification
  list and unread count when a window exists.
- An operating-system notification is shown only when no Link2CV window is focused.
- Clicking the operating-system notification restores and focuses Link2CV, opens the
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
  LINK2CV_REQUIRE_DESKTOP_API_BASE_URL=true \
  pnpm --filter @link2cv/desktop build
```

The build writes a validated runtime configuration into the desktop output. The API URL
must be absolute HTTP(S) and cannot contain credentials, a query, or a fragment. A path
prefix is supported. `DESKTOP_API_BASE_URL` is public application configuration embedded
in the installer, so store it as a GitHub repository variable rather than a secret.

For non-release local builds, the URL falls back to `http://localhost:3000`. Release
builds set `LINK2CV_REQUIRE_DESKTOP_API_BASE_URL=true` so an installer cannot be produced
accidentally with that fallback.

After building, package for the current host platform:

```bash
pnpm --filter @link2cv/desktop package
```

Installers are written to `apps/desktop/release`. The GitHub release workflow is the
authoritative way to produce all supported targets and macOS notarization.

## Draft Release Workflow

Pushing a tag matching `v*.*.*` starts
`.github/workflows/desktop-release.yml`. The tag must exactly match `v` plus the version
in `apps/desktop/package.json`; for example, version `0.2.0` requires tag `v0.2.0`.

### One-time GitHub configuration

Create this repository variable:

- `DESKTOP_API_BASE_URL`: the production API base URL embedded in every installer.

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
   the release commit. Until the Settings version label is derived from Electron at
   runtime, update the matching label in `apps/web/src/pages/Settings.tsx` as well.
2. Confirm the target API URL and the GitHub variable/secrets above, then run the full
   repository quality gates.
3. Merge or otherwise place the exact release commit on the protected/default branch.
4. Create and push the matching tag:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

5. Wait for every platform job and the draft-release job to succeed.
6. Download and smoke-test the installers, review the generated release notes, and
   compare installer hashes with `SHA256SUMS.txt`.
7. Publish the draft manually in GitHub only after verification.

The workflow builds these assets:

- macOS universal DMG, signed and notarized.
- Windows x64 NSIS installer.
- Linux x64 AppImage.
- `SHA256SUMS.txt` containing a SHA-256 checksum for every installer.

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
- There is no automatic updater. Each release is installed manually.
- Marketing download buttons remain placeholders until verified release assets are
  published and connected to the download experience.
