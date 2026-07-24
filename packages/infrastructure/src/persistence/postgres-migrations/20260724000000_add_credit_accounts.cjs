exports.up = async function up(knex) {
  await knex.schema.createTable("credit_accounts", (table) => {
    table.text("user_id").primary().references("id").inTable("user").onDelete("CASCADE");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("credit_grants", (table) => {
    table.text("id").primary();
    table
      .text("user_id")
      .notNullable()
      .references("user_id")
      .inTable("credit_accounts")
      .onDelete("CASCADE");
    table.text("source_type").notNullable();
    table.text("idempotency_key").notNullable().unique();
    table.integer("amount").notNullable();
    table.integer("consumed_amount").notNullable().defaultTo(0);
    table.integer("reserved_amount").notNullable().defaultTo(0);
    table.timestamp("valid_from", { useTz: true }).notNullable();
    table.timestamp("expires_at", { useTz: true });
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["id", "user_id"]);
    table.index(["user_id", "expires_at"], "idx_credit_grants_user_expiry");
  });

  await knex.schema.raw(`
    alter table credit_grants
      add constraint credit_grants_source_type_check
        check (source_type in ('free_monthly', 'subscription_cycle')),
      add constraint credit_grants_amount_positive
        check (amount > 0),
      add constraint credit_grants_consumed_nonnegative
        check (consumed_amount >= 0),
      add constraint credit_grants_reserved_nonnegative
        check (reserved_amount >= 0),
      add constraint credit_grants_counters_within_amount
        check (consumed_amount + reserved_amount <= amount),
      add constraint credit_grants_valid_expiry
        check (expires_at is null or expires_at > valid_from)
  `);

  await knex.schema.createTable("credit_ledger_entries", (table) => {
    table.text("id").primary();
    table
      .text("user_id")
      .notNullable()
      .references("user_id")
      .inTable("credit_accounts")
      .onDelete("CASCADE");
    table.text("grant_id").notNullable();
    table.text("entry_type").notNullable();
    table.integer("delta").notNullable();
    table.text("idempotency_key").notNullable().unique();
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table
      .foreign(["grant_id", "user_id"])
      .references(["id", "user_id"])
      .inTable("credit_grants")
      .onDelete("CASCADE");
    table.index(["user_id", "created_at"], "idx_credit_ledger_user_time");
  });

  await knex.schema.raw(`
    alter table credit_ledger_entries
      add constraint credit_ledger_entry_type_check
        check (entry_type in ('grant', 'usage')),
      add constraint credit_ledger_delta_nonzero
        check (delta <> 0)
  `);

  await knex.raw(`
    insert into credit_accounts (user_id, created_at, updated_at)
    select id, now(), now()
    from "user"
    on conflict (user_id) do nothing
  `);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("credit_ledger_entries");
  await knex.schema.dropTableIfExists("credit_grants");
  await knex.schema.dropTableIfExists("credit_accounts");
};
