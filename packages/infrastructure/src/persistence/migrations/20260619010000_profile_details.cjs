/** @param {import("knex").Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.text("profession");
    table.jsonb("links").notNullable().defaultTo("[]");
  });
};

/** @param {import("knex").Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("profession");
    table.dropColumn("links");
  });
};
