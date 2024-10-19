import { Context, Hono } from "hono";
import pool from "../db/postgres";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";

const app = new Hono();

app.get("/", async (c: Context) => {
  try {
    const { rows } = await pool.query("SELECT * FROM testimonials");
    return c.json(rows);
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

export default app;