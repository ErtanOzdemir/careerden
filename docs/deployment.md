# Deployment

Running the cloud edition in production: object storage on Cloudflare R2 and the API and
worker containers on Coolify. Set the variables from [configuration.md](configuration.md)
on every service described here. Desktop installers follow a separate process — see the
[desktop runtime and release guide](../apps/desktop/README.md).

## Desktop releases contain every edition

Careerden and Careerden Unplugged ship together in one GitHub release per tag. An installed
app reads only its own edition's and platform's updater metadata from the latest release:
`latest-mac.yml`, `latest.yml`, and `latest-linux.yml` for Careerden, and `local-mac.yml`,
`local.yml`, and `local-linux.yml` for Unplugged. If that file is missing, the updater treats
it as "no update" and fails open, so a release without one edition or one platform silently
stops that edition's updates on that platform until a complete release is published.

Releasing only one edition, such as a cloud-only hotfix, is therefore not supported. Every
release must contain every edition and platform listed in `apps/desktop/release-editions.json`.
Once an edition or platform has been released, it stays in that file. Before creating the draft release, the
release workflow runs `apps/desktop/scripts/verify-desktop-release.mjs`, which fails the job
unless the release meets all of these:

- every listed edition's metadata file for every listed platform is present
- each file's `version` equals the tag
- every installer or ZIP each file references is in the release with a matching `sha512` and
  size
- `careerden-desktop-update-policy.json` is a valid policy no newer than the release

Only Careerden Unplugged on macOS is listed for now, so only `local-mac.yml` is required. Each
added edition or platform adds its files: Unplugged on all three platforms needs three, and both
editions on all three need six. Windows and Linux stay out of releases until they are tested.
Check a draft or published release the same way before or after publishing it:

```bash
pnpm verify:desktop-release v1.0.0
# or for another repository, or other editions and platforms regardless of the file:
pnpm verify:desktop-release v1.0.0 --repo owner/careerden --editions cloud,local --platforms macos,windows,linux
```

The command downloads the release with `gh`, so it needs an authenticated GitHub CLI and room
for the installers. Remote checks also verify `SHA256SUMS.txt` against every asset.

## Cloudflare R2 in production

Create a private R2 bucket and an API token with Object Read & Write access scoped to that
bucket. Set these values on the API, documents worker, and notifications worker:

```bash
OBJECT_STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
OBJECT_STORAGE_BUCKET=careerden-production
OBJECT_STORAGE_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
OBJECT_STORAGE_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_FORCE_PATH_STYLE=false
```

Create the bucket before starting Careerden. Keep the bucket private; Careerden generates
15-minute presigned download URLs. Use the R2 S3 API endpoint shown above rather than a
custom domain, because R2 presigned URLs are supported only on the S3 API domain.

## Production containers on Coolify

The API and each BullMQ worker have a dedicated production Dockerfile. Build every image
from the repository root so Turborepo can prune the correct workspace dependency graph:

```bash
docker build -f apps/api/Dockerfile -t careerden-api .
docker build -f apps/llm-worker/Dockerfile -t careerden-llm-worker .
docker build -f apps/documents-worker/Dockerfile -t careerden-documents-worker .
docker build -f apps/notifications-worker/Dockerfile -t careerden-notifications-worker .
```

The API and documents-worker images install Playwright's matching Chromium headless shell
and render a smoke-test PDF during the image build. This keeps the browser in
`/ms-playwright` instead of relying on an ephemeral home-directory cache. The LLM and
notifications images do not download browser binaries.

Configure four separate Coolify applications with the Dockerfile build pack and `/` as
the Base Directory:

| Coolify application  | Dockerfile location                     | Network exposure         |
| -------------------- | --------------------------------------- | ------------------------ |
| API                  | `/apps/api/Dockerfile`                  | Port `3000`, `/health`   |
| LLM worker           | `/apps/llm-worker/Dockerfile`           | No public port or domain |
| Documents worker     | `/apps/documents-worker/Dockerfile`     | No public port or domain |
| Notifications worker | `/apps/notifications-worker/Dockerfile` | No public port or domain |

Each worker image has an internal Docker health check against its loopback-only
`/health/ready` endpoint. Readiness requires an active, unpaused BullMQ worker plus
successful Redis and PostgreSQL checks. The endpoints and health ports are operational
inside the container only; do not assign public Coolify domains to worker applications.

Assign the Redis Database Resource and all four applications to the same Coolify Server
and Destination. Copy Redis's **Internal URL** into an environment-level shared variable,
for example `CAREERDEN_REDIS_URL`, and set this on every application:

```text
REDIS_URL={{environment.CAREERDEN_REDIS_URL}}
```

Keep Redis private. Do not use `localhost`, `127.0.0.1`, or the development default
`redis://localhost:6380` from a production container: those addresses refer to the
container itself. If the Redis credential contains `$` or another value Coolify may
interpolate, mark the shared variable as literal. Let Coolify manage the Destination
network rather than adding custom Docker networks.
