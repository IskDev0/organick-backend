import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import getUserInfo from "../utils/auth/getUserInfo";
import prisma from "../db/prisma";
import checkRole from "../middleware/role";

const app = new Hono();

app.get("/orders", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);

  const { limit = 10, page = 1 } = c.req.query();
  const parsedLimit = Number(limit);
  const parsedPage = Number(page);
  const offset = (parsedPage - 1) * parsedLimit;

  try {

    const total = await prisma.order.count({
      where: { userId: id }
    });

    const totalPages = Math.ceil(total / parsedLimit);

    const orders = await prisma.order.findMany({
      where: { userId: id },
      skip: offset,
      take: parsedLimit,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        totalAmount: true,
        orderItems: {
          select: {
            quantity: true,
            productId: true,
            price: true,
            product: {
              select: {
                name: true,
                image: true
              }
            }
          }
        },
        UserAddress: {
          select: {
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            zipCode: true,
            country: true
          }
        }
      }
    });

    return c.json({
      data: orders,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        total,
        limit: parsedLimit
      }
    });
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.patch("/password", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);
  const { newPassword } = await c.req.json();

  if (!newPassword) {
    return c.json({ message: "New password is required" }, 400);
  }

  try {

    const newHashedPassword = await Bun.password.hash(newPassword);

    await prisma.user.update({
      where: { id },
      data: { passwordHash: newHashedPassword }
    });

    return c.json({ message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Error updating password:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/address", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);

  try {

    const addresses = await prisma.userAddress.findMany({
      where: { userId: id }
    });

    return c.json(addresses);
  } catch (error: any) {
    console.error("Error fetching addresses:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.post("/address", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);

  const shippingAddress = await c.req.json();

  try {
    await prisma.userAddress.create({
      data: {
        userId: id,
        addressLine1: shippingAddress.address_line1,
        addressLine2: shippingAddress.address_line2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.postal_code,
        country: shippingAddress.country
      }
    });

    return c.json({ message: "Shipping address created successfully" });
  } catch (error: any) {
    console.error("Error adding shipping address:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.put("/address/:id", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);

  const addressId = c.req.param("id");

  const shippingAddress = await c.req.json();

  try {
    await prisma.userAddress.updateMany({
      where: {
        id: addressId,
        userId: id
      },
      data: {
        addressLine1: shippingAddress.address_line1,
        addressLine2: shippingAddress.address_line2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.postal_code,
        country: shippingAddress.country
      }
    });

    return c.json({ message: "Shipping address updated successfully" });
  } catch (error: any) {
    console.error("Error updating shipping address:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.delete("/address/:id", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);

  const addressId = c.req.param("id");

  try {
    await prisma.userAddress.deleteMany({
      where: {
        id: addressId,
        userId: id
      }
    });

    return c.json({ message: "Shipping address deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting shipping address:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/roles", authMiddleware, checkRole("admin"), async (c: Context) => {

  try {
    const roles = await prisma.userRole.findMany();

    return c.json(roles);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/", authMiddleware, checkRole("admin"), async (c: Context) => {
  try {

    const search = c.req.query("search") || "";
    const roleId = Number(c.req.query("roleId")) || null;
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "10", 10);

    const filters: any = {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ]
    };

    if (roleId) {
      filters.roleId = roleId;
    }

    const skip = (page - 1) * limit;

    const users = await prisma.user.findMany({
      where: filters,
      skip,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            name: true
          }
        }
      }
    });

    const totalCount = await prisma.user.count({ where: filters });

    const usersWithRoleName = users.map((user) => ({
      ...user,
      role: user.role?.name
    }));

    return c.json({
      data: usersWithRoleName,
      pagination: {
        total: totalCount,
        currentPage: page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/:id", async (c: Context) => {
  const id = c.req.param("id");

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });

    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    return c.json(user);
  } catch (error: any) {
    return c.json({ message: error.message || "An unexpected error occurred" }, 500);
  }
});

app.put("/", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);

  try {
    const userBody = await c.req.json();

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        firstName: userBody.first_name,
        lastName: userBody.last_name,
        email: userBody.email,
        phone: userBody.phone
      }
    });

    return c.json({ message: "User updated successfully", user: updatedUser });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.patch("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {

  const id = c.req.param("id");
  const { roleId } = await c.req.json();

  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        roleId
      }
    });

    return c.json({ message: "User role updated successfully", user: updatedUser });
  } catch (error: any) {
    console.error("Error updating user role:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.delete("/:id", authMiddleware, checkRole("admin"), async (c: Context) => {

  const id = c.req.param("id");

  try {
    await prisma.user.delete({
      where: { id }
    });

    return c.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return c.json({ message: error.message }, 500);
  }
});

export default app;