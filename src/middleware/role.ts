import { getCookie } from "hono/cookie";
import { Context, Next } from "hono";
import { decode } from "hono/jwt";

const checkRole = (requiredRole: string) => {
  return async (c: Context, next: Next) => {
    const token = getCookie(c, "accessToken");

    if (!token) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { payload } = decode(token);

    if (payload.role !== requiredRole) {
      return c.json({ message: "You are not allowed to access this resource" }, 401);
    }

    await next();
  };
};

export default checkRole;