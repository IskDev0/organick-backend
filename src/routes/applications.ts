import { Context, Hono } from "hono";
import { z } from "zod";
import { validator } from "hono/validator";
import prisma from "../db/prisma";

const app = new Hono();


app.post(
  "/",
  validator("json", (value, c) => {
    const schema = z.object({
      fullName: z.string(),
      email: z.string().email(),
      subject: z.string(),
      company: z.string(),
      message: z.string(),
    });

    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json(parsed.error.issues, 401);
    }
    return parsed.data;
  }),
  async (c: Context) => {
    const { fullName, email, subject, company, message } = await c.req.json();

    try {
      await prisma.application.create({
        data: {
          fullName,
          email,
          subject,
          company,
          message,
        },
      });

      return c.json({ message: "Application submitted successfully" });
    } catch (error: any) {
      return c.json({ message: error.message || "An unexpected error occurred" }, 500);
    }
  }
);

export default app;