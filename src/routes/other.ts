import { Context, Hono } from "hono";
import pool from "../db/postgres";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";

const app = new Hono()

app.get("/team", async (c:Context) => {
  try {
    const result = await pool.query("SELECT * FROM team")
    return c.json(result.rows)
  }catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
})

export default app