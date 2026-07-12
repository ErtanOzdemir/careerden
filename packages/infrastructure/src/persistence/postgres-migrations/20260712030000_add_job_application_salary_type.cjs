exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.text("salary_type");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("salary_type");
  });
};
