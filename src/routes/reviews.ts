import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import getUserInfo from "../utils/auth/getUserInfo";
import prisma from "../db/prisma";

const app = new Hono();

app.get("/", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);
  const { limit = 10, offset = 0, page = 1 } = c.req.query();

  try {

    const totalReviews = await prisma.review.count({
      where: {
        userId: id
      }
    });

    const totalPages = Math.ceil(totalReviews / Number(limit));

    const reviews = await prisma.review.findMany({
      where: {
        userId: id
      },
      skip: Number(offset),
      take: Number(limit),
      include: {
        product: {
          select: {
            id: true,
            name: true,
            image: true,
            price: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return c.json({
      data: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        user_id: review.userId,
        comment: review.comment,
        created_at: review.createdAt,
        first_name: review.user.firstName,
        last_name: review.user.lastName,
        product_id: review.product.id,
        product_name: review.product.name,
        product_image: review.product.image,
        product_price: review.product.price
      })),
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalReviews,
        limit: Number(limit)
      }
    });
  } catch (error: any) {
    console.error("Error fetching reviews:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/:productId", async (c: Context) => {
  const productId = c.req.param("productId");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  try {

    const totalReviews = await prisma.review.count({
      where: {
        productId: productId
      }
    });

    const totalPages = Math.ceil(totalReviews / limit);

    const reviews = await prisma.review.findMany({
      where: {
        productId: productId
      },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return c.json({
      data: reviews.map((review) => ({
        id: review.id,
        product_id: review.productId,
        rating: review.rating,
        comment: review.comment,
        user_id: review.userId,
        created_at: review.createdAt,
        first_name: review.user.firstName,
        last_name: review.user.lastName
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews,
        limit
      }
    });
  } catch (error: any) {
    console.error("Error fetching reviews:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.post("/", authMiddleware, async (c: Context) => {
  const reviewBody = await c.req.json();
  const { id } = getUserInfo(c);

  if (!reviewBody || !reviewBody.productId || !reviewBody.rating || !reviewBody.comment) {
    return c.json({ message: "Invalid review data" }, 400);
  }

  try {

    await prisma.review.create({
      data: {
        productId: reviewBody.productId,
        userId: id,
        rating: reviewBody.rating,
        comment: reviewBody.comment
      }
    });

    let avarateRating = await prisma.review.aggregate({
      _avg: {
        rating: true
      },
      where: {
        productId: reviewBody.productId
      }
    })

    await prisma.product.update({
      where: {
        id: reviewBody.productId
      },
      data: {
        rating: avarateRating._avg.rating
      }
    })

    return c.json({ message: "Review created successfully" });
  } catch (error: any) {
    console.error("Error creating review:", error);
    return c.json({ message: error.message }, 500);
  }
});

// app.patch("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {
//   const reviewBody = await c.req.json();
//   const id = c.req.param("id");
//
//   if (!reviewBody || !reviewBody.rating || !reviewBody.comment) {
//     return c.json({ message: "Invalid review data" }, 400);
//   }
//
//   try {
//     const q = await pool.query<IReview[]>(`SELECT *
//                                            FROM reviews
//                                            WHERE id = $1`, [id]);
//     if (q.rows.length === 0) {
//       return c.json({ message: "Review not found" }, 404);
//     }
//
//     await pool.query(`UPDATE reviews
//                       SET rating  = $1,
//                           comment = $2
//                       WHERE id = $3`,
//       [reviewBody.rating, reviewBody.comment, id]);
//     return c.json({ message: "Review updated successfully" });
//   } catch (error: any | PostgresError) {
//     const { status, message } = handleSQLError(error as PostgresError);
//     return c.json({ message }, status);
//   }
// });

app.delete("/:id", authMiddleware, async (c: Context) => {

  const { id } = c.req.param();
  const userInfo = getUserInfo(c);

  if (!id) {
    return c.json({ message: "Review id not provided" }, 400);
  }

  try {

    const review = await prisma.review.findUnique({
      where: { id }
    });

    const product = await prisma.product.findUnique({
      where: { id: review.productId }
    });

    if (!review) {
      return c.json({ message: "Review not found" }, 404);
    }

    if (review.userId !== userInfo.id) {
      return c.json({ message: "You are not allowed to delete this review" }, 401);
    }

    await prisma.review.delete({
      where: { id }
    });

    return c.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});


export default app;