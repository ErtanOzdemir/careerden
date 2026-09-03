/**
 * Consolidated initial schema. This replaces the 27 incremental schema migrations that used to run
 * between 2026-06-26 and 2026-08-13 with a single migration that creates the schema in its final
 * shape directly, now that none of them are needed to explain intermediate states to a real database.
 *
 * 20260806000000_collapse_legacy_document_content_achievements.cjs is kept as its own migration: it
 * is a data transform (not a schema change), is unit-tested by importing this exact file, and is
 * documented as needing to stay frozen as written.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable("user", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("email").notNullable().unique();
    table.boolean("emailVerified").notNullable().defaultTo(false);
    table.text("image");
    table.timestamp("createdAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("session", (table) => {
    table.text("id").primary();
    table.timestamp("expiresAt", { useTz: true }).notNullable();
    table.text("token").notNullable().unique();
    table.timestamp("createdAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text("ipAddress");
    table.text("userAgent");
    table.text("userId").notNullable().references("id").inTable("user").onDelete("CASCADE");
  });

  await knex.schema.createTable("account", (table) => {
    table.text("id").primary();
    table.text("accountId").notNullable();
    table.text("providerId").notNullable();
    table.text("userId").notNullable().references("id").inTable("user").onDelete("CASCADE");
    table.text("accessToken");
    table.text("refreshToken");
    table.text("idToken");
    table.timestamp("accessTokenExpiresAt", { useTz: true });
    table.timestamp("refreshTokenExpiresAt", { useTz: true });
    table.text("scope");
    table.text("password");
    table.timestamp("createdAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("verification", (table) => {
    table.text("id").primary();
    table.text("identifier").notNullable();
    table.text("value").notNullable();
    table.timestamp("expiresAt", { useTz: true }).notNullable();
    table.timestamp("createdAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updatedAt", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("user_profiles", (table) => {
    table.text("id").primary();
    table
      .text("user_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("user")
      .onDelete("CASCADE");
    table.text("full_name").notNullable();
    table.text("email").notNullable();
    table.text("profession");
    table.text("headline");
    table.text("location");
    table.jsonb("links").notNullable().defaultTo("[]");
    table.text("summary");
    table.jsonb("skills").notNullable().defaultTo("[]");
    table.jsonb("experience").notNullable().defaultTo("[]");
    table.jsonb("education").notNullable().defaultTo("[]");
    table.jsonb("certifications").notNullable().defaultTo("[]");
    table.jsonb("projects").notNullable().defaultTo("[]");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.boolean("auto_run_match_analysis").notNullable().defaultTo(true);
    table.boolean("follow_up_reminders_enabled").notNullable().defaultTo(true);
    table.jsonb("summary_rich_text");
    table.boolean("auto_generate_documents").notNullable().defaultTo(true);
    table.text("default_cv_template_id");
    table.text("default_cover_letter_template_id");
  });

  await knex.schema.createTable("job_applications", (table) => {
    table.text("id").primary();
    table
      .text("profile_id")
      .notNullable()
      .references("id")
      .inTable("user_profiles")
      .onDelete("CASCADE");
    table.text("source_url");
    table.text("status").notNullable();
    table.text("failure_reason");
    table.jsonb("scrape_bundle");
    table.jsonb("match_analysis");
    table.jsonb("document_content");
    table.text("company_logo_file_id");
    table.text("company_name");
    table.text("role_title");
    table.text("role_type");
    table.text("job_url");
    table.text("date_applied");
    table.text("application_status").defaultTo("saved");
    table.text("priority");
    table.jsonb("tags").notNullable().defaultTo("[]");
    table.timestamp("last_response_at", { useTz: true });
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text("scrape_claimed_by");
    table.timestamp("scrape_claim_expires_at", { useTz: true });
    table.integer("scrape_attempt_count").notNullable().defaultTo(0);
    table.timestamp("next_scrape_attempt_at", { useTz: true });
    table.text("analysis_attempt_id");
    table.text("document_generation_attempt_id");
    table.decimal("salary_min_amount", 14, 2);
    table.decimal("salary_max_amount", 14, 2);
    table.text("salary_currency");
    table.text("salary_period");
    table.text("salary_type");
    table.text("work_style");
    table
      .jsonb("application_pack_preferences")
      .notNullable()
      .defaultTo(JSON.stringify({ language: "auto", tone: "professional" }));
    table.timestamp("archived_at", { useTz: true });
  });
  await knex.schema.raw(
    "create index idx_job_applications_profile_status on job_applications(profile_id, application_status)",
  );
  await knex.schema.raw(
    "create index idx_job_applications_profile_updated on job_applications(profile_id, updated_at)",
  );
  await knex.schema.raw(
    "create index idx_job_applications_scrape_claim on job_applications(profile_id, status, next_scrape_attempt_at, scrape_claim_expires_at, created_at)",
  );
  await knex.schema.raw(`
    create index idx_job_applications_profile_archived_at
      on job_applications (profile_id, archived_at desc)
      where archived_at is not null
  `);

  await knex.schema.createTable("job_application_events", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("title").notNullable();
    table.text("body");
    table.timestamp("occurred_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_job_application_events_job_time on job_application_events(job_application_id, occurred_at)",
  );

  await knex.schema.createTable("job_application_contacts", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("role");
    table.text("email");
    table.text("phone");
    table.text("linkedin_url");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_job_application_contacts_job on job_application_contacts(job_application_id)",
  );

  await knex.schema.createTable("job_application_follow_ups", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table
      .text("profile_id")
      .notNullable()
      .references("id")
      .inTable("user_profiles")
      .onDelete("CASCADE");
    table.text("title").notNullable();
    table.text("description");
    table.timestamp("scheduled_at", { useTz: true }).notNullable();
    table.text("reminder_job_id");
    table.timestamp("reminder_scheduled_for", { useTz: true });
    table.timestamp("reminder_sent_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_follow_ups_job_app on job_application_follow_ups(job_application_id)",
  );
  await knex.schema.raw(
    "create index idx_follow_ups_reminder_recovery on job_application_follow_ups(reminder_scheduled_for, reminder_sent_at) where reminder_sent_at is null",
  );
  await knex.schema.raw(
    "create index idx_follow_ups_profile_upcoming on job_application_follow_ups(profile_id, scheduled_at) where reminder_sent_at is null",
  );

  await knex.schema.createTable("generated_documents", (table) => {
    table.text("id").primary();
    table
      .text("job_application_id")
      .notNullable()
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("kind").notNullable();
    table.text("format").notNullable().defaultTo("pdf");
    table.text("file_id").notNullable();
    table.text("file_name").notNullable();
    table.text("content_type").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["job_application_id", "kind", "format"]);
  });

  await knex.schema.createTable("notifications", (table) => {
    table.text("id").primary();
    table
      .text("profile_id")
      .notNullable()
      .references("id")
      .inTable("user_profiles")
      .onDelete("CASCADE");
    table
      .text("job_application_id")
      .references("id")
      .inTable("job_applications")
      .onDelete("CASCADE");
    table.text("type").notNullable();
    table.text("title").notNullable();
    table.text("body");
    table.timestamp("read_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    "create index idx_notifications_profile_created on notifications(profile_id, created_at desc)",
  );
  await knex.schema.raw(
    "create index idx_notifications_profile_unread on notifications(profile_id, read_at)",
  );

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
    table.timestamp("dead_lettered_at", { useTz: true });
    table.timestamp("last_error_at", { useTz: true });
  });
  await knex.schema.raw(
    "create index idx_outbox_events_pending on outbox_events(type, available_at, lease_expires_at, created_at) where processed_at is null and dead_lettered_at is null",
  );

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
      .text("reservation_id")
      .references("id")
      .inTable("credit_reservations")
      .onDelete("SET NULL");
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
  await knex.schema.raw(`
    create unique index uq_credit_ledger_usage_reservation
      on credit_ledger_entries (reservation_id)
      where entry_type = 'usage' and reservation_id is not null
  `);

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
  await knex.schema.dropTableIfExists("credit_ledger_entries");
  await knex.schema.dropTableIfExists("credit_reservations");
  await knex.schema.dropTableIfExists("credit_grants");
  await knex.schema.dropTableIfExists("credit_accounts");
  await knex.schema.dropTableIfExists("outbox_events");
  await knex.schema.dropTableIfExists("notifications");
  await knex.schema.dropTableIfExists("generated_documents");
  await knex.schema.dropTableIfExists("job_application_follow_ups");
  await knex.schema.dropTableIfExists("job_application_contacts");
  await knex.schema.dropTableIfExists("job_application_events");
  await knex.schema.dropTableIfExists("job_applications");
  await knex.schema.dropTableIfExists("user_profiles");
  await knex.schema.dropTableIfExists("verification");
  await knex.schema.dropTableIfExists("account");
  await knex.schema.dropTableIfExists("session");
  await knex.schema.dropTableIfExists("user");
};
