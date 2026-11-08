/**
 * Records why an AI call failed, so the app can show an actionable message instead of a raw
 * provider error: `{ category, provider?, statusCode? }`. It never holds keys or prompt content.
 * Null when the application has not failed, or failed for a reason other than the AI provider.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.jsonb("ai_failure").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("ai_failure");
  });
};
