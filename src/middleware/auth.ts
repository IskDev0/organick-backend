import { verify } from "hono/jwt";
import { Context, Next } from "hono";

const authMiddleware = async (c: Context, next: Next) => {
  const authHeader: string | undefined = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ message: "Authorization header missing" }, 401);
  }

  const token: string = authHeader.split(" ")[1];
  if (!token) {
    return c.json({ message: "Token missing" }, 401);
  }

  try {
    await verify(token, process.env.ACCESS_SECRET as string);
    await next();
  } catch (error) {
    return c.json({ error: "Token expired or invalid" }, 401);
  }
};

export default authMiddleware;