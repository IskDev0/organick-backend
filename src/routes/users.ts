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

  try {
    const result = await pool.query<IUser>("SELECT * FROM orders WHERE user_id = $1", [id]);
    return c.json(result.rows);
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.patch("/password", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  const {newPassword} = await c.req.json();

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