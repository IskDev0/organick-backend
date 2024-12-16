import { Context, Hono } from "hono";
import pool from "../db/postgres";
import { IUser } from "../types/IUser";
import authMiddleware from "../middleware/auth";
import getUserInfo from "../utils/auth/getUserInfo";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";


const app = new Hono();

app.get("/orders", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  const { limit = 10, page = 1 } = c.req.query();

  const parsedLimit = Number(limit);
  const parsedPage = Number(page);
  const offset = (parsedPage - 1) * parsedLimit;

  const totalOrdersResult = await pool.query("SELECT COUNT(*) FROM orders WHERE user_id = $1", [id]);
  const totalOrders = parseInt(totalOrdersResult.rows[0].count);
  const totalPages = Math.ceil(totalOrders / parsedLimit);

  try {
    const result = await pool.query(`
        SELECT o.*,
               json_agg(json_build_object(
                       'quantity', oi.quantity,
                       'product_id', oi.product_id,
                       'product_name', p.name,
                       'product_image', p.image,
                       'price', oi.price
                        )) AS order_items,
               json_build_object(
                       'address_line1', sa.address_line1,
                       'address_line2', sa.address_line2,
                       'city', sa.city,
                       'state', sa.state,
                       'postal_code', sa.postal_code,
                       'country', sa.country
               )           AS shipping_address,
               pm.payment_method
        FROM orders o
                 LEFT JOIN order_items oi ON oi.order_id = o.id
                 LEFT JOIN products p ON oi.product_id = p.id
                 LEFT JOIN shipping_addresses sa ON sa.order_id = o.id AND sa.user_id = o.user_id
                 LEFT JOIN payments pm ON pm.order_id = o.id
        WHERE o.user_id = $1
        GROUP BY o.id, sa.address_line1, sa.address_line2, sa.city, sa.state, sa.postal_code, sa.country,
                 pm.payment_method
        LIMIT $2 OFFSET $3`, [id, limit, offset]);
    return c.json({
      data: result.rows,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalOrders,
        limit: parsedLimit
      }
    });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.patch("/password", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  const { newPassword } = await c.req.json();

  if (!newPassword) {
    return c.json({ message: "New password is required" }, 400);
  }

  let newHashedPassword = await Bun.password.hash(newPassword);

  try {
    await pool.query(`UPDATE users
                      SET password_hash = $1
                      WHERE id = $2`, [newHashedPassword, id]);
    return c.json({ message: "Password updated successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.get("/address", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  try {
    const result = await pool.query("SELECT * FROM user_addresses WHERE user_id = $1", [id]);
    return c.json(result.rows);
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.post("/address", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  const shippingAddress = await c.req.json();

  try {
    await pool.query(
      `INSERT INTO user_addresses (user_id, address_line1, address_line2, city, state, postal_code, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, shippingAddress.address_line1, shippingAddress.address_line2, shippingAddress.city, shippingAddress.state, shippingAddress.postal_code, shippingAddress.country]);
    return c.json({ message: "Shipping address created successfully" });
  } catch (error: any | PostgresError) {
    console.log(error);
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.put("/address/:id", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  const addressId = c.req.param("id");

  const shippingAddress = await c.req.json();

  try {
    await pool.query(
      `UPDATE user_addresses
       SET address_line1 = $1,
           address_line2 = $2,
           city          = $3,
           state         = $4,
           postal_code   = $5,
           country       = $6
        WHERE id = $7
        AND user_id = $8`,
      [shippingAddress.address_line1, shippingAddress.address_line2, shippingAddress.city, shippingAddress.state, shippingAddress.postal_code, shippingAddress.country, addressId, id]);
    return c.json({ message: "Shipping address updated successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.delete("/address/:id", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  const addressId = c.req.param("id");

  try {
    await pool.query(`DELETE FROM user_addresses WHERE id = $1 AND user_id = $2`, [addressId, id]);
    return c.json({ message: "Shipping address deleted successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
})

app.get("/:id", async (c: Context) => {

  const id = c.req.param("id");

  try {
    const result = await pool.query<IUser>("SELECT * FROM users WHERE id = $1", [id]);

    if (result.rows.length > 0) {
      let user = result.rows[0];
      return c.json({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email
      });
    }
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }

  return c.json({ message: "User not found" }, 404);
});

app.put("/", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  try {
    const userBody = await c.req.json();
    await pool.query(`UPDATE users
                      SET first_name = $1,
                          last_name  = $2,
                          email      = $3,
                          phone      = $4
                      WHERE id = $5`, [userBody.first_name, userBody.last_name, userBody.email, userBody.phone, id]);
    return c.json({ message: "User updated successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

export default app;