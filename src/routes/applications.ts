import { Context, Hono } from "hono";
import { z } from "zod";
import { validator } from "hono/validator";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";
import pool from "../db/postgres";

const app = new Hono();

app.post("/",
  validator('json', (value, c) => {

    const schema = z.object({
      full_name: z.string(),
      email: z.string().email(),
      subject: z.string(),
      company: z.string(),
      message: z.string()
    });

    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      return c.json(parsed.error.issues, 401)
    }
    return parsed.data
  }),
  async (c: Context) => {

    const { full_name, email, subject, company, message } = await c.req.json();

    try {
      await pool.query("INSERT INTO applications (full_name, email, subject, company, message) VALUES ($1, $2, $3, $4, $5)", [full_name, email, subject, company, message]);
      return c.json({ message: "Application submitted successfully" });
    } catch (error: any | PostgresError) {
      const { status, message } = handleSQLError(error as PostgresError);
      return c.json({ message }, status);
    }

  });

export default app;