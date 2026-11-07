# Careerden Desktop

The Careerden desktop app is the Electron runtime for the React application, local
LinkedIn scraping, and native follow-up notifications. It builds as two editions from the
same code:

- **Careerden** (`cloud`) connects to the standalone API and BullMQ workers; the installer
  does not embed the backend.
- **Careerden Unplugged** (`local`) is the local edition described in
  [Careerden Unplugged](#careerden-unplugged). It embeds the backend and sends no data to a
  Careerden server.

## Runtime Modes

| Mode                   | Renderer                | API routing                                                             |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Development            | Vite development server | Vite reads `VITE_API_BASE_URL` from the trusted development environment |
| Local production build | `apps/desktop/renderer` | Uses the API URL generated during the desktop build                     |
| Packaged installer     | `careerden://app`       | Electron proxies same-origin `/api/*` requests to the generated API URL |

Renderer query parameters do not control the API destination in any mode. This prevents a
crafted Careerden URL from redirecting authentication or application requests to another
origin.

Start the complete development stack from the repository root:

```bash
pnpm dev:desktop
```

Turbo starts the API, workers, web app, and desktop app together. The desktop `dev` script builds
the main process, then waits for the API health check and the Vite dev server before launching
Electron. Unpackaged runs load development defaults such as `VITE_DEV_SERVER_URL` from
`apps/desktop/.env.development`; variables already set in the environment take precedence.

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

## Careerden Unplugged

"Unplugged" means unplugged from Careerden's servers, not from the internet: there is no
account, and the user's data never leaves the device.

The local edition runs the API and its background work inside the app, for the single
person using the device. Nothing is sent to a Careerden server. The only network traffic is
public LinkedIn guest pages for imports, the AI provider the user configures with their own
key, GitHub Releases for update checks, and the AI model catalog on GitHub.

```text
React renderer at careerden://app
            |
            | fetch /api/*
            v
Electron custom-protocol handler (adds the per-launch session token)
            |
            v
Local backend utility process on 127.0.0.1:<random port>
  @careerden/api-app/local: embedded PGlite, files on disk, in-process outbox runner
            |
            | PDF printing and the decrypted AI key
            v
Electron main process (hidden print window, safeStorage key store)
```

| Concern       | Cloud edition                    | Local edition                                               |
| ------------- | -------------------------------- | ----------------------------------------------------------- |
| Accounts      | Better Auth sessions and cookies | None; one local user, per-launch token on loopback          |
| Database      | PostgreSQL                       | PGlite in `userData/data/pglite`                            |
| Files         | S3-compatible storage            | `userData/data/files` with signed, expiring links           |
| Background    | BullMQ workers on Redis          | In-process outbox runner; reminders restored on start       |
| PDF rendering | Playwright Chromium              | Electron `printToPDF` without scripts or network access     |
| AI            | Server keys and monthly credits  | User keys in `safeStorage`, unmetered                       |
| Email         | Resend or SMTP                   | None; reminders are in-app and desktop notifications        |
| Updates       | `latest*.yml`                    | `local*.yml` in the same GitHub release                     |
| Identity      | `com.careerden.desktop`          | `com.careerden.unplugged`, separate `userData` and keychain |

The renderer is built with `VITE_CAREERDEN_EDITION=local`, which drops sign-in, billing,
credits, and support, and adds the AI provider section to Settings. The preload exposes
the key store only when the main process opens the window with
`--careerden-edition=local`; it can save, test, switch, and remove keys but never read one
back. Reminders missed while the app was closed are delivered on the next start if the
follow-up is at most seven days old.

Run it in development without Docker services:

```bash
pnpm dev:desktop:local
```

The launcher starts the web dev server and Electron with a fixed backend port (`3010`) and
a per-run token so the Vite proxy can reach the backend. Local data lives in
`Careerden Unplugged` under the operating system's application data directory.

### AI model catalog

Provider model ids are not fixed in a release. [`ai-models.json`](ai-models.json) lists, per
provider, the recommended model and an ordered fallback list (`schemaVersion` 1, validated by
`aiModelCatalogSchema` in `@careerden/contracts`). Packaged local builds with
`DESKTOP_UPDATE_REPOSITORY` read it from the repository's default branch, so a change merged
there takes effect without a release:

```text
https://raw.githubusercontent.com/<owner/repository>/HEAD/apps/desktop/ai-models.json
```

The main process fetches it at startup and every hour, caches the last valid copy as
`userData/ai-models-cache.json`, and otherwise uses the defaults embedded in the build
(`embeddedAiModelCatalog`). An unreachable or invalid file never replaces a valid catalog, and
providers missing from the file keep their embedded defaults. A test keeps `ai-models.json`
equal to the embedded defaults, so edit both in the same change and the next release embeds
what installed apps already fetch.

Each analysis tries the model the user entered on the **AI provider** page, then the
recommended model, then the fallbacks. When a provider reports that model as not found or
retired, it retries once with the next model. The model that produced an analysis is stored on
it as `generatedBy` and appears in the **AI analysis completed** timeline event.

## Renderer Security Boundary

The main renderer runs with context isolation and Chromium sandboxing enabled and without
Node integration. Main-window navigation is limited to the exact development renderer
authority or packaged `careerden://app` authority. Requests to open a new window are
always denied; only validated `https:` and `mailto:` destinations may be handed to the
operating system as external links. Renderer permission checks and requests are denied
unless a future capability explicitly introduces a narrower policy. Every privileged IPC
invocation must come from the active main window's main frame; child frames and other
`WebContents` instances are rejected before a channel handler runs. The preload exposes
only operations used by the renderer and does not provide arbitrary application-path
lookup.

Packaged renderer responses include a restrictive CSP. Same-origin and HTTPS frames are
allowed for signed PDF document previews; workers, objects, unexpected connection targets,
and inline/evaluated scripts remain denied. Additional response headers disable
content-type sniffing, suppress referrer data, and deny browser permission features. The
release package flips Electron fuses to disable `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`,
inspector arguments, and extra `file:` privileges. It also enables OS-backed cookie
encryption, embedded ASAR integrity validation, and loading application code only from
`app.asar`. Cookie encryption is a one-way packaged-app migration: do not disable that
fuse in a later release.

## Local LinkedIn Scraping

The desktop claims queued LinkedIn URLs and processes them in an isolated Electron utility
process. The job and company adapters fetch public guest HTTP responses, preserve the raw
source material, and return normalized scrape data without connecting or storing a user's
LinkedIn account session.

## Native Follow-up Notifications

The notification path is:

```text
notifications worker -> notification stored -> Redis notification-change channel
        -> authenticated API SSE stream -> Electron main process
        -> renderer refresh and an operating-system notification
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
- An operating-system notification is shown for every new notification, including while
  Careerden is in front.
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

Build and package the local edition with its edition variables and no API URL:

```bash
CAREERDEN_EDITION=local VITE_CAREERDEN_EDITION=local \
  DESKTOP_UPDATE_REPOSITORY=owner/repository \
  pnpm --filter @careerden/desktop build
```

```bash
pnpm --filter @careerden/desktop package:local
```

`electron-builder.local.yml` extends `electron-builder.yml` and changes only the identity,
artifact names (`CareerdenUnplugged-*`), output directory (`apps/desktop/release-local`), and
updater channel. Local builds reject `DESKTOP_API_BASE_URL`.

Installers are written to `apps/desktop/release`. The GitHub release workflow is the
authoritative way to produce all supported targets and macOS notarization. On macOS,
packaging produces separate x64 and arm64 DMGs and updater ZIPs so each installation
contains only the Electron binary for its architecture.

Only Careerden Unplugged is released for now. The cloud edition is deferred rather than
dropped: releasing it again means adding `cloud` back to the `edition` matrix in
[`desktop-release.yml`](../../.github/workflows/desktop-release.yml) and dropping the
"Unplugged" suffix from the draft release title, both marked with a TODO there. The cloud
edition can still be packaged locally with `pnpm --filter @careerden/desktop package`.

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
  correct platform asset. The macOS metadata contains both architecture-specific ZIPs;
  electron-updater selects arm64 on Apple silicon and x64 on Intel, including when an
  existing universal installation upgrades to the split packages.
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
7. Download and smoke-test both macOS architecture installers and every other platform
   installer, review the generated release notes, and compare installer hashes with
   `SHA256SUMS.txt`.
8. Confirm the platform `latest*.yml`, blockmap, and
   `careerden-desktop-update-policy.json` assets are present. Publish the draft manually
   in GitHub only after verification. Drafts are invisible to installed updaters.
9. If the workflow warned about a missing database upgrade fixture, generate it from the tag
   and commit it in a follow-up pull request, as described in
   [Database upgrade fixtures](../../docs/development.md#database-upgrade-fixtures).

The workflow builds these assets:

- macOS x64 and arm64 DMGs and updater ZIPs, signed and notarized.
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

- Both editions currently ship the same `node_modules`, so each installer carries the other
  edition's unused dependencies (about 105 MB uncompressed: PGlite in the cloud edition;
  OpenTelemetry, Better Auth, and Creem in the local edition). Bundling the local backend
  would remove them.
- Windows installers are unsigned and may trigger operating-system reputation warnings.
- Linux AppImages are not signed by this workflow.
- macOS signing and notarization require real Apple credentials and should be verified in
  GitHub Actions before publishing.
- Automatic updates require a public published GitHub Release; private repository assets
  are deliberately not authenticated from installed clients.
- The marketing download page must be updated when a newly verified release replaces the
  version and asset links currently promoted to visitors. Publish the measured size and
  direct link for both macOS architectures; the page asks Mac visitors to choose Apple
  silicon or Intel rather than inferring hardware from the browser.
