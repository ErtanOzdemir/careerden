/**
 * Compatibility migration retained because released Knex migration filenames are immutable.
 * The preceding scrape-claim migration already added the attempt-tracking columns and index.
 */
exports.up = async function up() {};

/**
 * The migration does not own schema changes, so rollback must also be a no-op.
 */
exports.down = async function down() {};
