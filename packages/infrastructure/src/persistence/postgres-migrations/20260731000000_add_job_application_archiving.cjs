exports.up = async function up(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.timestamp("archived_at", { useTz: true });
  });
  await knex.schema.raw(`
    create index idx_job_applications_profile_archived_at
      on job_applications (profile_id, archived_at desc)
      where archived_at is not null
  `);
};

exports.down = async function down(knex) {
  await knex.schema.raw("drop index if exists idx_job_applications_profile_archived_at");
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("archived_at");
  });
};
