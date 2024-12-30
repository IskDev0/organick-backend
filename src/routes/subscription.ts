import { Context, Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { Resend } from "resend";
import { z } from "zod";
import prisma from "../db/prisma";

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

  try {

    const existingSubscriber = await prisma.subscribers.findFirst({
      where: {
        email,
        isSubscribed: false
      }
    });

    if (existingSubscriber) {
      await prisma.subscribers.update({
        where: { email },
        data: { isSubscribed: true }
      });
      return c.json({ message: "Subscribed successfully" });
    }

    await prisma.subscribers.create({
      data: { email }
    });

    return c.json({ message: "Subscribed successfully" });
  } catch (error: any) {
    console.error("Error subscribing user:", error);
    return c.json({ message: error.message }, 500);
  }
});

const resend = new Resend(process.env.RESEND_API_KEY);

app.post("/unsubscribe", async (c) => {
  const { email } = await c.req.json();

  if (!email) {
    return c.json({ message: "Email not provided" }, 400);
  }

  try {

    const user = await prisma.subscribers.findUnique({
      where: { email }
    });

    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    if (!user.isSubscribed) {
      return c.json({ message: "User is not subscribed" }, 400);
    }

    const payload = {
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour
    };

    const token = await sign(payload, process.env.EMAIL_SECRET!);

    // Отправка письма с подтверждением отписки
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
  } catch (error: any) {
    console.error("Error during unsubscribe process:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/confirm-unsubscribe", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.json({ message: "Token is missing" }, 400);
  }

  try {
    const { email } = await verify(token, process.env.EMAIL_SECRET!) as { email: string };


    await prisma.subscribers.update({
      where: { email },
      data: { isSubscribed: false }
    });

    return c.json({ message: "You have successfully unsubscribed" });
  } catch (error: any) {
    console.error("Error during unsubscribe confirmation:", error);
    return c.json({ message: error.message }, 400);
  }
});


export default app;