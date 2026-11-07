/**
 * Records why the latest scrape of a job application failed, for example `blocked` or
 * `not_found`, next to the human-readable `failure_reason`. It is cleared whenever
 * `failure_reason` is cleared or replaced by a failure from a later processing stage.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.text("scrape_failure_category").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("scrape_failure_category");
  });
};
