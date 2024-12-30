import { Context, Hono } from "hono";
import prisma from "../db/prisma";

const app = new Hono()

app.get("/team", async (c:Context) => {
  try {
    const teamMembers = await prisma.team.findMany()
    return c.json(teamMembers)
  }catch (error:any) {
    console.error(error);
    return c.json({message: error.message}, 500)
  }
})

export default app