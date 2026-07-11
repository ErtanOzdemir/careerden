exports.up = async function up(knex) {
  await knex.schema.createTable("outbox_events", (table) => {
    table.text("id").primary();
    table.text("type").notNullable();
    table.text("aggregate_id");
    table.jsonb("payload").notNullable();
    table.timestamp("available_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.integer("attempt_count").notNullable().defaultTo(0);
    table.text("lease_owner");
    table.timestamp("lease_expires_at", { useTz: true });
    table.timestamp("processed_at", { useTz: true });
    table.text("last_error");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_outbox_events_pending on outbox_events(type, available_at, lease_expires_at, created_at) where processed_at is null",
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("outbox_events");
};
