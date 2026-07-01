/**
 * @param {import("knex").Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.integer("scrape_attempt_count").notNullable().defaultTo(0);
    table.timestamp("next_scrape_attempt_at", { useTz: true });
  });

  await knex.schema.raw("drop index if exists idx_job_applications_scrape_claim");
  await knex.schema.raw(
    "create index idx_job_applications_scrape_claim on job_applications(profile_id, status, next_scrape_attempt_at, scrape_claim_expires_at, created_at)",
  );
};

/**
 * @param {import("knex").Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.raw("drop index if exists idx_job_applications_scrape_claim");
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("next_scrape_attempt_at");
    table.dropColumn("scrape_attempt_count");
  });
  await knex.schema.raw(
    "create index idx_job_applications_scrape_claim on job_applications(profile_id, status, scrape_claim_expires_at, created_at)",
  );
};
