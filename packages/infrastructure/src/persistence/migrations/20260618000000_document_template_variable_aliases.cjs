/** @param {import("knex").Knex} knex */
exports.up = async function up(knex) {
  const hasDocumentTemplates = await knex.schema.hasTable("document_templates");
  if (!hasDocumentTemplates) {
    return;
  }

  const hasVariableAliases = await knex.schema.hasColumn("document_templates", "variable_aliases");
  if (!hasVariableAliases) {
    await knex.schema.alterTable("document_templates", (table) => {
      table.jsonb("variable_aliases").notNullable().defaultTo('{"fields":{}}');
    });
  }
};

/** @param {import("knex").Knex} knex */
exports.down = async function down(knex) {
  const hasDocumentTemplates = await knex.schema.hasTable("document_templates");
  if (!hasDocumentTemplates) {
    return;
  }

  const hasVariableAliases = await knex.schema.hasColumn("document_templates", "variable_aliases");
  if (hasVariableAliases) {
    await knex.schema.alterTable("document_templates", (table) => {
      table.dropColumn("variable_aliases");
    });
  }
};
