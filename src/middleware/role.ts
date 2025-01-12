import { getCookie } from "hono/cookie";
import { Context, Next } from "hono";
import { decode } from "hono/jwt";

const checkRole = (requiredRoles: string | string[]) => {
  return async (c: Context, next: Next) => {
    const token = getCookie(c, "accessToken");

    if (!token) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { payload } = decode(token);

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (payload.roleName) {
      if (!roles.includes((payload.roleName as string).toLowerCase())) {
        return c.json({ message: "You are not allowed to access this resource" }, 403);
      }
    }

    await next();
  };
};


export default checkRole;