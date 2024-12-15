import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import getUserInfo from "../utils/auth/getUserInfo";
import pool from "../db/postgres";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";
import checkRole from "../middleware/role";
import { z } from 'zod';


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

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().positive(),
    quantity: z.number().positive(),
    price: z.number().nonnegative(),
  })),
  totalAmount: z.number().positive(),
  address: z.object({
    address_line1: z.string(),
    address_line2: z.string(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string(),
  }),
  payment: z.object({
    amount: z.number().positive(),
    paymentMethod: z.string(),
  })
});

app.post('/', async (c) => {
  const { id } = getUserInfo(c);

  const client = await pool.connect();
  try {
    const { items, totalAmount, address, payment } = orderSchema.parse(await c.req.json());

    await client.query('BEGIN');

    const orderResult = await client.query(`
        INSERT INTO orders (user_id, total_amount, status)
        VALUES ($1, $2, 'pending') RETURNING id
    `, [id, totalAmount]);
    if (!orderResult.rows.length) throw new Error('Order creation failed');
    const orderId = orderResult.rows[0].id;

    const productIds = items.map(item => item.productId);
    const quantities = items.map(item => item.quantity);
    const prices = items.map(item => item.price);

    await client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        SELECT $1, UNNEST($2::int[]), UNNEST($3::int[]), UNNEST($4::float[])
    `, [orderId, productIds, quantities, prices]);

    await client.query(`
      INSERT INTO shipping_addresses (user_id, order_id, address_line1, address_line2, city, state, postal_code, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, orderId, address.address_line1, address.address_line2, address.city, address.state, address.postal_code, address.country]);

    if (payment) {
      const { amount, paymentMethod } = payment;

      if (amount !== totalAmount) throw new Error('Payment amount does not match order total');

      await client.query(`
        INSERT INTO payments (order_id, amount, payment_method, payment_status)
        VALUES ($1, $2, $3, 'completed')
      `, [orderId, amount, paymentMethod]);

      await client.query(`
        UPDATE orders SET status = 'paid' WHERE id = $1
      `, [orderId]);
    }

    await client.query('COMMIT');

    return c.json({ message: 'Order created successfully', orderId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Order creation failed:', error);
    return c.json({ error: error.message }, 400);
  } finally {
    client.release();
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

export default app;