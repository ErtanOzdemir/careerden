exports.up = async function up(knex) {
  await knex.schema.alterTable("outbox_events", (table) => {
    table.timestamp("dead_lettered_at", { useTz: true });
    table.timestamp("last_error_at", { useTz: true });
  });

  await knex.schema.raw("drop index if exists idx_outbox_events_pending");
  await knex.schema.raw(
    "create index idx_outbox_events_pending on outbox_events(type, available_at, lease_expires_at, created_at) where processed_at is null and dead_lettered_at is null",
  );
};

exports.down = async function down(knex) {
  await knex.schema.raw("drop index if exists idx_outbox_events_pending");
  await knex.schema.alterTable("outbox_events", (table) => {
    table.dropColumn("last_error_at");
    table.dropColumn("dead_lettered_at");
  });
  await knex.schema.raw(
    "create index idx_outbox_events_pending on outbox_events(type, available_at, lease_expires_at, created_at) where processed_at is null",
  );
};
