import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import checkRole from "../middleware/role";
import getUserInfo from "../utils/auth/getUserInfo";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = new Hono();

app.get("/authors", authMiddleware, checkRole(["admin"]), async (c: Context) => {

  try {
    const authors = await prisma.user.findMany({
      where: {
        OR: [{ role: "author" }, { role: "admin" }]
      },
      select: { id: true, firstName: true, lastName: true }
    });
    return c.json(authors);
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

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
    const [news, total] = await prisma.$transaction([
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

    const totalPages = Math.ceil(total / limit);

    return c.json({
      data: news,
      pagination: {
        currentPage: page,
        totalPages,
        total,
        limit
      }
    });
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/search", async (c: Context) => {
  const { title, userId, date, limit = 10, page = 1, order = "desc" } = c.req.query();
  const parsedLimit = Number(limit);
  const parsedPage = Number(page);
  const offset = (parsedPage - 1) * parsedLimit;

  try {
    // Формируем условие для фильтрации в зависимости от переданных параметров
    const filterConditions: any = {};

    if (title) {
      filterConditions.title = {
        contains: title as string,
      };
    }

    if (userId) {
      filterConditions.userId = userId;
    }

    if (date) {
      const timestamp = Number(date);
      if (!isNaN(timestamp)) {
        const parsedDate = new Date(timestamp * 1000); // Преобразование UNIX timestamp в миллисекунды
        const startOfDay = new Date(parsedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(parsedDate);
        endOfDay.setHours(23, 59, 59, 999);

        filterConditions.createdAt = {
          gte: startOfDay,
          lte: endOfDay,
        };
      } else {
        throw new Error("Invalid timestamp format");
      }
    }

    const [news, total] = await prisma.$transaction([
      prisma.news.findMany({
        where: filterConditions,
        skip: offset,
        take: parsedLimit,
        orderBy: {
          updatedAt: order === "asc" ? "asc" : "desc", // Сортировка по времени обновления
        },
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
      prisma.news.count({
        where: filterConditions,
      }),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);

    return c.json({
      data: news,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        total,
        limit: parsedLimit,
      },
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