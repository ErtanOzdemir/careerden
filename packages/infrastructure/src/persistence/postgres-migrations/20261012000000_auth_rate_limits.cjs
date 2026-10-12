/**
 * Adds persistent storage for authentication rate limits:
 * - `rateLimit` is Better Auth's per-IP, per-path limiter table (`rateLimit.storage: "database"`).
 * - `auth_otp_rate_limit` holds per-email verification-code send and verify counters keyed by a
 *   SHA-256 hash of the email, so codes cannot be brute forced by rotating IPs or requesting
 *   fresh codes.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable("rateLimit", (table) => {
    table.text("id").primary();
    table.text("key").notNullable().unique();
    table.integer("count").notNullable();
    table.bigInteger("lastRequest").notNullable();
  });

  await knex.schema.createTable("auth_otp_rate_limit", (table) => {
    table.text("key").primary();
    table.integer("count").notNullable();
    table.timestamp("window_started_at", { useTz: true }).notNullable();
    table.timestamp("last_attempt_at", { useTz: true }).notNullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("auth_otp_rate_limit");
  await knex.schema.dropTableIfExists("rateLimit");
};
