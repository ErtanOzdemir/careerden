import { PGlite } from "@electric-sql/pglite";
import knex, { type Knex } from "knex";
import ClientPGLite from "knex-pglite";

// The bundled PGlite release. Its major releases can move to a newer PostgreSQL whose data files
// the previous release cannot open, so the dependency is pinned to this exact version and the
// local edition records it next to the data (see docs/architecture.md). A test keeps it in step
// with package.json.
export const pgliteVersion = "0.5.10";

// Embedded PostgreSQL for the local edition. PGlite has a single session, so Knex runs with one
// connection and serializes queries; the Postgres repositories, migrations, and SQL run unchanged.
// Omit dataDir for an in-memory database.
export function createPgliteDb(dataDir?: string): Knex {
  const pglite = new PGlite(dataDir);

  // A connection factory keeps Knex from deep-cloning the PGlite instance with its settings.
  return knex({
    client: ClientPGLite,
    connection: () => ({ pglite }),
  } as Knex.Config);
}
