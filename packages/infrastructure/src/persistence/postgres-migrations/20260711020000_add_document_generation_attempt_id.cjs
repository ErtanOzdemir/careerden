exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.text("document_generation_attempt_id");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("document_generation_attempt_id");
  });
};
