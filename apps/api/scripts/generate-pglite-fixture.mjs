import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import knex from "knex";
import ClientPGLite from "knex-pglite";
import * as prettier from "prettier";
import { seedExpectations, seedFiles, seedTables } from "./pglite-fixture-seed.mjs";

// Builds the Careerden Unplugged upgrade fixture for one release: an embedded database at that
// release's schema, filled with a realistic sample, saved as a plain SQL dump with the stored
// document files beside it. The upgrade test restores every fixture and runs the current
// migrations on it. Only the migrations committed at the release's git ref are run, so the
// fixture keeps that release's schema even when it is generated from a later checkout.
//
//   pnpm --filter @careerden/api-app fixture:pglite [--ref v0.8.0] [--version 0.8.0] [--force]
//
// --ref defaults to the tag for apps/desktop's current version; --version defaults to the ref
// without its leading "v". Existing fixtures are frozen and are only replaced with --force.

const migrationsPath = "packages/infrastructure/src/persistence/postgres-migrations";
// Fixed so a regenerated fixture is byte-identical when nothing else changed.
const migrationTime = "2026-10-01T00:00:00.000Z";

const apiDirectory = resolve(import.meta.dirname, "..");
const repositoryRoot = git(["rev-parse", "--show-toplevel"]);
const { values } = parseArgs({
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    ref: { type: "string" },
    version: { type: "string" },
    force: { type: "boolean", default: false },
  },
});
const ref = values.ref ?? `v${await desktopVersion()}`;
const version = values.version ?? ref.replace(/^v/, "");
const commit = git(["rev-parse", "--verify", `${ref}^{commit}`]);
const outputDirectory = join(apiDirectory, "test", "fixtures", "pglite", `v${version}`);

if (existsSync(outputDirectory) && !values.force) {
  fail(
    `${outputDirectory} already exists. Fixtures of released versions are frozen; pass --force to rebuild it.`,
  );
}

const workDirectory = await mkdtemp(join(tmpdir(), "careerden-pglite-fixture-"));
const pglite = new PGlite();
const db = knex({ client: ClientPGLite, connection: () => ({ pglite }) });

try {
  const migrations = await extractMigrations(join(workDirectory, "migrations"));
  await db.migrate.latest({
    directory: join(workDirectory, "migrations"),
    extension: "cjs",
    loadExtensions: [".cjs"],
  });
  await db("knex_migrations").update({ migration_time: migrationTime });

  for (const [table, rows] of seedTables) await insertRows(table, rows);

  // pg_dump prints timestamps in the session time zone, which otherwise follows the host's.
  await pglite.exec("SET TIME ZONE 'UTC'");
  const dump = await pgDump({ pg: pglite, args: ["--no-owner", "--no-privileges"] });

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "database.sql"), await dump.text());
  for (const file of seedFiles) await writeStoredFile(join(outputDirectory, "files"), file);
  await writeFile(
    join(outputDirectory, "fixture.json"),
    await formatJson(join(outputDirectory, "fixture.json"), {
      version,
      ref,
      commit,
      pgliteVersion: await packageVersion("@electric-sql/pglite"),
      migrations,
      expectations: seedExpectations,
    }),
  );

  console.log(
    `Wrote the v${version} fixture from ${ref} (${commit.slice(0, 12)}, ${migrations.length} migrations) to ${outputDirectory}`,
  );
} finally {
  await db.destroy();
  await rm(workDirectory, { recursive: true, force: true });
}

// Copies the migrations as they were committed at the ref, never the working tree's.
async function extractMigrations(directory) {
  const files = git(["ls-tree", "--full-tree", "--name-only", commit, `${migrationsPath}/`])
    .split("\n")
    .map((path) => posix.basename(path))
    .filter((name) => name.endsWith(".cjs"))
    .sort();
  if (files.length === 0) fail(`${ref} has no migrations under ${migrationsPath}`);

  await mkdir(directory, { recursive: true });
  for (const file of files) {
    await writeFile(
      join(directory, file),
      git(["show", `${commit}:${posix.join(migrationsPath, file)}`], { trim: false }),
    );
  }
  return files;
}

// Inserts the sample rows, leaving out columns the release's schema does not have yet.
async function insertRows(table, rows) {
  if (!(await db.schema.hasTable(table))) {
    console.warn(`Skipping ${table}: it does not exist at ${ref}`);
    return;
  }
  const columns = new Set(Object.keys(await db(table).columnInfo()));
  const dropped = new Set();
  const present = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(([column]) => {
        if (columns.has(column)) return true;
        dropped.add(column);
        return false;
      }),
    ),
  );
  if (dropped.size > 0) {
    console.warn(`Leaving out ${table} columns missing at ${ref}: ${[...dropped].join(", ")}`);
  }
  await db(table).insert(present);
}

// Matches LocalFileStorage's on-disk layout: the body at the file id plus a metadata sidecar.
async function writeStoredFile(rootDirectory, file) {
  const path = join(rootDirectory, ...file.fileId.split("/"));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.body);
  await writeFile(
    `${path}.meta.json`,
    await formatJson(path, { fileName: file.fileName, contentType: file.contentType }),
  );
}

async function formatJson(path, value) {
  const options = (await prettier.resolveConfig(path)) ?? {};
  return prettier.format(JSON.stringify(value), { ...options, parser: "json" });
}

async function desktopVersion() {
  const manifest = await readFile(join(repositoryRoot, "apps/desktop/package.json"), "utf8");
  return JSON.parse(manifest).version;
}

async function packageVersion(name) {
  const manifest = await readFile(join(apiDirectory, "node_modules", name, "package.json"), "utf8");
  return JSON.parse(manifest).version;
}

function git(args, { trim = true } = {}) {
  const output = execFileSync("git", args, { cwd: apiDirectory, encoding: "utf8" });
  return trim ? output.trim() : output;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
