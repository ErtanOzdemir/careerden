/**
 * Adds an optional `user_profiles.phone`, stored as free text so international formats work.
 * Existing profiles have no phone number until the user adds one.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.text("phone").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("phone");
  });
};
