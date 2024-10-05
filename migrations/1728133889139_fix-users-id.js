/**
 * @type {import("node-pg-migrate").ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {

  pgm.dropColumn('users', 'id');

  pgm.addColumn('users', {
    id: {
      type: "bigint",
      primaryKey: true,
      sequenceGenerated: {
        precedence: "ALWAYS"
      }
    }
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropColumn('users', 'id');

  pgm.addColumn('users', {
    id: {
      type: "bigint",
      sequenceGenerated: {
        precedence: "ALWAYS"
      }
    }
  });
};
