import { Context, Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import { sign, verify } from "hono/jwt";
import { getCookie, setCookie } from "hono/cookie";
import authMiddleware from "../middleware/auth";
import generateTokens from "../utils/auth/generateTokens";
import getUserInfo from "../utils/auth/getUserInfo";

const app = new Hono();
const prisma = new PrismaClient();

app.post("/register", async (c: Context) => {
  const userBody = await c.req.json();

  if (!userBody) {
    return c.json({ message: "Username or password not provided" }, 400);
  }

  const hashedPassword: string = await Bun.password.hash(userBody.password);

  try {
    const user = await prisma.user.create({
      data: {
        firstName: userBody.first_name,
        lastName: userBody.last_name,
        passwordHash: hashedPassword,
        email: userBody.email,
        phone: userBody.phone
      }
    });

    const payload = {
      id: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour
    };

    const accessToken = await sign(payload, process.env.ACCESS_SECRET as string);
    const refreshToken = await sign(
      {
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
      },
      process.env.REFRESH_SECRET as string
    );

    setCookie(c, "accessToken", accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 // 1 hour
    });

    setCookie(c, "refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return c.json({
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role
    });
  } catch (error) {
    return c.json({ message: error }, 500);
  }
});

app.post("/login", async (c: Context) => {
  const userBody = await c.req.json();

  if (!userBody.email || !userBody.password) {
    return c.json({ message: "Email or password not provided" }, 400);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: userBody.email }
    });

    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    console.log(userBody.password);

    const isValidPassword: boolean = await Bun.password.verify(
      userBody.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      return c.json({ message: "Invalid password" }, 422);
    }

    const payload = {
      id: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour
    };

    const accessToken = await sign(payload, process.env.ACCESS_SECRET as string);
    const refreshToken = await sign(
      {
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
      },
      process.env.REFRESH_SECRET as string
    );

    setCookie(c, "accessToken", accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 // 1 hour
    });

    setCookie(c, "refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return c.json({
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role
    });
  } catch (error: any) {
    console.error("Error logging in:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/user", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);

  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    return c.json({
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role
    });
  } catch (error: any) {
    console.error("Error getting user:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.post("/refresh", async (c: Context) => {
  const refreshToken = getCookie(c, "refreshToken");
  if (!refreshToken) {
    return c.json({ message: "Refresh token not found" }, 400);
  }

  try {
    const payload = await verify(
      refreshToken,
      process.env.REFRESH_SECRET as string
    );

    const tokens = await generateTokens(payload.id as string, payload.role as string);

    setCookie(c, "accessToken", tokens.accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 // 1 hour
    });

    setCookie(c, "refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return c.json({ message: "Tokens refreshed successfully" });
  } catch (error) {
    return c.json({ message: "Invalid refresh token" }, 401);
  }
});

app.post("/logout", (c: Context) => {
  setCookie(c, "accessToken", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0
  });

  setCookie(c, "refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0
  });

  return c.json({ message: "Logout successful" });
});

export default app;
