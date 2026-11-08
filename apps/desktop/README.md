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
key, and GitHub Releases for update checks.

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

**Settings → Your data** exports a `.careerden` backup, a zip archive (`manifest.json`, `tables/<table>.json`, and
`files/`), imports one, and reveals the data folder. The preload exposes these as three
argument-free calls; the main process opens the save and open dialogs and the backend utility
process reads and writes the archive. An import is validated and restored into
`userData/data.import` first, the current data is exported to `userData/backups/` as
`before-import-<timestamp>.careerden`, and only then are the folders swapped behind the same loopback
port. `ai-credentials.bin` is never part of a backup.

### Local log file

Both editions write one log file for all desktop processes to `userData/logs/careerden.log`.
On macOS the local edition's file is
`~/Library/Application Support/Careerden Unplugged/logs/careerden.log`. Each line is a JSON
object with `time`, `level`, `process` (`main`, `local-backend`, or `scraper`), `event`, and
metadata fields. The file rotates at 5 MB into `careerden.1.log` through `careerden.4.log`.

The log records the app version, edition, OS, and architecture at startup; database migrations;
the local backend's start, stop, and exit codes; update checks, downloads, and errors; scraping
and AI failures with their category, status code, and provider; and the trace IDs of the API's
internal error responses. It never records API keys, the per-launch session token, profile
content, job posting text, prompts, model output, or file contents. Only the main process
writes the file; utility processes post entries to it.

The level is `info` by default. **Settings → Diagnostics → Detailed logging** in the local
edition switches to `debug` and stores the choice in `userData/log-settings.json`.

Run it in development without Docker services:

```bash
pnpm dev:desktop:local
```

The launcher starts the web dev server and Electron with a fixed backend port (`3010`) and
a per-run token so the Vite proxy can reach the backend. Local data lives in
`Careerden Unplugged` under the operating system's application data directory.

### Pre-migration snapshots

The backend migrates the database on every start, so before a start that may change existing
data it copies `data/pglite`, `data/files`, and `data/last-opened-version.json` to
`userData/backups/before-migration-<UTC time>/`, together with a `snapshot.json` recording the
version the data came from and the version opening it. A snapshot is taken when the app version
differs from the one in `data/last-opened-version.json`, or when it is unchanged but migrations
are pending (for example after a failed upgrade). Pending migrations are listed with the
database open, and it is closed again before anything is copied; the copy is written under a
`.partial-` name and renamed only when complete. The version record is updated only after the
migrations succeed. A fresh install has nothing to copy, and a relaunch of the same version takes
no snapshot.

The three newest pre-migration snapshots are kept and older ones deleted; other backups in the
folder are left alone. Before copying, the backend checks that the disk has room for the copy
plus 100 MB. Without it, the start fails with a message asking the user to free up space, and
neither migrations nor the version record are touched. Snapshot creation and pruning are logged
to the [local log file](#local-log-file) as `data_snapshot.updated` events.

Copying a snapshot's contents over `data/` while the app is closed opens the app with the data
as that version left it. Only open it with the version recorded in its `snapshot.json` or newer.

### Startup recovery

Migrations run on every start, against data only this device has. When they cannot, the app
shows a recovery screen at `/recovery` instead of opening:

| Failure                                                   | Detected by                            | Screen                                 |
| --------------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| PGlite cannot open `data/pglite` (damaged, incompatible)  | The first query fails                  | Your data could not be opened          |
| A migration fails                                         | `migrate.latest` throws                | Your data could not be updated         |
| The data has migrations this build does not ship          | `knex_migrations` compared before Knex | Created by a newer version; install it |
| The backend exits or times out before it is ready         | `LocalBackendProcess.start()` rejects  | Could not start                        |
| The backend exits unexpectedly three times in two minutes | `userData/local-backend-restarts.json` | Keeps stopping                         |

The first two unexpected exits after a successful start still relaunch the app with the
"Your data is safe" notice. The screen offers to restore a snapshot, open the data folder,
copy diagnostics (error, app and Electron version, last migration, and OS, with the home
folder replaced by `~`), or quit. Snapshots are listed through `LocalDataSnapshotSource`.
The current source reads data-folder copies named `backups/<kind>-<UTC time>/`, for example
`before-migration-2026-11-05T09-15-00Z/` holding `pglite/` and `files/`. A restore copies one
over `data/`, keeps the replaced folder as `backups/before-restore-<time>/`, and relaunches.
The screen says so when no snapshot exists yet.

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
dropped: releasing it again means adding `cloud` to
[`release-editions.json`](release-editions.json), which sets both the build matrix of
[`desktop-release.yml`](../../.github/workflows/desktop-release.yml) and the editions the
release verification requires, and drops the "Unplugged" suffix from the draft release
title. The cloud edition can still be packaged locally with
`pnpm --filter @careerden/desktop package`.

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
8. Run `pnpm verify:desktop-release <tag>` against the draft. It checks that every edition in
   `release-editions.json` has its `latest*.yml` or `local*.yml` metadata for all three
   platforms at the tag's version, that every referenced file is present with a matching
   `sha512`, and that `careerden-desktop-update-policy.json` and `SHA256SUMS.txt` are valid.
   The workflow already ran the same check before creating the draft. Publish the draft
   manually in GitHub only after verification. Drafts are invisible to installed updaters.
   Releasing only one edition is not supported; see
   [Desktop releases contain every edition](../../docs/deployment.md#desktop-releases-contain-every-edition).
9. If the workflow warned about a missing database upgrade fixture, generate it from the tag
   and commit it in a follow-up pull request, as described in
   [Database upgrade fixtures](../../docs/development.md#database-upgrade-fixtures).

The workflow builds these assets:

- macOS x64 and arm64 DMGs and updater ZIPs, signed and notarized.
- Windows x64 NSIS installer.
- Linux x64 AppImage.
- Platform `latest*.yml` (Careerden) and `local*.yml` (Unplugged) metadata and update
  blockmaps generated by electron-builder, for every edition in `release-editions.json`.
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
