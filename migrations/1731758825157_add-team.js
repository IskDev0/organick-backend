/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable("team", {
    id: {
      type: "bigint",
      primaryKey: true,
      sequenceGenerated: {
        precedence: "ALWAYS"
      }
    },
    first_name: {
      type: "varchar(255)",
      notNull: true
    },
    last_name: {
      type: "varchar(255)",
      notNull: true
    },
    position: {
      type: "varchar(255)",
      notNull: true
    },
    image: {
      type: "text"
    },
    instagram: {
      type: "text"
    },
    facebook: {
      type: "text"
    },
    linkedin: {
      type: "text"
    },
    twitter: {
      type: "text"
    }
  }, {ifNotExists: true, cascade: true});
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("team");
};
