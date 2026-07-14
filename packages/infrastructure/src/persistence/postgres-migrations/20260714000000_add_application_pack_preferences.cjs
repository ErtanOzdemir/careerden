exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.boolean("auto_generate_documents").notNullable().defaultTo(true);
  });
  await knex("user_profiles").update({
    auto_generate_documents: knex.ref("auto_run_match_analysis"),
  });

  await knex.schema.alterTable("job_applications", (table) => {
    table
      .jsonb("application_pack_preferences")
      .notNullable()
      .defaultTo(JSON.stringify({ language: "auto", tone: "professional" }));
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("job_applications", (table) => {
    table.dropColumn("application_pack_preferences");
  });
  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("auto_generate_documents");
  });
};
