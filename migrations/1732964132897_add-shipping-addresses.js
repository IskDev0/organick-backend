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
  pgm.createTable("shipping_addresses", {
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
    order_id: {
      type: "bigint",
      notNull: true,
      references: "orders(id)"
    },
    address_line1: {
      type: "text",
      notNull: true
    },
    address_line2: {
      type: "text"
    },
    city: {
      type: "text",
      notNull: true
    },
    state: {
      type: "text",
      notNull: true
    },
    postal_code: {
      type: "text",
      notNull: true
    },
    country: {
      type: "text",
      notNull: true
    }
  }, {ifNotExists: true, cascade: true});
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("shipping_addresses", {
    cascade: true
  });
};
