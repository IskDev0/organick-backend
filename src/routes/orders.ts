import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import getUserInfo from "../utils/auth/getUserInfo";
import pool from "../db/postgres";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";
import { IProduct } from "../types/IProduct";
import checkRole from "../middleware/role";


const app = new Hono();

app.get("/", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  const { limit = 10, page = 1 } = c.req.query();

  const parsedLimit = Number(limit);
  const parsedPage = Number(page);
  const offset = (parsedPage - 1) * parsedLimit;

  const totalOrdersResult = await pool.query("SELECT COUNT(*) FROM orders WHERE user_id = $1", [id]);
  const totalProducts = parseInt(totalOrdersResult.rows[0].count);
  const totalPages = Math.ceil(totalProducts / parsedLimit);

  try {
    const result = await pool.query(`
       SELECT 
        o.id AS order_id,
        o.total_amount,
        o.status,
        o.created_at,
        o.updated_at,
        json_agg(
            json_build_object(
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'name', p.name,
            'image', p.image
            )
        ) AS items
        FROM  orders o
        JOIN 
        order_items oi ON o.id = oi.order_id
        JOIN 
        products p ON oi.product_id = p.id
        WHERE o.user_id = $1
        GROUP BY  o.id
        LIMIT $2 OFFSET $3
        `, [id, limit, offset]);
    const orders = result.rows;

    return c.json({
      data: orders,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalProducts,
        limit: parsedLimit
      }
    });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.post("/", authMiddleware, async (c: Context) => {

  try {
    const userId = getUserInfo(c).id;
    const { items, shippingAddress } = await c.req.json();

    const totalAmount = await calculateTotalAmount(items);

    await pool.query("BEGIN");

    const orderResult = await pool.query(
      `
      INSERT INTO orders (user_id, total_amount, status)
      VALUES ($1, $2, 'pending') RETURNING id
      `,
      [userId, totalAmount]
    );
    const orderId = orderResult.rows[0].id;

    const orderItemsQuery = `
      INSERT INTO order_items (order_id, product_id, quantity, price)
      VALUES ($1, $2, $3, $4)
    `;
    for (const item of items) {
      console.log(item);
      await pool.query(orderItemsQuery, [
        orderId,
        item.id,
        item.quantity,
        item.price
      ]);
    }

    // Insert the shipping address
    // await pool.query(
    //   `
    //   INSERT INTO shipping_addresses (user_id, order_id, address_line1, address_line2, city, state, postal_code, country)
    //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    //   `,
    //   [
    //     userId,
    //     orderId,
    //     shippingAddress.address_line1,
    //     shippingAddress.address_line2,
    //     shippingAddress.city,
    //     shippingAddress.state,
    //     shippingAddress.postal_code,
    //     shippingAddress.country,
    //   ]
    // );

    await pool.query("COMMIT");

    return c.json({ message: "Order created successfully" });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Failed to create order:", error);
    return c.json(
      { message: "Failed to create order", error: error.message },
      500
    );
  }
});

app.patch("/:id", authMiddleware, async (c: Context) => {
  const { id } = c.req.param();

  try {
    await pool.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [id]);
    return c.json({ message: "Order status updated successfully" });
  }  catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
})

app.delete("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {

  const {id} = c.req.param();

  try {
    await pool.query(`DELETE FROM orders WHERE id = $1`, [id]);
    return c.json({ message: "Order deleted successfully" });
  }  catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
})



async function calculateTotalAmount(items:IProduct[]):Promise<string> {
  let total = 0;

  for (const item of items) {
    const product = await pool.query(`SELECT price, discount FROM products WHERE id = $1`, [item.id]);
    const price = product.rows[0].price * (1 - product.rows[0].discount / 100);
    total += price * item.quantity;
  }

  return total.toFixed(2);
}

export default app;