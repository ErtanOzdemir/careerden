exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.text("analysis_attempt_id");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("analysis_attempt_id");
  });
};
