exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.text("default_cv_template_id");
    table.text("default_cover_letter_template_id");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("default_cv_template_id");
    table.dropColumn("default_cover_letter_template_id");
  });
};
