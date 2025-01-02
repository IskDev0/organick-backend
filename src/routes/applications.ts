import { Context, Hono } from "hono";
import { z } from "zod";
import { validator } from "hono/validator";
import prisma from "../db/prisma";
import checkRole from "../middleware/role";
import authMiddleware from "../middleware/auth";
import { ApplicationStatus } from "@prisma/client";

const app = new Hono();

app.get("/", authMiddleware, checkRole("admin"), async (c: Context) => {
  try {
    const { limit = 10, page = 1, search = "", status, startDate, endDate } = c.req.query();
    const parsedLimit = Number(limit);
    const parsedPage = Number(page);
    const offset = (parsedPage - 1) * parsedLimit;

    const filters: any = {};

    if (search) {
      filters.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } }
      ];
    }

    if (status && status !== "all") {
      filters.status = status;
    }

    if (startDate || endDate) {
      filters.createdAt = {
        gte: startDate ? new Date(Number(startDate) * 1000) : undefined,
        lt: endDate ? new Date(Number(endDate) * 1000 + 86400000) : undefined
      };
    }

    const applications = await prisma.application.findMany({
      where: filters,
      skip: offset,
      take: parsedLimit
    });

    const total = await prisma.application.count({
      where: filters
    });

    return c.json({
      data: applications,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit),
        total,
        limit: parsedLimit
      }
    });
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

app.post(
  "/",
  validator("json", (value, c) => {
    const schema = z.object({
      fullName: z.string(),
      email: z.string().email(),
      subject: z.string(),
      company: z.string(),
      message: z.string()
    });

    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json(parsed.error.issues, 401);
    }
    return parsed.data;
  }),
  async (c: Context) => {
    const { fullName, email, subject, company, message } = await c.req.json();

    try {
      await prisma.application.create({
        data: {
          fullName,
          email,
          subject,
          company,
          message
        }
      });

      return c.json({ message: "Application submitted successfully" });
    } catch (error: any) {
      return c.json({ message: error.message || "An unexpected error occurred" }, 500);
    }
  }
);

app.patch("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {

  const id = c.req.param("id");
  const { status } = await c.req.json();

  if (!status) {
    return c.json({ message: "Status not provided" }, 400);
  }

  console.log(Object.values(ApplicationStatus));
  if (!Object.values(ApplicationStatus).includes(status)) {
    return c.json({ message: "Invalid status" }, 400);
  }

  try {
    const application = await prisma.application.update({
      where: { id },
      data: { status }
    });
    return c.json({ message: "Application status updated successfully", application });
  } catch (error: any) {
    return c.json({ message: error.message }, 500);
  }
});

app.delete("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {

  const id = c.req.param("id");

  try {
    const application = await prisma.application.delete({
      where: { id }
    });
    return c.json({ message: "Application deleted successfully", application });
  } catch (error: any) {
    return c.json({ message: error.message }, 500);
  }
});

export default app;