exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.boolean("follow_up_reminders_enabled").notNullable().defaultTo(true);
  });

  await knex.schema.alterTable("job_applications", (table) => {
    table.text("follow_up_reminder_job_id");
    table.timestamp("follow_up_reminder_scheduled_for", { useTz: true });
    table.timestamp("follow_up_reminder_sent_at", { useTz: true });
  });
  await knex.schema.raw(
    "create index idx_job_applications_follow_up_reminder on job_applications(follow_up_reminder_scheduled_for, follow_up_reminder_sent_at)",
  );

  await knex.schema.createTable("notifications", (table) => {
    table.text("id").primary();
    table
      .text("profile_id")
      .notNullable()
      .references("id")
      .inTable("user_profiles")
      .onDelete("CASCADE");
    table
      .text("job_application_id")
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("title").notNullable();
    table.text("body");
    table.timestamp("read_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_notifications_profile_created on notifications(profile_id, created_at desc)",
  );
  await knex.schema.raw(
    "create index idx_notifications_profile_unread on notifications(profile_id, read_at)",
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("notifications");
  await knex.schema.raw("drop index if exists idx_job_applications_follow_up_reminder");
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("follow_up_reminder_job_id");
    table.dropColumn("follow_up_reminder_scheduled_for");
    table.dropColumn("follow_up_reminder_sent_at");
  });
  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("follow_up_reminders_enabled");
  });
};
