const { randomUUID } = require("node:crypto");

/**
 * Uploaded DOCX templates are replaced by predefined HTML templates, so this table has no future
 * consumer. Any uploaded template file still referenced from storage is queued for deletion through
 * the existing storage-delete outbox before the table (and its rows) are dropped.
 */
exports.up = async function up(knex) {
  const templates = await knex("document_templates").select("file_id");
  const now = knex.fn.now();
  for (const template of templates) {
    await knex("outbox_events").insert({
      id: randomUUID(),
      type: "storage.delete",
      aggregate_id: template.file_id,
      payload: JSON.stringify({ fileId: template.file_id }),
      available_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  await knex.schema.dropTableIfExists("document_templates");
};

exports.down = async function down(knex) {
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
  await knex.schema.raw(
    "create unique index uq_document_templates_default on document_templates(profile_id, kind) where is_default = true",
  );
};
