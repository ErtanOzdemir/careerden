/**
 * Turns `user_profiles.links` from a list of URL strings into a list of `{ kind, url }` objects.
 *
 * Each existing URL keeps its position and gets a kind inferred from its hostname: `linkedin` for
 * linkedin.com, `github` for github.com (and their subdomains), and `website` otherwise. Malformed
 * elements, such as empty strings, nulls, numbers, and objects without a string `kind` and `url`,
 * are dropped rather than failing the migration. Elements that already are `{ kind, url }` objects
 * are kept as they are, so running it twice changes nothing. Rolling back flattens the objects back
 * into their URL strings in order.
 */

exports.up = async function up(knex) {
  await knex.raw(`
    UPDATE user_profiles
    SET links = COALESCE(
      (
        SELECT jsonb_agg(typed.value ORDER BY typed.ordinality)
        FROM (
          SELECT
            CASE
              WHEN jsonb_typeof(link.value) = 'string' THEN jsonb_build_object(
                'kind',
                CASE
                  WHEN legacy.host ~ '(^|\\.)linkedin\\.com$' THEN 'linkedin'
                  WHEN legacy.host ~ '(^|\\.)github\\.com$' THEN 'github'
                  ELSE 'website'
                END,
                'url',
                legacy.url
              )
              ELSE link.value
            END AS value,
            link.ordinality
          FROM jsonb_array_elements(links) WITH ORDINALITY AS link(value, ordinality)
          CROSS JOIN LATERAL (
            SELECT
              btrim(link.value #>> '{}') AS url,
              -- The hostname: everything after the scheme up to the first path, port, query, or
              -- fragment character. Knex reads a question mark as a binding, so chr(63) stands in.
              lower(
                split_part(
                  substring(
                    regexp_replace(btrim(link.value #>> '{}'), '^[a-zA-Z][a-zA-Z0-9+.-]*://', '')
                    FROM '^[^/#:]+'
                  ),
                  chr(63),
                  1
                )
              ) AS host
          ) AS legacy
          WHERE
            (jsonb_typeof(link.value) = 'string' AND legacy.url <> '')
            OR (
              jsonb_typeof(link.value) = 'object'
              AND jsonb_typeof(link.value -> 'kind') = 'string'
              AND jsonb_typeof(link.value -> 'url') = 'string'
              AND btrim(link.value ->> 'url') <> ''
            )
        ) AS typed
      ),
      '[]'::jsonb
    )
    WHERE jsonb_typeof(links) = 'array'
  `);

  await knex.raw(`
    UPDATE user_profiles SET links = '[]'::jsonb WHERE jsonb_typeof(links) IS DISTINCT FROM 'array'
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    UPDATE user_profiles
    SET links = COALESCE(
      (
        SELECT jsonb_agg(link.value -> 'url' ORDER BY link.ordinality)
        FROM jsonb_array_elements(links) WITH ORDINALITY AS link(value, ordinality)
        WHERE jsonb_typeof(link.value -> 'url') = 'string'
      ),
      '[]'::jsonb
    )
    WHERE jsonb_typeof(links) = 'array'
  `);
};
