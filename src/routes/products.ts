import {Context, Hono} from "hono";
import pool from "../db/postgres";
import {IProduct, IProductWithCategory} from "../types/IProduct";

const app = new Hono()

app.get("/", async (c: Context) => {
    try {
        let q = await pool.query<IProductWithCategory[]>(`
            SELECT products.id, products.name, products.price, products.discount, products.rating, categories.name as category
            from products
            join categories on products.category_id = categories.id`)

        if (q.rows.length === 0) {
            return c.json({message: "No products found"})
        }

        return c.json(q.rows)
    } catch (error) {
        return c.json({message: (error as Error).message})
    }
})

app.post("/", async (c: Context) => {
    const productBody = await c.req.json();

    if (!productBody) {
        return c.json({message: "Product not provided"}, 400);
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
        ])

        return c.json({message: "Product created successfully"})

    } catch (error) {
        return c.json({message: (error as Error).message}, 500);
    }
})

app.patch("/:id", async (c: Context) => {
    const {id} = c.req.param();
    const productBody = await c.req.json();

    if (!productBody) {
        return c.json({message: "Product not provided"}, 400);
    }

    if (!id) {
        return c.json({message: "Product id not provided"}, 400);
    }

    try {

        let q = await pool.query<IProduct>("SELECT * FROM products WHERE id = $1", [id])
        if (q.rows.length === 0) {
            return c.json({message: "Product not found"}, 404);
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
        ])
        return c.json({message: "Product updated successfully"})
    } catch (error) {
        return c.json({message: (error as Error).message}, 500);
    }
})

app.delete("/:id", async (c: Context) => {
    const {id} = c.req.param();

    if (!id) {
        return c.json({message: "Product id not provided"}, 400);
    }

    try {
        await pool.query("DELETE FROM products WHERE id = $1", [id])
        return c.json({message: "Product deleted successfully"})
    } catch (error) {
        return c.json({message: (error as Error).message}, 500);
    }
})

app.get("/search", async (c: Context) => {
    const {category_id, name} = c.req.query();

    try {
        const q = await pool.query<IProductWithCategory[]>(`
                SELECT products.id, products.name, products.price, products.discount, products.rating, categories.name as category
                FROM products
                JOIN categories ON products.category_id = categories.id
                WHERE products.category_id = $1 OR products.name LIKE $2`, [category_id, name]);

        if (q.rows.length === 0) {
            return c.json({message: "No products found"}, 404);
        }

        return c.json(q.rows);

    } catch (error) {
        return c.json({message: (error as Error).message});
    }
});


export default app