# Configuration

Every environment variable Careerden reads, with its default. Careerden Unplugged needs
none of these — see [development.md](development.md) to run it. For production container
and object-storage setup, see [deployment.md](deployment.md).

Copy `.env.example` to `.env`. Runtime schemas provide the defaults shown below unless
the variable is marked required.

## API, Auth, and Frontend

| Variable                    | Description                                                  | Default                  |
| --------------------------- | ------------------------------------------------------------ | ------------------------ |
| `NODE_ENV`                  | `development`, `test`, or `production`                       | `development`            |
| `PORT`                      | API port                                                     | `3000`                   |
| `DATABASE_URL`              | PostgreSQL connection string                                 | Required                 |
| `REDIS_URL`                 | Redis connection string                                      | `redis://localhost:6380` |
| `BETTER_AUTH_SECRET`        | Better Auth signing secret; 32+ bytes required in production | Development-only value   |
| `BETTER_AUTH_URL`           | Public API/auth base URL                                     | `http://localhost:3000`  |
| `WEB_ORIGIN`                | Allowed credentialed web origin                              | `http://localhost:5173`  |
| `VITE_API_BASE_URL`         | API URL used by the web and development desktop renderer     | `http://localhost:3000`  |
| `DESKTOP_API_BASE_URL`      | API URL embedded in a production desktop build               | `http://localhost:3000`  |
| `DESKTOP_UPDATE_REPOSITORY` | Public `owner/repository` used for desktop updates           | Unset                    |

## Creem Billing

| Variable               | Description                                                  | Default |
| ---------------------- | ------------------------------------------------------------ | ------- |
| `CREEM_API_KEY`        | Creem API key                                                | Unset   |
| `CREEM_WEBHOOK_SECRET` | Secret used to verify the raw `creem-signature` webhook HMAC | Unset   |
| `CREEM_PRODUCT_ID`     | Creem subscription product used for hosted checkout          | Unset   |
| `CREEM_PLAN_KEY`       | Internal plan identifier stored with subscriptions           | `pro`   |
| `CREEM_SUCCESS_URL`    | Browser destination after successful hosted checkout         | Unset   |
| `CREEM_TEST_MODE`      | Use Creem's test API                                         | `true`  |

Development and test environments may omit all three Creem credentials to disable
checkout, portal, and webhook routes. Partial Creem configuration is rejected. Production
requires `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, and `CREEM_PRODUCT_ID`, and requires
`CREEM_TEST_MODE=false`.

## Queue Operations Dashboard

| Variable                   | Description                            | Default |
| -------------------------- | -------------------------------------- | ------- |
| `BULLSTUDIO_PORT`          | Host port for the Bullstudio dashboard | `4000`  |
| `BULLSTUDIO_POLL_INTERVAL` | Redis polling interval in milliseconds | `5000`  |

## AI and Workers

| Variable                           | Description                                                  | Default  |
| ---------------------------------- | ------------------------------------------------------------ | -------- |
| `AI_PROVIDER`                      | `openai`, `gemini`, `deepseek`, `anthropic`, or `openrouter` | `openai` |
| `OPENAI_API_KEY`                   | OpenAI API key                                               | —        |
| `GEMINI_API_KEY`                   | Google Gemini API key                                        | —        |
| `DEEPSEEK_API_KEY`                 | DeepSeek API key                                             | —        |
| `ANTHROPIC_API_KEY`                | Anthropic API key                                            | —        |
| `OPENROUTER_API_KEY`               | OpenRouter API key                                           | —        |
| `LLM_WORKER_CONCURRENCY`           | Parallel match-analysis jobs                                 | `5`      |
| `LLM_WORKER_HEALTH_PORT`           | Private LLM worker health port                               | `3101`   |
| `DOCUMENTS_WORKER_CONCURRENCY`     | Parallel application-pack jobs                               | `1`      |
| `DOCUMENTS_WORKER_HEALTH_PORT`     | Private documents health port                                | `3102`   |
| `NOTIFICATIONS_WORKER_CONCURRENCY` | Parallel follow-up reminder jobs                             | `1`      |
| `NOTIFICATIONS_WORKER_HEALTH_PORT` | Private notifications health port                            | `3103`   |
| `NOTIFICATION_EMAIL_ENABLED`       | Send reminder emails through the active provider             | `false`  |

## Email, Storage, Scraping, and Tracing

| Variable                           | Description                             | Default                                |
| ---------------------------------- | --------------------------------------- | -------------------------------------- |
| `SMTP_HOST`                        | Development/test SMTP server host       | `localhost`                            |
| `SMTP_PORT`                        | Development/test SMTP server port       | `1025`                                 |
| `EMAIL_FROM`                       | Sender used for OTP and reminder emails | `Careerden <no-reply@careerden.local>` |
| `RESEND_API_KEY`                   | Production Resend API credential        | —                                      |
| `OBJECT_STORAGE_ENDPOINT`          | S3-compatible storage endpoint          | Development-only local endpoint        |
| `OBJECT_STORAGE_BUCKET`            | Generated file/template bucket          | `careerden`                            |
| `OBJECT_STORAGE_ACCESS_KEY_ID`     | S3-compatible access key                | Development-only `rustfsadmin`         |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | S3-compatible secret key                | Development-only `rustfsadmin`         |
| `OBJECT_STORAGE_REGION`            | S3-compatible region                    | `us-east-1`                            |
| `OBJECT_STORAGE_FORCE_PATH_STYLE`  | Use S3 path-style addressing            | `true`                                 |
| `OPEN_OBSERVE_URL`                 | OpenTelemetry HTTP trace endpoint       | `http://localhost:5080`                |
| `OPEN_OBSERVE_KEY`                 | OpenObserve Basic Auth credential       | Required                               |

Development and test runtimes deliver through SMTP, so the defaults route authentication and
enabled reminder emails to MailHog. Production selects the Resend HTTP API automatically. The API
requires `RESEND_API_KEY` and a valid, non-local `EMAIL_FROM`; the notifications worker requires
the same values when `NOTIFICATION_EMAIL_ENABLED=true`. `SMTP_FROM` is no longer accepted—rename it
to `EMAIL_FROM` in existing environments.

Before deploying, add and verify the `EMAIL_FROM` domain or subdomain in Resend, publish the SPF and
DKIM records it supplies, and create an API key. The sender domain must exactly match the verified
domain. Set `RESEND_API_KEY` and `EMAIL_FROM` on the API and, when reminder email is enabled, the
notifications worker. Follow-up outbox retries reuse their persisted message ID as Resend's
idempotency key. Reminder email delivery stops after 20 failed attempts or when its 23-hour retry
window expires, before Resend's 24-hour idempotency window expires; permanent provider rejections
and exhausted or stale events are dead-lettered instead of being sent indefinitely. The
notifications worker logs retry and dead-letter transitions using event identifiers without email
content.

The API, documents worker, and notifications worker must use the same object-storage
configuration. Existing `RUSTFS_*` names remain accepted for compatibility, but new
deployments should use `OBJECT_STORAGE_*`.

## Production Hardening

With `NODE_ENV=production`, the API refuses to start with a missing, known-development,
or shorter-than-32-byte `BETTER_AUTH_SECRET`. The API, documents worker, and notifications
worker also reject local object-storage endpoints, known development access keys, and
missing, known-development, or shorter-than-32-byte object-storage secrets. Generate
independent random secrets instead of copying the examples:

```bash
openssl rand -base64 32
```

Rotate deployed auth and storage credentials if a development/default value was ever
used. Changing `BETTER_AUTH_SECRET` invalidates existing authenticated sessions, so plan
for users to sign in again.
