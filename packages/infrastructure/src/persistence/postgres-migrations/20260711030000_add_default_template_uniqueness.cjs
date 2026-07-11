exports.up = async function up(knex) {
  await knex.schema.raw(
    "create unique index uq_document_templates_default on document_templates(profile_id, kind) where is_default = true",
  );
};

exports.down = async function down(knex) {
  await knex.schema.raw("drop index if exists uq_document_templates_default");
};
