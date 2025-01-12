import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import checkRole from "../middleware/role";
import prisma from "../db/prisma";
import s3 from "../db/s3";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";

const app = new Hono();

app.get("/search", async (c: Context) => {
  const { categoryId, name, limit = 10, page = 1 } = c.req.query();
  const parsedLimit = Number(limit);
  const parsedPage = Number(page);
  const offset = (parsedPage - 1) * parsedLimit;

  try {

    const whereCondition: any = {
      name: name ? { contains: name, mode: "insensitive" } : undefined
    };

    if (categoryId !== "0" && categoryId) {
      whereCondition.categoryId = Number(categoryId);
    }

    const total = await prisma.product.count({
      where: whereCondition
    });

    const totalPages = Math.ceil(total / parsedLimit);

    const products = await prisma.product.findMany({
      where: whereCondition,
      skip: offset,
      take: parsedLimit,
      include: {
        category: {
          select: {
            name: true
          }
        }
      }
    });

    if (products.length === 0) {
      return c.json({ message: "No products found" }, 404);
    }

    return c.json({
      data: products.map(product => {
        const oldPrice = Number(product.price);
        const discount = Number(product.discount);
        const price = discount
          ? oldPrice - (oldPrice * discount) / 100
          : oldPrice;

        const result: any = {
          id: product.id,
          name: product.name,
          price: price.toFixed(2),
          discount,
          rating: product.rating,
          image: product.image,
          category: product.category.name
        };

        if (discount > 0) {
          result.oldPrice = oldPrice.toFixed(2);
        }

        return result;
      }),
      pagination: {
        currentPage: parsedPage,
        totalPages,
        total,
        limit: parsedLimit
      }
    });

  } catch (error: any) {
    console.error("Error fetching products:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/categories", async (c: Context) => {
  try {
    const categories = await prisma.category.findMany();
    return c.json(categories);
  } catch (error: any) {
    return c.json({ message: error.message });
  }
});

app.get("/", async (c: Context) => {
  try {
    const page = Number(c.req.query("page") || 1);
    const limit = Number(c.req.query("limit") || 10);
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: limit,
        include: {
          category: {
            select: { name: true }
          },
          reviews: {
            select: { rating: true }
          }
        }
      }),
      prisma.product.count()
    ]);

    const totalPages = Math.ceil(total / limit);

    const productData = products.map((product) => {
      const oldPrice = Number(product.price);
      const discount = Number(product.discount);
      const price = discount
        ? oldPrice - (oldPrice * discount) / 100
        : oldPrice;

      const totalReviews = product.reviews.length;
      const averageRating =
        totalReviews > 0
          ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
          : 0;

      return {
        id: product.id,
        name: product.name,
        oldPrice: discount > 0 ? oldPrice.toFixed(2) : null,
        price: price.toFixed(2),
        discount,
        image: product.image,
        category: product.category?.name,
        rating: parseFloat(averageRating.toFixed(1))
      };
    });

    return c.json({
      data: productData,
      pagination: {
        currentPage: page,
        totalPages,
        total,
        limit
      }
    });
  } catch (error: any) {
    return c.json({ message: error.message }, 500);
  }
});

app.get("/:id", async (c: Context) => {
  const { id } = c.req.param();

  if (!id) {
    return c.json({ message: "Product id not provided" }, 400);
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!product) {
      return c.json({ message: "Product not found" }, 404);
    }

    const oldPrice = Number(product.price);
    const discount = Number(product.discount);
    const price = discount
      ? oldPrice - (oldPrice * discount) / 100
      : oldPrice;

    return c.json({
      id: product.id,
      name: product.name,
      oldPrice: discount > 0 ? oldPrice.toFixed(2) : null,
      price: price.toFixed(2),
      discount: Number(product.discount),
      rating: product.rating,
      image: product.image,
      description: product.description,
      stock: product.stock,
      category_name: product.category.name,
      categoryId: product.category.id
    });
  } catch (error: any) {
    console.error("Error fetching product:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.post("/", authMiddleware, checkRole("admin"), async (c) => {
  try {
    const formData = await c.req.formData();

    const name = formData.get("name")?.toString();
    const description = formData.get("description")?.toString() || "";
    const price = Number(formData.get("price"));
    const stock = Number(formData.get("stock")) || 0;
    const categoryId = Number(formData.get("categoryId"));
    const discount = Number(formData.get("discount")) || 0;
    const imageFile = formData.get("image") as File | null;

    if (!name || isNaN(price) || isNaN(categoryId) || !imageFile) {
      return c.json({ error: "Fields 'name', 'price', 'categoryId', and 'image' are required." }, 400);
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const imageKey = `products/${nanoid()}-${imageFile.name}`;
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: imageKey,
      Body: buffer,
      ContentType: imageFile.type
    };

    await s3.send(new PutObjectCommand(uploadParams));
    const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${imageKey}`;

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price,
        stock,
        categoryId,
        discount,
        image: imageUrl
      }
    });

    return c.json(newProduct, 201);
  } catch (error: any) {
    console.error("Error creating product:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.put("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {
  const { id } = c.req.param();
  const formData = await c.req.formData();

  if (!id) {
    return c.json({ message: "Product id not provided" }, 400);
  }

  const name = formData.get("name")?.toString();
  const description = formData.get("description")?.toString();
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock") || 0);
  const categoryId = Number(formData.get("categoryId"));
  const discount = Number(formData.get("discount") || 0);
  const imageFile = formData.get("image");

  if (!name || isNaN(price) || isNaN(categoryId)) {
    return c.json({ message: "Name, price, and categoryId are required" }, 400);
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: id },
      select: { image: true }
    });

    if (!product) {
      return c.json({ message: "Product not found" }, 404);
    }

    let imageUrl = product.image;

    if (imageFile instanceof File) {
      if (imageUrl) {
        const imageKey = imageUrl.split("/").slice(-1)[0];
        const deleteParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: `products/${imageKey}`
        };

        try {
          await s3.send(new DeleteObjectCommand(deleteParams));
        } catch (s3Error) {
          console.error("Failed to delete old image from S3:", s3Error);
          return c.json({ message: "Error deleting old image from S3" }, 500);
        }
      }

      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const imageKey = `products/${nanoid()}-${imageFile.name}`;
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: imageKey,
        Body: buffer,
        ContentType: imageFile.type
      };

      try {
        await s3.send(new PutObjectCommand(uploadParams));
        imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${uploadParams.Key}`;
      } catch (s3Error) {
        console.error("Failed to upload new image to S3:", s3Error);
        return c.json({ message: "Error uploading new image to S3" }, 500);
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: id },
      data: {
        name,
        description,
        price,
        stock,
        categoryId,
        discount,
        image: imageUrl
      }
    });

    return c.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    return c.json({ message: (error as Error).message }, 500);
  }
});


app.delete("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {
  const { id } = c.req.param();

  if (!id) {
    return c.json({ message: "Product id not provided" }, 400);
  }

  try {

    const product = await prisma.product.findUnique({
      where: { id: id },
      select: { image: true }
    });

    if (!product) {
      return c.json({ message: "Product not found" }, 404);
    }

    const imageUrl = product.image;

    if (imageUrl) {
      const imageKey = imageUrl.split("/").slice(-1)[0];
      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `products/${imageKey}`
      };

      try {
        await s3.send(new DeleteObjectCommand(deleteParams));
      } catch (s3Error) {
        console.error("Failed to delete image from S3:", s3Error);
        return c.json({ message: "Error deleting image from S3" }, 500);
      }
    }

    await prisma.product.delete({
      where: { id: id }
    });

    return c.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return c.json({ message: (error as Error).message }, 500);
  }
});

export default app;