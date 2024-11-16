import { Context, Hono } from "hono";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";
import pool from "../db/postgres";
import { INewsWithUser } from "../types/INews";
import authMiddleware from "../middleware/auth";
import checkRole from "../middleware/role";
import getUserInfo from "../utils/auth/getUserInfo";


const app = new Hono();

app.get("/author/:id", async (c: Context) => {

  const id = c.req.param("id");

  try {
    const q = await pool.query<INewsWithUser[]>(`
        SELECT n.id, n.title, n.content, n.user_id, n.preview, n.short_description, n.created_at, u.first_name, u.last_name
        FROM news n
        JOIN users u on n.user_id = u.id
        WHERE u.id = $1`, [id]);

    if (q.rows.length === 0) {
      return c.json({ message: "No news found" }, 404);
    }
    return c.json(q.rows);

  }catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
})

app.get("/", async (c: Context) => {

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  try {
    const q = await pool.query<INewsWithUser[]>(`
        SELECT n.id, n.title, n.content, n.user_id, n.preview, n.short_description, n.created_at, u.first_name, u.last_name
        FROM news n
        JOIN users u on n.user_id = u.id
        LIMIT $1 OFFSET $2`, [limit, offset]);

    const totalNewsResult = await pool.query(`SELECT COUNT(*) FROM news`);
    const totalNews = parseInt(totalNewsResult.rows[0].count);
    const totalPages = Math.ceil(totalNews / limit);

    if (q.rows.length === 0) {
      return c.json({ message: "No news found" }, 404);
    }
    return c.json({
      data: q.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        limit
      }
    });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.get("/:id", async (c: Context) => {

  const id = c.req.param("id");

  try {
    const q = await pool.query<INewsWithUser[]>(`
        SELECT n.id, n.title, n.content, n.user_id, n.preview, n.short_description, n.created_at, u.first_name, u.last_name
        FROM news n
        JOIN users u on n.user_id = u.id
        WHERE n.id = $1`, [id]);

    if (q.rows.length === 0) {
      return c.json({ message: "No news found" }, 404);
    }
    return c.json(q.rows[0]);
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.post("/", authMiddleware, checkRole(["admin", "author"]), async (c: Context) => {

  const newsBody = await c.req.json();
  const { id } = getUserInfo(c);

  if (!newsBody || !newsBody.title || !newsBody.content) {
    return c.json({ message: "Invalid news data" }, 400);
  }

  try {
    await pool.query(
      `INSERT INTO news (title, content, user_id, preview, short_description) 
        VALUES ($1, $2, $3, $4, $5)`,
      [newsBody.title, newsBody.content, id, newsBody.preview, newsBody.short_description]);
    return c.json({ message: "News created successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.put("/:id", authMiddleware, checkRole(["admin", "author"]), async (c: Context) => {

  const id = c.req.param("id");
  const newsBody = await c.req.json();

  if (!newsBody || !newsBody.title || !newsBody.content) {
    return c.json({ message: "Invalid news data" }, 400);
  }

  try {
    await pool.query(`
        UPDATE news 
        SET title = $1, content = $2, preview = $3, short_description = $4 WHERE id = $5`,
      [newsBody.title, newsBody.content, newsBody.preview, newsBody.short_description, id]);
    return c.json({ message: "News updated successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.delete("/:id", authMiddleware, checkRole(["admin", "author"]), async (c: Context) => {

  const id = c.req.param("id");

  try {
    await pool.query(`DELETE FROM news WHERE id = $1`, [id]);
    return c.json({ message: "News deleted successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

export default app;