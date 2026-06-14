# Link2CV

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)

Turn LinkedIn job postings into profile-aware CV and cover-letter PDFs. Link2CV scrapes job listings, matches them against your profile using AI, and generates tailored documents — automatically.

## Quick Start

### Prerequisites

- **Node.js** 22+ (run `nvm use` to auto-select)
- **pnpm** 9.15+
- **Docker** (for PostgreSQL and Redis)

### Setup

```bash
# Clone the repository
git clone git@github.com:ErtanOzdemir/link2cv.git
cd link2cv

# Install dependencies
pnpm install

# Start local services (PostgreSQL + Redis)
docker compose up -d

# Copy environment variables
cp .env.example .env

# Apply database migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

The API server runs at `http://localhost:3000` by default.

## Architecture

Link2CV is a TypeScript monorepo using clean architecture with clear separation of concerns.

```
link2cv/
├── apps/
│   ├── api/          Express HTTP API
│   ├── worker/       BullMQ background worker
│   └── web/          Frontend (vanilla TypeScript + Vite)
├── packages/
│   ├── domain/       Entities, workflow state, provider interfaces
│   ├── application/  Use cases and orchestration
│   ├── infrastructure/  DB, scrapers, AI, PDF, queue, storage adapters
│   ├── contracts/    Shared DTOs and Zod validation schemas
│   └── config/       Environment loading (dotenv + Zod)
```

### Tech Stack

| Layer           | Technology                               |
| --------------- | ---------------------------------------- |
| Language        | TypeScript 5.7 (strict, ESM)             |
| Runtime         | Node.js 22                               |
| Package Manager | pnpm 9                                   |
| Monorepo        | Turborepo 2                              |
| HTTP Framework  | Express 4                                |
| Database        | PostgreSQL 16                            |
| Queue           | BullMQ 5 (Redis 7)                       |
| AI              | Vercel AI SDK (OpenAI, Gemini, DeepSeek) |
| Browser         | Playwright                               |
| Validation      | Zod 3                                    |
| Frontend        | Vite 6                                   |
| Testing         | Vitest 2                                 |

### Data Flow

```
LinkedIn URL → Scrape Job → AI Match Analysis → Generate Documents → PDF Output
                    ↓              ↓                    ↓
              Save to DB     Score + Gaps        CV + Cover Letter
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable                       | Description                                         | Default                                             |
| ------------------------------ | --------------------------------------------------- | --------------------------------------------------- |
| `NODE_ENV`                     | Runtime environment                                 | `development`                                       |
| `PORT`                         | API server port                                     | `3000`                                              |
| `DATABASE_URL`                 | PostgreSQL connection string                        | `postgres://link2cv:link2cv@localhost:5432/link2cv` |
| `REDIS_URL`                    | Redis connection string                             | `redis://localhost:6379`                            |
| `AI_PROVIDER`                  | AI provider to use (`openai`, `gemini`, `deepseek`) | `openai`                                            |
| `OPENAI_API_KEY`               | OpenAI API key                                      | —                                                   |
| `GEMINI_API_KEY`               | Google Gemini API key                               | —                                                   |
| `DEEPSEEK_API_KEY`             | DeepSeek API key                                    | —                                                   |
| `FILE_STORAGE_DIR`             | File storage directory                              | `./storage`                                         |
| `LINKEDIN_SESSION_STORAGE_DIR` | LinkedIn session storage                            | `./storage/linkedin-session`                        |
| `LINKEDIN_SESSION_SECRET`      | Secret for LinkedIn session encryption              | —                                                   |

## API Endpoints

### Profiles

| Method | Path            | Description          |
| ------ | --------------- | -------------------- |
| `POST` | `/profiles/`    | Create a new profile |
| `GET`  | `/profiles/:id` | Get profile by ID    |

### Job Applications

| Method | Path                                                   | Description                                 |
| ------ | ------------------------------------------------------ | ------------------------------------------- |
| `POST` | `/job-applications/`                                   | Submit a job application                    |
| `GET`  | `/job-applications/`                                   | List applications (query: `?profileId=...`) |
| `GET`  | `/job-applications/:id`                                | Get application by ID                       |
| `GET`  | `/job-applications/:id/documents/:documentId/download` | Download generated document                 |

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

# Run all tests
pnpm test

# Build all packages
pnpm build

# Apply PostgreSQL migrations
pnpm db:migrate

# Check migration status
pnpm db:status

# Roll back the latest migration batch
pnpm db:rollback

# Run a specific package's dev script
pnpm --filter @link2cv/api dev
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
