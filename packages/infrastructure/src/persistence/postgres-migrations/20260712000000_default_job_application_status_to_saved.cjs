exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.text("application_status").defaultTo("saved").alter();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.text("application_status").defaultTo("applied").alter();
  });
};
