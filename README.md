# Link2CV

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)

Turn LinkedIn job postings into profile-aware CV and cover-letter PDFs. Link2CV scrapes job listings, matches them against your profile using AI, and generates tailored documents — automatically.

## Quick Start

### Prerequisites

- **Node.js** 22+ (run `nvm use` to auto-select)
- **pnpm** 9.15+

### Setup

```bash
# Clone the repository
git clone git@github.com:ErtanOzdemir/link2cv.git
cd link2cv

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development servers
pnpm dev
```

The desktop app hosts the web UI in Electron. In development it loads the Vite dev server
and points the renderer at the standalone API server through `?apiBaseUrl=...`.

## Architecture

Link2CV is a TypeScript monorepo using clean architecture with clear separation of concerns.

```
link2cv/
├── apps/
│   ├── desktop/      Electron desktop shell
│   ├── llm-worker/   BullMQ worker for LLM analysis jobs
│   ├── api/          Express HTTP API app
│   └── web/          Frontend (vanilla TypeScript + Vite)
├── packages/
│   ├── domain/       Entities, workflow state, provider interfaces
│   ├── application/  Use cases and orchestration
│   ├── infrastructure/  DB, scrapers, AI, PDF, queue, storage adapters
│   ├── contracts/    Shared DTOs and Zod validation schemas
│   └── config/       Environment loading (dotenv + Zod)
```

Backend source is organized by bounded context inside those packages. Common contexts include `profiles`, `job-applications`, `scraping`, `matching`, `documents`, `storage`, `persistence`, and `queue`.

### Tech Stack

| Layer           | Technology                               |
| --------------- | ---------------------------------------- |
| Language        | TypeScript 5.7 (strict, ESM)             |
| Runtime         | Node.js 22                               |
| Package Manager | pnpm 9                                   |
| Monorepo        | Turborepo 2                              |
| HTTP Framework  | Express 4                                |
| Database        | PostgreSQL via Knex                      |
| Queue           | Redis + BullMQ                           |
| AI              | Vercel AI SDK (OpenAI, Gemini, DeepSeek) |
| Browser         | Playwright                               |
| Validation      | Zod 3                                    |
| Frontend        | Vite 6                                   |
| Testing         | Vitest 2                                 |
| Linting         | ESLint 10                                |
| Formatting      | Prettier 3                               |

### Data Flow

```
LinkedIn URL → API creates application → Desktop scrape → BullMQ → LLM worker analysis
                       ↓                       ↓             ↓
                 Save to DB              Save scrape   Score + CV guidance
                                                            ↓
                                                   Generate Documents → PDF Output
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable                       | Description                                         | Default                      |
| ------------------------------ | --------------------------------------------------- | ---------------------------- |
| `NODE_ENV`                     | Runtime environment                                 | `development`                |
| `PORT`                         | API server port                                     | `3000`                       |
| `AI_PROVIDER`                  | AI provider to use (`openai`, `gemini`, `deepseek`) | `openai`                     |
| `OPENAI_API_KEY`               | OpenAI API key                                      | —                            |
| `GEMINI_API_KEY`               | Google Gemini API key                               | —                            |
| `DEEPSEEK_API_KEY`             | DeepSeek API key                                    | —                            |
| `LLM_WORKER_CONCURRENCY`       | Concurrent BullMQ jobs processed by the LLM worker  | `1`                          |
| `LINKEDIN_SESSION_STORAGE_DIR` | LinkedIn session storage                            | `./storage/linkedin-session` |
| `LINKEDIN_SESSION_SECRET`      | Secret for LinkedIn session encryption              | —                            |

## API Endpoints

### Profiles

| Method | Path            | Description          |
| ------ | --------------- | -------------------- |
| `POST` | `/profiles/`    | Create a new profile |
| `GET`  | `/profiles/:id` | Get profile by ID    |

### Job Applications

| Method   | Path                                                   | Description                                 |
| -------- | ------------------------------------------------------ | ------------------------------------------- |
| `POST`   | `/job-applications/`                                   | Submit a job application                    |
| `GET`    | `/job-applications/`                                   | List applications (query: `?profileId=...`) |
| `GET`    | `/job-applications/stream`                             | Stream profile-scoped realtime changes      |
| `GET`    | `/job-applications/:id`                                | Get application by ID                       |
| `DELETE` | `/job-applications/:id`                                | Delete an application and related data      |
| `POST`   | `/job-applications/:id/retry`                          | Retry failed processing from the beginning  |
| `GET`    | `/job-applications/:id/documents/:documentId/download` | Download generated document                 |

### LinkedIn Session

| Method | Path                       | Description            |
| ------ | -------------------------- | ---------------------- |
| `POST` | `/linkedin-session/start`  | Start LinkedIn session |
| `POST` | `/linkedin-session/save`   | Save LinkedIn session  |
| `GET`  | `/linkedin-session/status` | Check session status   |

## Development

```bash
# Type check all packages
pnpm typecheck

# Lint all source files
pnpm lint

# Check Prettier formatting
pnpm format:check

# Apply ESLint and Prettier mechanical fixes
pnpm lint:fix
pnpm format

# Run all tests
pnpm test

# Run the API or LLM worker directly
pnpm dev:api
pnpm dev:llm-worker

# Build all packages
pnpm build

# Run a specific package's dev script
pnpm --filter @link2cv/desktop dev
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @link2cv/domain test

# Run tests in watch mode
pnpm vitest --filter @link2cv/contracts
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## License

This project is licensed under the [Business Source License 1.1](LICENSE).

- **Personal, non-commercial use**: Free
- **Education and research**: Free
- **Testing and contribution**: Free
- **Commercial use**: Requires a commercial license

The license converts to [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) on **2036-06-13** (or 4 years after the first public release of each version, whichever comes first).

For commercial licensing inquiries, contact: mail@ozdemirertan.com
