import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import getUserInfo from "../utils/auth/getUserInfo";
import { z } from "zod";
import prisma from "../db/prisma";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import convertObjectsToArrays from "../utils/excel/convertObjectsToArrays";
import createExcelFile from "../utils/excel/createExcelFile";


const app = new Hono();

app.get("/", async (c: Context) => {
  const {
    limit = 10,
    page = 1,
    status,
    paymentStatus,
    search,
    startDate,
    endDate,
    minPrice,
    maxPrice
  } = c.req.query();

  const parsedLimit = Number(limit);
  const parsedPage = Number(page);
  const offset = (parsedPage - 1) * parsedLimit;

  try {
    const filters: any = {};

    if (status) {
      filters.status = status;
    }

    if (paymentStatus) {
      filters.payments = {
        some: {
          paymentStatus: paymentStatus
        }
      };
    }

    if (search) {
      filters.user = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } }
        ]
      };
    }

    if (startDate || endDate) {
      filters.createdAt = {
        ...(startDate && { gte: new Date(+startDate * 1000) }),
        ...(endDate && { lte: new Date(+endDate * 1000) })
      };
    }

    if (minPrice || maxPrice) {
      filters.totalAmount = {
        ...(minPrice && { gte: Number(minPrice) }),
        ...(maxPrice && { lte: Number(maxPrice) })
      };
    }

    const total = await prisma.order.count({
      where: filters
    });

    const totalPages = Math.ceil(total / parsedLimit);

    const orders = await prisma.order.findMany({
      where: filters,
      skip: offset,
      take: parsedLimit,
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        orderItems: {
          select: {
            productId: true,
            quantity: true,
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
            id: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            zipCode: true,
            country: true
          }
        },
        payments: {
          take: 1,
          select: {
            paymentMethod: true,
            paymentStatus: true
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
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    price: z.number().nonnegative()
  })),
  totalAmount: z.number().positive(),
  payment: z.object({
    amount: z.number().positive(),
    paymentMethod: z.string()
  })
});

app.post("/", authMiddleware, async (c) => {
  const { id } = getUserInfo(c);

  try {
    const { items, totalAmount, payment } = orderSchema.parse(await c.req.json());
    const { addressId } = await c.req.json();

    const order = await prisma.$transaction(async (prisma) => {

      const order = await prisma.order.create({
        data: {
          userId: id,
          totalAmount,
          addressId
        }
      });

      await prisma.orderItem.createMany({
        data: items.map(item => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        }))
      });

      if (payment) {
        if (payment.amount !== totalAmount) {
          throw new Error("Payment amount does not match order total");
        }

        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentStatus: PaymentStatus.paid
          }
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.pending
          }
        });
      }

      return order;
    });

    return c.json({ message: "Order created successfully", orderId: order.id });
  } catch (error: any) {
    console.error("Order creation failed:", error);
    return c.json({ message: error }, 500);
  }
});

app.patch("/:id", authMiddleware, async (c: Context) => {
  const { id } = c.req.param();

  try {

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.shipped }
    });

    return c.json({ message: "Order status updated successfully", orderId: updatedOrder.id });
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/excel", async (c) => {
  try {

    const {
      limit = 10,
      page = 1,
      status,
      paymentStatus,
      search,
      startDate,
      endDate,
      minPrice,
      maxPrice
    } = c.req.query();

    const filters: any = {};

    if (status) {
      filters.status = status;
    }

    if (paymentStatus) {
      filters.payments = {
        some: {
          paymentStatus
        }
      };
    }

    if (search) {
      filters.user = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } }
        ]
      };
    }

    if (startDate || endDate) {
      filters.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) })
      };
    }

    if (minPrice || maxPrice) {
      filters.totalAmount = {
        ...(minPrice && { gte: Number(minPrice) }),
        ...(maxPrice && { lte: Number(maxPrice) })
      };
    }

    const orders = await prisma.order.findMany({
      where: filters,
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        totalAmount: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
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
            id: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            zipCode: true,
            country: true
          }
        },
        payments: {
          take: 1,
          select: {
            paymentMethod: true,
            paymentStatus: true
          }
        }
      }
    });

    const convertedData = orders.map((order) => ({
      OrderID: order.id,
      OrderDate: order.createdAt,
      CustomerName: `${order.user.firstName} ${order.user.lastName}`,
      Status: order.status,
      TotalAmount: order.totalAmount,
      Email: order.user.email,
      PaymentMethod: order.payments[0]?.paymentMethod || "N/A",
      PaymentStatus: order.payments[0]?.paymentStatus || "N/A",
      ShippingAddress: `${order.UserAddress.addressLine1}, ${order.UserAddress.city}, ${order.UserAddress.country}, ${order.UserAddress.zipCode}`
    }));

    const excelData = convertObjectsToArrays(convertedData);

    const excelBuffer = createExcelFile(excelData, "Orders");

    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    c.header("Content-Disposition", "attachment; filename=\"orders.xlsx\"");

    return c.body(excelBuffer);
  } catch (error) {
    console.error(error);
    return c.json({ message: "Failed to generate Excel file" }, 500);
  }
});

export default app;