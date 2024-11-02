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
  pgm.createTable("orders", {
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
    total_amount: {
      type: "numeric(10,2)",
      notNull: true
    },
    status: {
      type: "varchar(255)",
      notNull: true,
      default: "pending"
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
    }
  });

  pgm.createTable("order_items", {
    id: {
      type: "bigint",
      primaryKey: true,
      sequenceGenerated: {
        precedence: "ALWAYS"
      }
    },
    order_id: {
      type: "bigint",
      notNull: true,
      references: "orders(id)"
    },
    product_id: {
      type: "bigint",
      notNull: true,
      references: "products(id)"
    },
    quantity: {
      type: "int",
      notNull: true
    },
    price: {
      type: "numeric(10,2)",
      notNull: true
    }
  });

  pgm.createTable("payments", {
    id: {
      type: "bigint",
      primaryKey: true,
      sequenceGenerated: {
        precedence: "ALWAYS"
      }
    },
    order_id: {
      type: "bigint",
      notNull: true,
      references: "orders(id)"
    },
    amount: {
      type: "numeric(10,2)",
      notNull: true
    },
    payment_method: {
      type: "varchar(255)",
      notNull: true
  },
    payment_status: {
      type: "varchar(255)",
      notNull: true
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp")
    }
  })
};

/**
 * @param pgm {import("node-pg-migrate").MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("orders", {
    cascade: true
  });
  pgm.dropTable("order_items", {
    cascade: true
  });
  pgm.dropTable("payments", {
    cascade: true
  });
};
