exports.up = async function up(knex) {
  await knex.schema.createTable("user", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("email").notNullable().unique();
    table.boolean("emailVerified").notNullable().defaultTo(false);
    table.text("image");
    table.timestamp("createdAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("session", (table) => {
    table.text("id").primary();
    table.timestamp("expiresAt", { useTz: true }).notNullable();
    table.text("token").notNullable().unique();
    table.timestamp("createdAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text("ipAddress");
    table.text("userAgent");
    table.text("userId").notNullable().references("id").inTable("user").onDelete("CASCADE");
  });

  await knex.schema.createTable("account", (table) => {
    table.text("id").primary();
    table.text("accountId").notNullable();
    table.text("providerId").notNullable();
    table.text("userId").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("accessToken");
    table.text("refreshToken");
    table.text("idToken");
    table.timestamp("accessTokenExpiresAt", { useTz: true });
    table.timestamp("refreshTokenExpiresAt", { useTz: true });
    table.text("scope");
    table.text("password");
    table.timestamp("createdAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("verification", (table) => {
    table.text("id").primary();
    table.text("identifier").notNullable();
    table.text("value").notNullable();
    table.timestamp("expiresAt", { useTz: true }).notNullable();
    table.timestamp("createdAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("user_profiles", (table) => {
    table.text("id").primary();
    table
      .text("user_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
    table.text("full_name").notNullable();
    table.text("email").notNullable();
    table.text("profession");
    table.text("headline");
    table.text("location");
    table.jsonb("links").notNullable().defaultTo("[]");
    table.text("summary");
    table.jsonb("skills").notNullable().defaultTo("[]");
    table.jsonb("experience").notNullable().defaultTo("[]");
    table.jsonb("education").notNullable().defaultTo("[]");
    table.jsonb("certifications").notNullable().defaultTo("[]");
    table.jsonb("projects").notNullable().defaultTo("[]");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("job_applications", (table) => {
    table.text("id").primary();
    table
      .text("profile_id")
      .notNullable()
      .references("id")
      .inTable("user_profiles")
      .onDelete("CASCADE");
    table.text("source_url");
    table.text("status").notNullable();
    table.text("failure_reason");
    table.jsonb("scrape_bundle");
    table.jsonb("match_analysis");
    table.jsonb("document_content");
    table.text("company_logo_file_id");
    table.text("company_name");
    table.text("role_title");
    table.text("role_type");
    table.text("job_url");
    table.text("date_applied");
    table.text("application_status").notNullable().defaultTo("applied");
    table.text("priority").notNullable().defaultTo("medium");
    table.jsonb("tags").notNullable().defaultTo("[]");
    table.timestamp("next_follow_up_at", { useTz: true });
    table.timestamp("last_response_at", { useTz: true });
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_job_applications_profile_status on job_applications(profile_id, application_status)",
  );
  await knex.schema.raw(
    "create index idx_job_applications_profile_updated on job_applications(profile_id, updated_at)",
  );

  await knex.schema.createTable("job_application_events", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("title").notNullable();
    table.text("body");
    table.timestamp("occurred_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_job_application_events_job_time on job_application_events(job_application_id, occurred_at)",
  );

  await knex.schema.createTable("job_application_contacts", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("role");
    table.text("email");
    table.text("phone");
    table.text("linkedin_url");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_job_application_contacts_job on job_application_contacts(job_application_id)",
  );

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

  await knex.schema.createTable("generated_documents", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("kind").notNullable();
    table.text("format").notNullable().defaultTo("pdf");
    table.text("file_id").notNullable();
    table.text("file_name").notNullable();
    table.text("content_type").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["job_application_id", "kind", "format"]);
  });

  await knex.schema.createTable("document_templates", (table) => {
    table.text("id").primary();
    table
      .text("profile_id")
      .notNullable()
      .references("id")
      .inTable("user_profiles")
      .onDelete("CASCADE");
    table.text("kind").notNullable();
    table.text("format").notNullable();
    table.text("file_id").notNullable();
    table.text("file_name").notNullable();
    table.text("content_type").notNullable();
    table.integer("size").notNullable();
    table.jsonb("placeholders").notNullable().defaultTo("[]");
    table.jsonb("field_mappings").notNullable().defaultTo("{}");
    table.jsonb("variable_aliases").notNullable().defaultTo('{"fields":{}}');
    table.boolean("is_default").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_document_templates_profile_kind on document_templates(profile_id, kind)",
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("document_templates");
  await knex.schema.dropTableIfExists("generated_documents");
  await knex.schema.dropTableIfExists("job_application_interviews");
  await knex.schema.dropTableIfExists("job_application_contacts");
  await knex.schema.dropTableIfExists("job_application_events");
  await knex.schema.dropTableIfExists("job_applications");
  await knex.schema.dropTableIfExists("user_profiles");
  await knex.schema.dropTableIfExists("verification");
  await knex.schema.dropTableIfExists("account");
  await knex.schema.dropTableIfExists("session");
  await knex.schema.dropTableIfExists("user");
};
