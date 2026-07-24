exports.up = async function up(knex) {
  await knex.schema.createTable("credit_reservations", (table) => {
    table.text("id").primary();
    table.text("user_id").notNullable();
    table.text("grant_id").notNullable();
    table.text("operation_type").notNullable();
    table.text("resource_type").notNullable();
    table.text("resource_id").notNullable();
    table.integer("amount").notNullable();
    table.text("status").notNullable().defaultTo("reserved");
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.text("release_reason");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("settled_at", { useTz: true });
    table
      .foreign(["grant_id", "user_id"])
      .references(["id", "user_id"])
      .inTable("credit_grants")
      .onDelete("CASCADE");
  });

  await knex.schema.raw(`
    alter table credit_reservations
      add constraint credit_reservations_amount_positive check (amount > 0),
      add constraint credit_reservations_operation_type_check
        check (operation_type in ('match_analysis')),
      add constraint credit_reservations_resource_type_check
        check (resource_type in ('job_application')),
      add constraint credit_reservations_status_check
        check (status in ('reserved', 'consumed', 'released')),
      add constraint credit_reservations_release_reason_check
        check (release_reason is null or release_reason in
          ('failure', 'timeout', 'deletion', 'superseded'))
  `);
  await knex.schema.raw(`
    create index idx_credit_reservations_status_expiry
      on credit_reservations (status, expires_at)
  `);
  await knex.schema.raw(`
    create unique index uq_credit_reservations_active_resource
      on credit_reservations (operation_type, resource_type, resource_id)
      where status = 'reserved'
  `);

  await knex.schema.alterTable("credit_ledger_entries", (table) => {
    table
      .text("reservation_id")
      .references("id")
      .inTable("credit_reservations")
      .onDelete("SET NULL");
  });
  await knex.schema.raw(`
    create unique index uq_credit_ledger_usage_reservation
      on credit_ledger_entries (reservation_id)
      where entry_type = 'usage' and reservation_id is not null
  `);
};

exports.down = async function down(knex) {
  await knex.schema.raw("drop index if exists uq_credit_ledger_usage_reservation");
  await knex.schema.alterTable("credit_ledger_entries", (table) => {
    table.dropColumn("reservation_id");
  });
  await knex.schema.dropTableIfExists("credit_reservations");
};
