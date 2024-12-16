import { Context, Hono } from "hono";
import pool from "../db/postgres";
import { IReview } from "../types/IReview";
import authMiddleware from "../middleware/auth";
import checkRole from "../middleware/role";
import getUserInfo from "../utils/auth/getUserInfo";
import PostgresError from "../types/PostgresError";
import handleSQLError from "../utils/handleSQLError";

const app = new Hono();

app.get("/", authMiddleware, async (c: Context) => {

  const { id } = getUserInfo(c);

  const { limit = 10, offset, page = 1 } = c.req.query();

  const totalReviewsResult = await pool.query("SELECT COUNT(*) FROM reviews WHERE user_id = $1", [id]);
  const totalReviews = parseInt(totalReviewsResult.rows[0].count);
  const totalPages = Math.ceil(totalReviews / Number(limit));

  try {
    const result = await pool.query(`
        SELECT reviews.id,
               reviews.rating,
               reviews.user_id,
               reviews.comment,
               reviews.created_at,
               users.first_name,
               users.last_name,
               products.id    AS product_id,
               products.name  AS product_name,
               products.image as product_image,
               products.price
        FROM reviews
                 JOIN users ON reviews.user_id = users.id
                 JOIN products ON reviews.product_id = products.id
        WHERE reviews.user_id = $1
            LIMIT $2
        OFFSET $3
    `, [id, limit, offset]);
    return c.json({
      data: result.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalReviews,
        limit: Number(limit)
      }
    });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }

});

app.get("/:productId", async (c: Context) => {
  const productId = c.req.param("productId");

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  try {
    const q = await pool.query<IReview[]>(`
        SELECT r.id,
               r.product_id,
               r.rating,
               r.comment,
               r.user_id,
               r.created_at,
               u.first_name,
               u.last_name
        FROM reviews r
                 JOIN users u ON r.user_id = u.id
        WHERE r.product_id = $1
            LIMIT $2
        OFFSET $3;`, [productId, limit, offset]);

    const totalReviewsResult = await pool.query(`SELECT COUNT(*)
                                                 FROM reviews
                                                 WHERE product_id = $1`, [productId]);
    const totalReviews = parseInt(totalReviewsResult.rows[0].count);
    const totalPages = Math.ceil(totalReviews / limit);

    return c.json({
      data: q.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews,
        limit
      }
    });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.post("/", authMiddleware, async (c: Context) => {
  const reviewBody = await c.req.json();
  const { id } = getUserInfo(c);

  if (!reviewBody || !reviewBody.product_id || !reviewBody.rating || !reviewBody.comment) {
    return c.json({ message: "Invalid review data" }, 400);
  }

  try {
    await pool.query(
      `INSERT INTO reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)`,
      [reviewBody.product_id, id, reviewBody.rating, reviewBody.comment]);
    return c.json({ message: "Review created successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.patch("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {
  const reviewBody = await c.req.json();
  const id = c.req.param("id");

  if (!reviewBody || !reviewBody.rating || !reviewBody.comment) {
    return c.json({ message: "Invalid review data" }, 400);
  }

  try {
    const q = await pool.query<IReview[]>(`SELECT *
                                           FROM reviews
                                           WHERE id = $1`, [id]);
    if (q.rows.length === 0) {
      return c.json({ message: "Review not found" }, 404);
    }

    await pool.query(`UPDATE reviews
                      SET rating = $1,
                          comment = $2
                      WHERE id = $3`,
      [reviewBody.rating, reviewBody.comment, id]);
    return c.json({ message: "Review updated successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});

app.delete("/:id", authMiddleware, async (c: Context) => {
  const id = c.req.param("id");
  const userInfo = getUserInfo(c);

  if (!id) {
    return c.json({ message: "Review id not provided" }, 400);
  }

  try {
    const q = await pool.query<IReview[]>(`SELECT *
                                           from reviews
                                           where id = $1`, [id]);
    if (q.rows.length === 0) {
      return c.json({ message: "Review not found" }, 404);
    }

    //@ts-ignore
    if (q.rows[0].user_id !== userInfo.id) {
      return c.json({ message: "You are not allowed to delete this review" }, 401);
    }

    await pool.query(`DELETE
                      FROM reviews
                      WHERE id = $1`, [id]);
    return c.json({ message: "Review deleted successfully" });
  } catch (error: any | PostgresError) {
    const { status, message } = handleSQLError(error as PostgresError);
    return c.json({ message }, status);
  }
});


export default app;