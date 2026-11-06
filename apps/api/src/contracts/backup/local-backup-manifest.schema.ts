import { z } from "zod";

export const localBackupFormat = "careerden-unplugged-backup";
// Bump only when the archive layout itself changes; schema changes are tracked by migrations.
export const localBackupFormatVersion = 1;

// SQL identifiers as Postgres stores them for this schema, which also keeps them safe to use as
// archive entry names.
const tableNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,62}$/);

export const localBackupManifestSchema = z.object({
  format: z.literal(localBackupFormat),
  formatVersion: z.number().int().positive(),
  // Number of migrations applied when the archive was made.
  schemaVersion: z.number().int().nonnegative(),
  lastMigration: z.string().regex(/^\d{14}_[a-z0-9_]+\.cjs$/),
  appVersion: z.string().min(1).max(100),
  createdAt: z.string().datetime({ offset: true }),
  tables: z
    .array(z.object({ name: tableNameSchema, rows: z.number().int().nonnegative() }))
    .max(500),
  files: z.number().int().nonnegative(),
});

// One table's rows exactly as Postgres's json_agg renders them.
export const localBackupTableRowsSchema = z.array(z.record(z.unknown()));

export type LocalBackupManifest = z.infer<typeof localBackupManifestSchema>;
