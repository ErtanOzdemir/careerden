exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.jsonb("summary_rich_text");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("summary_rich_text");
  });
};
