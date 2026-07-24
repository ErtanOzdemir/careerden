exports.up = async function up(knex) {
  await knex.schema.createTable("billing_subscriptions", (table) => {
    table.text("id").primary();
    table.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("provider").notNullable();
    table.text("provider_customer_id").notNullable();
    table.text("provider_subscription_id").notNullable();
    table.text("plan_key").notNullable();
    table.text("status").notNullable();
    table.timestamp("current_period_start", { useTz: true }).notNullable();
    table.timestamp("current_period_end", { useTz: true }).notNullable();
    table.boolean("cancel_at_period_end").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["provider", "provider_subscription_id"]);
    table.index(["user_id", "updated_at"], "idx_billing_subscriptions_user_updated");
  });

  await knex.schema.raw(`
    alter table billing_subscriptions
      add constraint billing_subscriptions_status_check
        check (status in ('active', 'past_due', 'canceled', 'expired')),
      add constraint billing_subscriptions_period_check
        check (current_period_end > current_period_start)
  `);

  await knex.schema.createTable("billing_provider_events", (table) => {
    table.text("provider").notNullable();
    table.text("provider_event_id").notNullable();
    table.text("event_type").notNullable();
    table.text("user_id");
    table.jsonb("payload").notNullable();
    table.text("processing_status").notNullable();
    table.text("error");
    table.timestamp("received_at", { useTz: true }).notNullable();
    table.timestamp("processed_at", { useTz: true });
    table.primary(["provider", "provider_event_id"]);
    table.index(["processing_status", "received_at"], "idx_billing_events_status_received");
  });

  await knex.schema.raw(`
    alter table billing_provider_events
      add constraint billing_provider_events_processing_status_check
        check (processing_status in ('pending', 'processed', 'failed'))
  `);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("billing_provider_events");
  await knex.schema.dropTableIfExists("billing_subscriptions");
};
