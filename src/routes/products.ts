import { Context, Hono } from "hono";
import pool from "../db/postgres";
import { IProduct, IProductWithCategory } from "../types/IProduct";
import authMiddleware from "../middleware/auth";
import checkRole from "../middleware/role";

const app = new Hono();

app.get("/search", async (c: Context) => {
  const { category_id, name, limit = 10, page = 1 } = c.req.query();

  const offset = (Number(page) - 1) * Number(limit);

  let query = `
        SELECT products.id, products.name, products.price, products.discount, products.old_price, products.rating, products.image_url, categories.name as category
        FROM products
        JOIN categories ON products.category_id = categories.id
        WHERE 1 = 1`;

  const queryParams: (string | number)[] = [];

  if (category_id) {
    query += ` AND products.category_id = $${queryParams.length + 1}`;
    queryParams.push(category_id);
  }

  if (name) {
    query += ` AND products.name LIKE $${queryParams.length + 1}`;
    queryParams.push(`%${name}%`);
  }

  query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
  queryParams.push(Number(limit), offset);

  try {
    const q = await pool.query<IProductWithCategory[]>(query, queryParams);

    if (q.rows.length === 0) {
      return c.json({ message: "No products found" }, 404);
    }

    return c.json(q.rows);

  } catch (error) {
    return c.json({ message: (error as Error).message });
  }
});

app.get("/", async (c: Context) => {
  try {
    let q = await pool.query<IProductWithCategory[]>(`
            SELECT products.id, products.name, products.price, products.discount, products.old_price, products.rating, products.image_url, categories.name as category
            from products
            join categories on products.category_id = categories.id`);

    if (q.rows.length === 0) {
      return c.json({ message: "No products found" });
    }

    return c.json(q.rows);
  } catch (error) {
    return c.json({ message: (error as Error).message });
  }
});

app.get("/:id", async (c: Context) => {
  const { id } = c.req.param();

  if (!id) {
    return c.json({ message: "Product id not provided" }, 400);
  }

  try {
    let q = await pool.query<IProductWithCategory[]>(`
            SELECT products.id, products.name, products.price, products.discount, products.old_price, products.rating, products.image_url, categories.name as category
            from products
            join categories on products.category_id = categories.id
            where products.id = $1`, [id]);

    if (q.rows.length === 0) {
      return c.json({ message: "Product not found" }, 404);
    }

    return c.json(q.rows[0]);
  } catch (error) {
    return c.json({ message: (error as Error).message }, 500);
  }
});

app.post("/", authMiddleware, checkRole("admin"), async (c: Context) => {
  const productBody = await c.req.json();

  if (!productBody) {
    return c.json({ message: "Product not provided" }, 400);
  }

  try {
    await pool.query<IProduct>("INSERT INTO products (name, description, price, image_url, category_id, stock, is_active, discount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [
      productBody.name,
      productBody.description,
      productBody.price,
      productBody.image_url,
      productBody.category_id,
      productBody.stock,
      productBody.is_active,
      productBody.discount
    ]);

    return c.json({ message: "Product created successfully" });

  } catch (error) {
    return c.json({ message: (error as Error).message }, 500);
  }
});

app.patch("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {
  const { id } = c.req.param();
  const productBody = await c.req.json();

  if (!productBody) {
    return c.json({ message: "Product not provided" }, 400);
  }

  if (!id) {
    return c.json({ message: "Product id not provided" }, 400);
  }

  try {

    let q = await pool.query<IProduct>("SELECT * FROM products WHERE id = $1", [id]);
    if (q.rows.length === 0) {
      return c.json({ message: "Product not found" }, 404);
    }

    await pool.query("UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, category_id = $5, stock = $6, is_active = $7, discount = $8 WHERE id = $9", [
      productBody.name,
      productBody.description,
      productBody.price,
      productBody.image_url,
      productBody.category_id,
      productBody.stock,
      productBody.is_active,
      productBody.discount,
      id
    ]);
    return c.json({ message: "Product updated successfully" });
  } catch (error) {
    return c.json({ message: (error as Error).message }, 500);
  }
});

app.delete("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {
  const { id } = c.req.param();

  if (!id) {
    return c.json({ message: "Product id not provided" }, 400);
  }

  try {
    await pool.query("DELETE FROM products WHERE id = $1", [id]);
    return c.json({ message: "Product deleted successfully" });
  } catch (error) {
    return c.json({ message: (error as Error).message }, 500);
  }
});


export default app;