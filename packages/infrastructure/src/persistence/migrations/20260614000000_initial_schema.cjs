/** @param {import("knex").Knex} knex */
exports.up = async function up(knex) {
  const hasUserProfiles = await knex.schema.hasTable("user_profiles");
  if (!hasUserProfiles) {
    await knex.schema.createTable("user_profiles", (table) => {
      table.uuid("id").primary();
      table.text("full_name").notNullable();
      table.text("email").notNullable();
      table.text("headline");
      table.text("location");
      table.text("summary");
      table.jsonb("skills").notNullable().defaultTo("[]");
      table.jsonb("experience").notNullable().defaultTo("[]");
      table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasJobApplications = await knex.schema.hasTable("job_applications");
  if (!hasJobApplications) {
    await knex.schema.createTable("job_applications", (table) => {
      table.uuid("id").primary();
      table
        .uuid("profile_id")
        .notNullable()
        .references("id")
        .inTable("user_profiles");
      table.text("source_url").notNullable();
      table.text("status").notNullable();
      table.text("failure_reason");
      table.jsonb("scrape_bundle");
      table.jsonb("match_analysis");
      table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasGeneratedDocuments = await knex.schema.hasTable("generated_documents");
  if (!hasGeneratedDocuments) {
    await knex.schema.createTable("generated_documents", (table) => {
      table.uuid("id").primary();
      table
        .uuid("job_application_id")
        .notNullable()
        .references("id")
        .inTable("job_applications");
      table.text("kind").notNullable();
      table.text("file_id").notNullable();
      table.text("file_name").notNullable();
      table.text("content_type").notNullable();
      table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }
};

/** @param {import("knex").Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("generated_documents");
  await knex.schema.dropTableIfExists("job_applications");
  await knex.schema.dropTableIfExists("user_profiles");
};
