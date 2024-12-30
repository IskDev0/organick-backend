import { Context, Hono } from "hono";
import prisma from "../db/prisma";

const app = new Hono();

app.get("/", async (c: Context) => {
  try {
    let testimonials = await prisma.testimonial.findMany()
    return c.json(testimonials);
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

export default app;