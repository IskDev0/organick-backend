import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import checkRole from "../middleware/role";
import getUserInfo from "../utils/auth/getUserInfo";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = new Hono();

app.get("/author/:id", async (c: Context) => {
  const id = c.req.param("id");

  try {
    const news = await prisma.news.findMany({
      where: { userId: id },
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!news.length) {
      return c.json({ message: "No news found" }, 404);
    }

    return c.json(news);
  } catch (error: any) {
    console.log(error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/", async (c: Context) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  try {
    const [news, totalNews] = await prisma.$transaction([
      prisma.news.findMany({
        skip: offset,
        take: limit,
        include: {
          user: {
            select: { firstName: true, lastName: true }
          }
        }
      }),
      prisma.news.count()
    ]);

    const totalPages = Math.ceil(totalNews / limit);

    return c.json({
      data: news,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        limit
      }
    });
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/:id", async (c: Context) => {

  const id = c.req.param("id");

  try {
    const news = await prisma.news.findUnique({
      where: { id },
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!news) {
      return c.json({ message: "No news found" }, 404);
    }

    return c.json(news);
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

app.post("/", authMiddleware, checkRole(["admin", "author"]), async (c: Context) => {
  const newsBody = await c.req.json();
  const { id: userId } = getUserInfo(c);

  if (!newsBody || !newsBody.title || !newsBody.content) {
    return c.json({ message: "Invalid news data" }, 400);
  }

  try {
    await prisma.news.create({
      data: {
        title: newsBody.title,
        content: newsBody.content,
        preview: newsBody.preview,
        shortDescription: newsBody.shortDescription,
        userId
      }
    });
    return c.json({ message: "News created successfully" });
  } catch (error: any) {
    return c.json(error.message, 500);
  }
});

app.put("/:id", authMiddleware, checkRole(["admin", "author"]), async (c: Context) => {
  const id = c.req.param("id");
  const newsBody = await c.req.json();

  if (!newsBody || !newsBody.title || !newsBody.content) {
    return c.json({ message: "Invalid news data" }, 400);
  }

  try {
    await prisma.news.update({
      where: { id },
      data: {
        title: newsBody.title,
        content: newsBody.content,
        preview: newsBody.preview,
        shortDescription: newsBody.shortDescription
      }
    });
    return c.json({ message: "News updated successfully" });
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

app.delete("/:id", authMiddleware, checkRole(["admin", "author"]), async (c: Context) => {

  const id = c.req.param("id");

  try {
    await prisma.news.delete({
      where: { id }
    });
    return c.json({ message: "News deleted successfully" });
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

export default app;