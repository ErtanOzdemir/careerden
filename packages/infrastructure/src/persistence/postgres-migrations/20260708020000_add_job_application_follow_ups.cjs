exports.up = async function up(knex) {
  await knex.schema.createTable("job_application_follow_ups", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table
      .text("profile_id")
      .notNullable()
      .references("id")
      .inTable("user_profiles")
      .onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.timestamp("scheduled_at", { useTz: true }).notNullable();
    table.text("reminder_job_id");
    table.timestamp("reminder_scheduled_for", { useTz: true });
    table.timestamp("reminder_sent_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    "create index idx_follow_ups_job_app on job_application_follow_ups(job_application_id)",
  );
  await knex.schema.raw(
    "create index idx_follow_ups_reminder_recovery on job_application_follow_ups(reminder_scheduled_for, reminder_sent_at) where reminder_sent_at is null",
  );
  await knex.schema.raw(
    "create index idx_follow_ups_profile_upcoming on job_application_follow_ups(profile_id, scheduled_at) where reminder_sent_at is null",
  );

  const appsWithFollowUp = await knex("job_applications")
    .whereNotNull("next_follow_up_at")
    .select(
      "id",
      "profile_id",
      "next_follow_up_at",
      "follow_up_reminder_job_id",
      "follow_up_reminder_scheduled_for",
      "follow_up_reminder_sent_at",
      "created_at",
    );

  for (const app of appsWithFollowUp) {
    await knex("job_application_follow_ups").insert({
      id: `${app.id}:migrated-follow-up`,
      job_application_id: app.id,
      profile_id: app.profile_id,
      title: "Follow-up",
      description: null,
      scheduled_at: app.next_follow_up_at,
      reminder_job_id: app.follow_up_reminder_job_id,
      reminder_scheduled_for: app.follow_up_reminder_scheduled_for,
      reminder_sent_at: app.follow_up_reminder_sent_at,
      created_at: app.created_at,
      updated_at: knex.fn.now(),
    });
  }

  await knex.schema.raw("drop index if exists idx_job_applications_follow_up_reminder");
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("next_follow_up_at");
    table.dropColumn("follow_up_reminder_job_id");
    table.dropColumn("follow_up_reminder_scheduled_for");
    table.dropColumn("follow_up_reminder_sent_at");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.timestamp("next_follow_up_at", { useTz: true });
    table.text("follow_up_reminder_job_id");
    table.timestamp("follow_up_reminder_scheduled_for", { useTz: true });
    table.timestamp("follow_up_reminder_sent_at", { useTz: true });
  });
  await knex.schema.raw(
    "create index idx_job_applications_follow_up_reminder on job_applications(follow_up_reminder_scheduled_for, follow_up_reminder_sent_at)",
  );

  const followUps = await knex("job_application_follow_ups")
    .whereNull("reminder_sent_at")
    .select("*");

  for (const followUp of followUps) {
    await knex("job_applications").where({ id: followUp.job_application_id }).update({
      next_follow_up_at: followUp.scheduled_at,
      follow_up_reminder_job_id: followUp.reminder_job_id,
      follow_up_reminder_scheduled_for: followUp.reminder_scheduled_for,
    });
  }

  await knex.schema.dropTableIfExists("job_application_follow_ups");
};
