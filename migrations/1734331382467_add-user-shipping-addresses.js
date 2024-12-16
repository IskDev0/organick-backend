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
  pgm.createTable("user_addresses", {
    id: {
      type: "bigint",
      primaryKey: true,
      sequenceGenerated: {
        precedence: "ALWAYS"
      }
    },
    user_id: {
      type: "bigint",
      notNull: true,
      references: "users(id)"
    },
    address_line1: {
      type: "text",
      notNull: true
    },
    address_line2: {
      type: "text"
    },
    city: {
      type: "varchar(255)",
      notNull: true
    },
    state: {
      type: "varchar(255)",
      notNull: true
    },
    country: {
      type: "varchar(255)",
      notNull: true
    },
    postal_code: {
      type: "varchar(255)",
      notNull: true
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: "now()"
    },
    updated_at: {
      type: "timestamp",
      notNull: true,
      default: "now()"
    }
  }, {ifNotExists: true});
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("user_addresses", {cascade: true});
};
