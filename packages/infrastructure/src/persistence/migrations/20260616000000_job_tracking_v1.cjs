/** @param {import("knex").Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.jsonb("education").notNullable().defaultTo("[]");
    table.jsonb("certifications").notNullable().defaultTo("[]");
    table.jsonb("projects").notNullable().defaultTo("[]");
  });

  await knex.schema.alterTable("job_applications", (table) => {
    table.text("source_url").nullable().alter();
    table.text("company_name");
    table.text("role_title");
    table.text("role_type");
    table.text("job_url");
    table.date("date_applied");
    table.text("application_status").notNullable().defaultTo("applied");
    table.text("priority").notNullable().defaultTo("medium");
    table.jsonb("tags").notNullable().defaultTo("[]");
    table.timestamp("next_follow_up_at", { useTz: true });
    table.timestamp("last_response_at", { useTz: true });
    table.jsonb("metadata").notNullable().defaultTo("{}");
  });

  await knex.schema.createTable("job_application_events", (table) => {
    table.uuid("id").primary();
    table.uuid("job_application_id").notNullable().references("id").inTable("job_applications");
    table.text("type").notNullable();
    table.text("title").notNullable();
    table.text("body");
    table.timestamp("occurred_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("job_application_contacts", (table) => {
    table.uuid("id").primary();
    table.uuid("job_application_id").notNullable().references("id").inTable("job_applications");
    table.text("name").notNullable();
    table.text("role");
    table.text("email");
    table.text("phone");
    table.text("linkedin_url");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("job_application_interviews", (table) => {
    table.uuid("id").primary();
    table.uuid("job_application_id").notNullable().references("id").inTable("job_applications");
    table.text("title").notNullable();
    table.text("type");
    table.timestamp("scheduled_at", { useTz: true }).notNullable();
    table.text("status").notNullable().defaultTo("upcoming");
    table.text("notes");
    table.text("prep_notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable("job_applications", (table) => {
    table.index(["profile_id", "application_status"], "job_applications_profile_status_idx");
    table.index(["profile_id", "date_applied"], "job_applications_profile_date_idx");
    table.index(["profile_id", "priority"], "job_applications_profile_priority_idx");
    table.index(["profile_id", "updated_at"], "job_applications_profile_updated_idx");
  });

  await knex.schema.alterTable("job_application_events", (table) => {
    table.index(["job_application_id", "occurred_at"], "job_application_events_job_time_idx");
  });

  await knex.schema.alterTable("job_application_contacts", (table) => {
    table.index(["job_application_id"], "job_application_contacts_job_idx");
  });

  await knex.schema.alterTable("job_application_interviews", (table) => {
    table.index(["job_application_id", "scheduled_at"], "job_application_interviews_job_time_idx");
    table.index(["job_application_id", "status"], "job_application_interviews_job_status_idx");
  });

  await knex.schema.alterTable("generated_documents", (table) => {
    table.unique(["job_application_id", "kind"], {
      indexName: "generated_documents_job_kind_unique",
    });
  });
};

/** @param {import("knex").Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("job_application_interviews");
  await knex.schema.dropTableIfExists("job_application_contacts");
  await knex.schema.dropTableIfExists("job_application_events");

  await knex.schema.alterTable("generated_documents", (table) => {
    table.dropUnique(["job_application_id", "kind"], "generated_documents_job_kind_unique");
  });

  await knex.schema.alterTable("job_applications", (table) => {
    table.dropIndex(["profile_id", "application_status"], "job_applications_profile_status_idx");
    table.dropIndex(["profile_id", "date_applied"], "job_applications_profile_date_idx");
    table.dropIndex(["profile_id", "priority"], "job_applications_profile_priority_idx");
    table.dropIndex(["profile_id", "updated_at"], "job_applications_profile_updated_idx");
  });

  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("company_name");
    table.dropColumn("role_title");
    table.dropColumn("role_type");
    table.dropColumn("job_url");
    table.dropColumn("date_applied");
    table.dropColumn("application_status");
    table.dropColumn("priority");
    table.dropColumn("tags");
    table.dropColumn("next_follow_up_at");
    table.dropColumn("last_response_at");
    table.dropColumn("metadata");
    table.text("source_url").notNullable().alter();
  });

  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("education");
    table.dropColumn("certifications");
    table.dropColumn("projects");
  });
};
