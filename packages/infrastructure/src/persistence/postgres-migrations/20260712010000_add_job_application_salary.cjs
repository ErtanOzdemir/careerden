exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.decimal("salary_min_amount", 14, 2);
    table.decimal("salary_max_amount", 14, 2);
    table.text("salary_currency");
    table.text("salary_period");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumns("salary_min_amount", "salary_max_amount", "salary_currency", "salary_period");
  });
};
