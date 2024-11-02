import { Context, Hono } from "hono";
import pool from "../db/postgres";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";
import { sign, verify } from "hono/jwt";
import { Resend } from "resend";
import { z } from "zod";

const app = new Hono();

app.post("/", async (c: Context) => {

  const emailSchema = z.object({
    email: z.string().email({ message: "Invalid email" })
  });

  const parseResult = emailSchema.safeParse(await c.req.json());

  if (!parseResult.success) {
    return c.json({ message: parseResult.error.issues[0].message }, 400);
  }

  const { email } = parseResult.data;

  if (!email) {
    return c.json({ message: "Email not provided" }, 400);
  }

  const hasSubscribed = await pool.query("SELECT * FROM subscribers WHERE email = $1 AND is_subscribed = false", [email]);

  if (hasSubscribed.rows.length > 0) {
    try {
      await pool.query("UPDATE subscribers SET is_subscribed = true WHERE email = $1", [email]);
      return c.json({ message: "Subscribed successfully" });
    } catch (error: any | PostgresError) {
      const { status, message } = handleSQLError(error as PostgresError);
      return c.json({ message }, status);
    }
  }

  try {
    await pool.query("INSERT INTO subscribers (email) VALUES ($1)", [email]);
    return c.json({ message: "Subscribed successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

const resend = new Resend(process.env.RESEND_API_KEY);

app.post("/unsubscribe", async (c) => {
  const { email } = await c.req.json();

  if (!email) {
    return c.json({ message: "Email not provided" }, 400);
  }
  const userQuery = await pool.query(`SELECT * FROM subscribers WHERE email = $1`, [email]);

  const user = userQuery.rows[0];

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  if (!user.is_subscribed) {
    return c.json({ message: "User is not subscribed" }, 400);
  }

  const payload = {
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60
  };

  const token = await sign(payload, process.env.EMAIL_SECRET!);

  //TODO Rewrite template and sender
  try {
    await resend.emails.send({
      from: "Acme <onboarding@resend.dev>",
      to: email,
      subject: "Confirm unsubscribe",
      html: `
        <p>Click the link below to unsubscribe</p>
        <a href="${process.env.FRONTEND_URL}/unsubscribe?token=${token}">Unsubscribe</a>
      `
    });

    return c.json({ message: "Unsubscribe confirmation email sent" });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      return c.json({ message: "Failed to send email" }, 500);
    }
  }
});

app.get("/confirm-unsubscribe", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.json({ message: "Token is missing" }, 400);
  }

  try {
    const { email } = await verify(token, process.env.EMAIL_SECRET!);

    await pool.query("UPDATE subscribers SET is_subscribed = false WHERE email = $1", [email]);

    return c.json({ message: "You have successfully unsubscribed" });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      return c.json({ message: "Invalid or expired token" }, 400);
    }
  }
});

export default app;