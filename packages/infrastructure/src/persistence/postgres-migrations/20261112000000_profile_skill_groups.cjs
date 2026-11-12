/**
 * Replaces the flat `user_profiles.skills` list with `skill_groups`, a list of
 * `{ name, skills }` categories where an empty name holds uncategorized skills.
 *
 * Existing skills move, in order, into one uncategorized group, so every profile keeps all of its
 * skills and its CV looks unchanged until the user adds categories. Rolling back flattens the
 * groups into the old list in group order.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.jsonb("skill_groups").notNullable().defaultTo("[]");
  });

  await knex.raw(`
    UPDATE user_profiles
    SET skill_groups = jsonb_build_array(jsonb_build_object('name', '', 'skills', skills))
    WHERE jsonb_typeof(skills) = 'array' AND jsonb_array_length(skills) > 0
  `);

  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("skills");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("user_profiles", (table) => {
    table.jsonb("skills").notNullable().defaultTo("[]");
  });

  await knex.raw(`
    UPDATE user_profiles
    SET skills = COALESCE(
      (
        SELECT jsonb_agg(skill.value ORDER BY grp.ordinality, skill.ordinality)
        FROM jsonb_array_elements(skill_groups) WITH ORDINALITY AS grp(value, ordinality)
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(grp.value -> 'skills') = 'array'
            THEN grp.value -> 'skills' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS skill(value, ordinality)
      ),
      '[]'::jsonb
    )
  `);

  await knex.schema.alterTable("user_profiles", (table) => {
    table.dropColumn("skill_groups");
  });
};
