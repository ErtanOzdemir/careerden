# Error and Retry Semantics

## Application Errors

Use `ApplicationError` for expected, transport-independent failures:

- `validation`: operation input/state is invalid.
- `not_found`: the resource is absent or intentionally hidden by ownership rules.
- `conflict`: current state or claim ownership conflicts with the operation.
- `forbidden`: authenticated actor is known but prohibited where hiding is not required.

Do not put HTTP status codes or BullMQ classes in application/domain logic.

## API Mapping

Map application codes centrally:

- `validation` → 400
- `forbidden` → 403
- `not_found` → 404
- `conflict` → 409
- unexpected error → 500 with `internal`

Authentication uses 401 with `unauthorized`. All API error payloads conform to the shared `ApiErrorResponse` contract and include stable `code` and `error` fields; validation may add `issues`, internal failures may add `traceId`, and application details may add passthrough fields. Detail fields must not override stable fields.

## Desktop API Handling

- Parse non-success responses into `DesktopApiError` with status, code, message, and details; tolerate non-JSON proxy/service bodies.
- Never classify errors by matching formatted message strings.
- Treat terminal claim/submission client errors as local stop/drop decisions and do not send a secondary failure request.
- Continue reporting actual local scraper failures through the scrape-failure API.
- Let expired scraping claims become reclaimable according to repository policy.

## BullMQ Handling

- At each worker processor boundary, convert `ApplicationError` to BullMQ `UnrecoverableError` so validation, not-found, conflict, and forbidden failures do not consume retries.
- Rethrow unknown/database/Redis/SMTP/AI/provider errors unchanged so BullMQ attempts and backoff remain effective.
- Keep application status/failure event persistence in use cases and worker failure logging in worker apps.

## Tests

- Verify every application-code-to-status mapping and stable error payload.
- Verify desktop parsing for coded JSON and non-JSON responses.
- Verify terminal desktop responses do not trigger secondary failure calls.
- Verify worker adapters make typed failures unrecoverable and preserve generic error identity.
