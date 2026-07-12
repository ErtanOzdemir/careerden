/** @param {import("knex").Knex} knex */
exports.up = async function up(knex) {
  await knex("outbox_events").where({ type: "job-application.change" }).delete();
};

exports.down = async function down() {
  // Realtime notifications are transient and cannot be reconstructed.
};
