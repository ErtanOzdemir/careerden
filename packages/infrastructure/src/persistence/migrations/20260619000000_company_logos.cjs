/** @param {import("knex").Knex} knex */
exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn("job_applications", "company_logo_file_id");

  if (!hasColumn) {
    await knex.schema.alterTable("job_applications", (table) => {
      table.text("company_logo_file_id");
    });
  }
};

/** @param {import("knex").Knex} knex */
exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn("job_applications", "company_logo_file_id");

  if (hasColumn) {
    await knex.schema.alterTable("job_applications", (table) => {
      table.dropColumn("company_logo_file_id");
    });
  }
};
