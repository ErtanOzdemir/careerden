/**
 * Tracks first-run onboarding per profile:
 * - `onboarding_completed_at` is set when the setup wizard is finished or skipped.
 * - `onboarding_checklist_dismissed_at` is set when the dashboard setup checklist is closed.
 *
 * Existing profiles predate onboarding, so they are marked complete and never see the wizard.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.timestamp("onboarding_completed_at", { useTz: true }).nullable();
    table.timestamp("onboarding_checklist_dismissed_at", { useTz: true }).nullable();
  });

  await knex("user_profiles").update({
    onboarding_completed_at: knex.fn.now(),
    onboarding_checklist_dismissed_at: knex.fn.now(),
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("onboarding_checklist_dismissed_at");
    table.dropColumn("onboarding_completed_at");
  });
};
