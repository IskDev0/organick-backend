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
  pgm.createTable("users", {
    id: {
      type: "bigint",
      sequenceGenerated: {
        precedence: "ALWAYS"
      }
    },
    first_name: {
      type: "text",
      notNull: true
    },
    last_name: {
      type: "text",
      notNull: true
    },
    email: {
      type: "text",
      unique: true,
      notNull: true
    },
    phone: {
      type: "text"
    },
    password_hash: {
      type: "text",
      notNull: true
    },
    role: {
      type: "text",
      notNull: true,
      default: "user"
    },
    city: {
      type: "text"
    },
    street: {
      type: "text"
    },
    zipcode: {
      type: "text"
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp")
    }
  });
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("users");
};
