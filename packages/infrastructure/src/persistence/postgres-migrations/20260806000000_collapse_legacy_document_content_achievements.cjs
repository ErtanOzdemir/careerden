/**
 * Collapses legacy per-item `achievements` arrays in `job_applications.document_content` into the
 * single prose description that format version 2 uses, so the runtime normalizer that used to do
 * this on every read can be deleted.
 *
 * The rich-document helpers below are copied rather than imported: migrations are CommonJS and
 * cannot load the ESM `@careerden/domain` package, and more importantly a migration must stay frozen
 * against the code as it was when written. Do not refactor these to track the domain package.
 *
 * Irreversible: achievement text is merged into prose and cannot be split back out. `down` is a
 * documented no-op.
 */

const BATCH_SIZE = 500;

exports.up = async function up(knex) {
  let cursor = "";

  for (;;) {
    const { rows } = await knex.raw(
      `select ja.id,
              ja.document_content,
              p.experience,
              p.education,
              p.projects
         from job_applications ja
         join user_profiles p on p.id = ja.profile_id
        where ja.document_content is not null
          and ja.id > ?
          and (
                ja.document_content->>'formatVersion' is distinct from '2'
             or jsonb_path_exists(ja.document_content, '$.experienceEnhancements[*].achievements')
             or jsonb_path_exists(ja.document_content, '$.educationEnhancements[*].achievements')
             or jsonb_path_exists(ja.document_content, '$.projectEnhancements[*].achievements')
             or jsonb_path_exists(ja.document_content, '$.selections.*.*.achievements')
              )
        order by ja.id
        limit ?`,
      [cursor, BATCH_SIZE],
    );

    if (rows.length === 0) return;

    await knex.transaction(async (trx) => {
      for (const row of rows) {
        const collapsed = collapseLegacyDocumentContent(
          {
            experience: asArray(row.experience),
            education: asArray(row.education),
            projects: asArray(row.projects),
          },
          asObject(row.document_content),
        );

        // `updated_at` is deliberately not bumped: it drives the change bus that fans out SSE
        // notifications, and touching every row would flood every connected client.
        await trx.raw("update job_applications set document_content = ?::jsonb where id = ?", [
          JSON.stringify(collapsed),
          row.id,
        ]);
      }
    });

    cursor = rows[rows.length - 1].id;
  }
};

exports.down = async function down() {
  // Intentionally empty. The achievement text was merged into each description and cannot be
  // recovered, and the code that read the separate arrays no longer exists.
  console.warn(
    "20260806000000_collapse_legacy_document_content_achievements is not reversible; leaving data as-is.",
  );
};

/**
 * Reproduces the effective behaviour of the runtime normalizer this migration replaces. Exported
 * for unit testing; Knex ignores exports other than `up` and `down`.
 */
function collapseLegacyDocumentContent(profile, content) {
  // Parsed defensively: depending on the driver, jsonb columns arrive either already decoded or as
  // raw strings, and this runs once against production data with no way back.
  const experience = collapseExperience(asArray(profile.experience), content);
  const education = collapseEducation(content);
  const projects = collapseProjects(asArray(profile.projects), content);

  return {
    ...content,
    formatVersion: 2,
    experienceEnhancements: experience.enhancements,
    educationEnhancements: education.enhancements,
    projectEnhancements: projects.enhancements,
    selections: {
      ...content.selections,
      experience: pinCollapsedSelections(
        content.selections?.experience,
        experience.collapsedIndexes,
      ),
      education: pinCollapsedSelections(content.selections?.education, education.collapsedIndexes),
      projects: pinCollapsedSelections(content.selections?.projects, projects.collapsedIndexes),
    },
  };
}

exports.collapseLegacyDocumentContent = collapseLegacyDocumentContent;

function collapseExperience(experiences, content) {
  const collapsedIndexes = new Set();
  const enhancements = asArray(content.experienceEnhancements).map((enhancement) => {
    const selection = content.selections?.experience?.[String(enhancement.experienceIndex)];
    const achievements = asArray(enhancement.achievements);
    if (achievements.length === 0) {
      return {
        experienceIndex: enhancement.experienceIndex,
        ...describedBy(enhancement.description),
      };
    }

    collapsedIndexes.add(enhancement.experienceIndex);
    const experience = experiences[enhancement.experienceIndex];
    const originalDescription = experience
      ? toRichDocument(experience.description, experience.descriptionRichText)
      : undefined;
    const description =
      selection?.description === "original"
        ? originalDescription
        : (enhancement.description ?? originalDescription);
    const selected = achievements.filter(
      (_, index) => selection?.achievements?.[String(index)] !== "original",
    );

    return {
      experienceIndex: enhancement.experienceIndex,
      ...describedBy(mergeRichDocumentsAsProse(description, ...selected)),
    };
  });

  return { collapsedIndexes, enhancements };
}

function collapseEducation(content) {
  const collapsedIndexes = new Set();
  const enhancements = asArray(content.educationEnhancements).map((enhancement) => {
    const selection = content.selections?.education?.[String(enhancement.educationIndex)];
    const achievements = asArray(enhancement.achievements);
    if (achievements.length === 0) {
      return {
        educationIndex: enhancement.educationIndex,
        ...describedBy(enhancement.description),
      };
    }

    collapsedIndexes.add(enhancement.educationIndex);
    // Education had no profile-side description when these rows were written, so "original" means
    // "drop the tailored description" rather than "fall back to the profile text".
    const description = selection?.description === "original" ? undefined : enhancement.description;
    const selected = achievements.filter(
      (_, index) => selection?.achievements?.[String(index)] !== "original",
    );

    return {
      educationIndex: enhancement.educationIndex,
      ...describedBy(mergeRichDocumentsAsProse(description, ...selected)),
    };
  });

  return { collapsedIndexes, enhancements };
}

function collapseProjects(projects, content) {
  const collapsedIndexes = new Set();
  const enhancementByIndex = new Map(
    asArray(content.projectEnhancements).map((enhancement) => [
      enhancement.projectIndex,
      enhancement,
    ]),
  );
  const indexes = new Set(enhancementByIndex.keys());

  // Before format version 2, a project's own achievements were rendered as separate bullets with no
  // enhancement entry, so one has to be synthesized for them here.
  if (content.formatVersion !== 2) {
    projects.forEach((project, index) => {
      if (asArray(project.achievements).length > 0) indexes.add(index);
    });
  }

  const enhancements = [...indexes]
    .sort((left, right) => left - right)
    .flatMap((projectIndex) => {
      const project = projects[projectIndex];
      const enhancement = enhancementByIndex.get(projectIndex);
      const selection = content.selections?.projects?.[String(projectIndex)];
      const originalDescription = project
        ? toRichDocument(project.description, project.descriptionRichText)
        : undefined;
      const originalAchievements = asArray(project?.achievements);
      const enhancementAchievements = asArray(enhancement?.achievements);
      const shouldCollapse =
        enhancementAchievements.length > 0 ||
        (content.formatVersion !== 2 && originalAchievements.length > 0);

      if (!shouldCollapse) {
        return enhancement ? [{ projectIndex, ...describedBy(enhancement.description) }] : [];
      }

      collapsedIndexes.add(projectIndex);
      const description =
        selection?.description === "original"
          ? originalDescription
          : (enhancement?.description ?? originalDescription);
      const count = Math.max(originalAchievements.length, enhancementAchievements.length);
      const selected = Array.from({ length: count }, (_, achievementIndex) => {
        const original = originalAchievements[achievementIndex]
          ? richDocumentFromText(originalAchievements[achievementIndex])
          : undefined;
        const enhanced = enhancementAchievements[achievementIndex];
        if (!enhanced) return original;
        return selection?.achievements?.[String(achievementIndex)] === "original"
          ? original
          : enhanced;
      }).filter(Boolean);
      const merged = mergeRichDocumentsAsProse(description, ...selected);

      return merged ? [{ projectIndex, description: merged }] : [];
    });

  return { collapsedIndexes, enhancements };
}

/**
 * Drops every `achievements` record and pins collapsed indexes to the AI side, since their tailored
 * text now contains the achievements that used to be individually selectable.
 *
 * Unlike the runtime normalizer, indexes with no saved selection get an entry created rather than
 * skipped. That normalizer only iterated keys already present, which happened to work because an
 * unset selection reads as "ai" anyway; writing it explicitly keeps the stored row self-describing.
 */
function pinCollapsedSelections(selections = {}, collapsedIndexes) {
  const pinned = Object.fromEntries(
    Object.entries(selections).map(([index, selection]) => [
      index,
      {
        ...(selection.description ? { description: selection.description } : {}),
        ...(collapsedIndexes.has(Number(index)) ? { description: "ai" } : {}),
      },
    ]),
  );

  for (const index of collapsedIndexes) {
    pinned[String(index)] = { description: "ai" };
  }

  return pinned;
}

function describedBy(description) {
  return description ? { description } : {};
}

function toRichDocument(text, richText) {
  return richText ?? (text ? richDocumentFromText(text) : undefined);
}

function richDocumentFromText(text) {
  return {
    version: 1,
    blocks: String(text)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ type: "paragraph", children: [{ type: "text", text: line }] })),
  };
}

function mergeRichDocumentsAsProse(...documents) {
  const nonEmpty = documents.filter((document) => document && richDocumentToPlainText(document));
  if (nonEmpty.length === 0) return undefined;
  if (
    nonEmpty.length === 1 &&
    nonEmpty[0].blocks.length === 1 &&
    nonEmpty[0].blocks[0]?.type === "paragraph"
  ) {
    return nonEmpty[0];
  }

  const seen = new Set();
  const sentences = nonEmpty
    .flatMap((document) => richDocumentToPlainText(document).split(/\n+/))
    .flatMap((text) => text.trim().split(/(?<=[.!?])\s+/))
    .map((text) => text.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((text) => {
      const key = text.toLocaleLowerCase().replace(/[.!?]+$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((text) => (/[.!?]$/.test(text) ? text : `${text}.`));

  return sentences.length > 0 ? richDocumentFromText(sentences.join(" ")) : undefined;
}

function richDocumentToPlainText(document) {
  return document.blocks.map(blockToPlainText).filter(Boolean).join("\n");
}

function blockToPlainText(block) {
  if (block.type === "paragraph" || block.type === "heading") {
    return block.children.map((child) => child.text).join("");
  }
  if ("items" in block) {
    return block.items
      .map((item) => item.blocks.map(blockToPlainText).filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n");
  }

  return block.rows
    .map((row) =>
      row.cells
        .map((cell) => cell.blocks.map(blockToPlainText).filter(Boolean).join("\n"))
        .join("\t"),
    )
    .join("\n");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asObject(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) ?? {};
    } catch {
      return {};
    }
  }
  return value ?? {};
}
