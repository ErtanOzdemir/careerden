exports.up = async function up(knex) {
  await knex.raw("alter table job_applications alter column priority drop default");
  await knex.raw("alter table job_applications alter column priority drop not null");
  await knex("job_applications").update({ priority: null });
};

exports.down = async function down(knex) {
  await knex("job_applications").whereNull("priority").update({ priority: "medium" });
  await knex.raw("alter table job_applications alter column priority set default 'medium'");
  await knex.raw("alter table job_applications alter column priority set not null");
};
