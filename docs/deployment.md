# Deployment

Running the cloud edition in production: object storage on Cloudflare R2 and the API and
worker containers on Coolify. Set the variables from [configuration.md](configuration.md)
on every service described here. Desktop installers follow a separate process — see the
[desktop runtime and release guide](../apps/desktop/README.md).

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
