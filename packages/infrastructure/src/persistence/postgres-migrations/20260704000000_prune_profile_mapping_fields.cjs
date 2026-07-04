function parseJson(value, fallback) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value ?? fallback;
}

function pruneArrayItems(value, keys) {
  const parsed = parseJson(value, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return item;
    }

    const next = { ...item };
    for (const key of keys) {
      delete next[key];
    }
    return next;
  });
}

function pruneFields(fields, keys) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return {};
  }

  const next = { ...fields };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function pruneAliasGroup(group, keys) {
  if (!group || typeof group !== "object" || Array.isArray(group)) {
    return group;
  }

  return {
    ...group,
    fields: pruneFields(group.fields, keys),
    ...(Array.isArray(group.items)
      ? {
          items: group.items.map((item) =>
            item && typeof item === "object" && !Array.isArray(item)
              ? { ...item, fields: pruneFields(item.fields, keys) }
              : item,
          ),
        }
      : {}),
  };
}

function pruneVariableAliases(value) {
  const aliases = parseJson(value, { fields: {} });
  if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) {
    return { fields: {} };
  }

  return {
    ...aliases,
    ...(aliases.selectedExperiences
      ? {
          selectedExperiences: pruneAliasGroup(aliases.selectedExperiences, [
            "achievements",
            "skills",
          ]),
        }
      : {}),
    ...(aliases.selectedEducation
      ? {
          selectedEducation: pruneAliasGroup(aliases.selectedEducation, ["achievements"]),
        }
      : {}),
  };
}

/**
 * @param {import("knex").Knex} knex
 */
exports.up = async function up(knex) {
  const profiles = await knex("user_profiles").select("id", "experience", "education");
  for (const profile of profiles) {
    await knex("user_profiles")
      .where({ id: profile.id })
      .update({
        experience: JSON.stringify(pruneArrayItems(profile.experience, ["achievements", "skills"])),
        education: JSON.stringify(pruneArrayItems(profile.education, ["achievements"])),
      });
  }

  const templates = await knex("document_templates").select("id", "variable_aliases");
  for (const template of templates) {
    await knex("document_templates")
      .where({ id: template.id })
      .update({
        variable_aliases: JSON.stringify(pruneVariableAliases(template.variable_aliases)),
      });
  }
};

/**
 */
exports.down = async function down() {
  // Non-restorative: deleted JSON values cannot be reconstructed.
};
