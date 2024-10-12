import { getCookie } from "hono/cookie";
import { decode } from "hono/jwt";
import { Context } from "hono";
import { JWTPayload } from "hono/dist/types/utils/jwt/types";

type UserInfo = {
  id: number;
  role: string;
};

export default function getUserInfo(c: Context): UserInfo {

  const token = getCookie(c, "accessToken");

  if (!token) {
    return { id: 0, role: "guest" };
  }

  try {
    const payload: JWTPayload = decode(token).payload;
    return {
      id: payload.id as number,
      role: payload.role as string
    };
  } catch (error) {
    return { id: 0, role: "guest" };
  }
}
