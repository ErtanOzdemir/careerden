# Contracts

## Core Interfaces

- `JobSiteScraper`
  - `canHandle(url: string): boolean`
  - `scrapeJob(url: string): Promise<ScrapedJob>`
  - `scrapeCompany(input: CompanyLookupInput): Promise<ScrapedCompany>`
- `AiMatchingProvider`
  - `analyze(input: MatchAnalysisInput): Promise<MatchAnalysisResult>`
- `TemplateRenderer`
  - `render(templateId: string, data: Record<string, unknown>): Promise<string | Buffer>`
- `DocumentRenderer`
  - `htmlToPdf(html: string): Promise<Buffer>`
- `FileStorage`
  - `put(file: StoredFileInput): Promise<StoredFile>`
  - `getSignedUrl(fileId: string): Promise<string>`

## Data Shape Guidance

- Store raw scrape payloads separately from normalized fields.
- Keep provider-specific fields behind metadata or JSON columns when they are not part of the stable domain model.
- Validate URL input, AI JSON output, and document template data at the boundary.

## API Surface

- `POST /job-applications`
- `GET /job-applications`
- `GET /job-applications/:id`
- `GET /job-applications/:id/documents/:documentId/download`
- `POST /profiles`
- `GET /profiles/:id`

## Testing Expectations

- Test URL routing for scraper selection.
- Test queue/job state transitions.
- Test schema validation for AI output.
- Test template rendering and PDF generation separately.
