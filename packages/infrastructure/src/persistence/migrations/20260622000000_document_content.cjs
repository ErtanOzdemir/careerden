exports.up = async function up(knex) {
  const exists = await knex.schema.hasColumn("job_applications", "document_content");

  if (!exists) {
    await knex.schema.alterTable("job_applications", (table) => {
      table.jsonb("document_content");
    });
  }
};

exports.down = async function down(knex) {
  const exists = await knex.schema.hasColumn("job_applications", "document_content");

  if (exists) {
    await knex.schema.alterTable("job_applications", (table) => {
      table.dropColumn("document_content");
    });
  }
};
