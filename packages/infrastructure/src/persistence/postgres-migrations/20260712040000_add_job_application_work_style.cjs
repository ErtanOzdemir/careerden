exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.text("work_style");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("work_style");
  });
};
