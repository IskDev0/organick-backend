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
  pgm.createTable("products", {
    id: {
      type: "bigint",
      primaryKey: true,
      sequenceGenerated: {
        precedence: "ALWAYS"
      }
    },
    name: {
      type: "varchar(255)",
      notNull: true
    },
    description: {
      type: "text",
    },
    price: {
      type: "numeric(10,2)",
      notNull: true
    },
    old_price: {
      type: "numeric(10,2)",
    },
    rating: {
      type: "numeric(3,2)",
      default: 0
    },
    image: {
      type: "text",
    },
    stock: {
      type: "integer",
      notNull: true,
      default: 0
    },
    is_active: {
      type: "boolean",
      notNull: true,
      default: true
    },
    discount: {
      type: "numeric(5,2)",
      default: 0
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp")
    },
    updated_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp")
    },
    category_id: {
      type: "bigint",
      notNull: true,
      references: "categories(id)",
      onDelete: "set null"
    }
  })
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("products");
};
