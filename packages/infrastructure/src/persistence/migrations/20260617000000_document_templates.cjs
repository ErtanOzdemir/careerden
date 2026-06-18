/** @param {import("knex").Knex} knex */
exports.up = async function up(knex) {
  const hasDocumentTemplates = await knex.schema.hasTable("document_templates");
  if (!hasDocumentTemplates) {
    await knex.schema.createTable("document_templates", (table) => {
      table.uuid("id").primary();
      table.uuid("profile_id").notNullable().references("id").inTable("user_profiles");
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
      table.index(["profile_id", "kind"], "document_templates_profile_kind_idx");
    });
  }

  const hasDocumentTemplateVariableAliases = await knex.schema.hasColumn(
    "document_templates",
    "variable_aliases",
  );
  if (hasDocumentTemplates && !hasDocumentTemplateVariableAliases) {
    await knex.schema.alterTable("document_templates", (table) => {
      table.jsonb("variable_aliases").notNullable().defaultTo('{"fields":{}}');
    });
  }

  const hasGeneratedDocuments = await knex.schema.hasTable("generated_documents");
  if (hasGeneratedDocuments) {
    const hasFormat = await knex.schema.hasColumn("generated_documents", "format");
    if (!hasFormat) {
      await knex.schema.alterTable("generated_documents", (table) => {
        table.text("format").notNullable().defaultTo("pdf");
      });
    }

    await knex.schema.alterTable("generated_documents", (table) => {
      table.dropUnique(["job_application_id", "kind"], "generated_documents_job_kind_unique");
      table.unique(["job_application_id", "kind", "format"], {
        indexName: "generated_documents_job_kind_format_unique",
      });
    });
  }
};

/** @param {import("knex").Knex} knex */
exports.down = async function down(knex) {
  const hasGeneratedDocuments = await knex.schema.hasTable("generated_documents");
  if (hasGeneratedDocuments) {
    await knex.schema.alterTable("generated_documents", (table) => {
      table.dropUnique(
        ["job_application_id", "kind", "format"],
        "generated_documents_job_kind_format_unique",
      );
      table.unique(["job_application_id", "kind"], {
        indexName: "generated_documents_job_kind_unique",
      });
    });
  }

  await knex.schema.dropTableIfExists("document_templates");

  if (hasGeneratedDocuments) {
    await knex.schema.alterTable("generated_documents", (table) => {
      table.dropColumn("format");
    });
  }
};
