# Workflow

For source placement and bounded-context rules, read `architecture.md` first.

## Submission Flow

1. Validate the LinkedIn job URL.
2. Create a `job_application` record.
3. Enqueue background processing.
4. Scrape the job page.
5. Scrape the company LinkedIn page.
6. Discover and scrape the company website and career page when available.
7. Normalize the collected data.
8. Run AI matching against the user profile.
9. Render the CV and cover letter from templates.
10. Convert outputs to PDF.
11. Store artifacts and update status.

## Status Model

- Use explicit states such as `queued`, `scraping`, `analyzing`, `generating_documents`, `completed`, and `failed`.
- Persist a failure reason when a run stops.
- Emit events or processing logs for each major transition.

## AI Output

- Require structured JSON from the AI provider.
- Validate output before saving or rendering.
- Include at minimum match score, criteria matches, missing skills, recommended highlights, personalized summary, and cover-letter guidance.

## Documents

- Fill `{{field}}` placeholders from user profile data and AI recommendations.
- Keep template rendering deterministic.
- Treat PDF generation as a separate infrastructure step.
