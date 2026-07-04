exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.boolean("auto_run_match_analysis").notNullable().defaultTo(true);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("auto_run_match_analysis");
  });
};
