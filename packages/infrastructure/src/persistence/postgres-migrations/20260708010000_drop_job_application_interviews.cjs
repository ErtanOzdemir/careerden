exports.up = async function up(knex) {
  await knex.schema.dropTableIfExists("job_application_interviews");
};

exports.down = async function down(knex) {
  await knex.schema.createTable("job_application_interviews", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("type");
    table.timestamp("scheduled_at", { useTz: true }).notNullable();
    table.text("status").notNullable().defaultTo("upcoming");
    table.text("notes");
    table.text("prep_notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_job_application_interviews_job_time on job_application_interviews(job_application_id, scheduled_at)",
  );
};
