import { Context, Hono } from "hono";
import authMiddleware from "../middleware/auth";
import getUserInfo from "../utils/auth/getUserInfo";
import { z } from 'zod';
import prisma from "../db/prisma";
import { OrderStatus } from "@prisma/client";


const app = new Hono();

app.get("/", authMiddleware, async (c: Context) => {
  const { id } = getUserInfo(c);

  const { limit = 10, page = 1 } = c.req.query();

  const parsedLimit = Number(limit);
  const parsedPage = Number(page);
  const offset = (parsedPage - 1) * parsedLimit;

  try {
    const total = await prisma.order.count({
      where: { userId: id },
    });
    const totalPages = Math.ceil(total / parsedLimit);

    const orders = await prisma.order.findMany({
      where: { userId: id },
      skip: offset,
      take: parsedLimit,
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        orderItems: {
          select: {
            productId: true,
            quantity: true,
            price: true,
            product: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return c.json({
      data: orders,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        total,
        limit: parsedLimit,
      },
    });
  } catch (error: any) {
    return c.json({ message: error.message || "An unexpected error occurred" }, 500);
  }
});

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().positive(),
    quantity: z.number().positive(),
    price: z.number().nonnegative(),
  })),
  totalAmount: z.number().positive(),
  address: z.object({
    address_line1: z.string(),
    address_line2: z.string(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string(),
  }),
  payment: z.object({
    amount: z.number().positive(),
    paymentMethod: z.string(),
  }).optional(), // Payment is optional
});

app.post('/', async (c) => {
  const { id } = getUserInfo(c);

  try {
    const { items, totalAmount, address, payment } = orderSchema.parse(await c.req.json());

    const order = await prisma.$transaction(async (prisma) => {

      const order = await prisma.order.create({
        data: {
          userId: id,
          totalAmount,
          status: 'pending',
        },
      });

      await prisma.orderItem.createMany({
        data: items.map(item => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      await prisma.shippingAddress.create({
        data: {
          userId: id,
          orderId: order.id,
          addressLine1: address.address_line1,
          addressLine2: address.address_line2,
          city: address.city,
          state: address.state,
          zipCode: address.postal_code,
          country: address.country,
        },
      });

      if (payment) {
        if (payment.amount !== totalAmount) {
          throw new Error('Payment amount does not match order total');
        }

        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentStatus: 'completed',
          },
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'paid' },
        });
      }

      return order;
    });

    return c.json({ message: 'Order created successfully', orderId: order.id });
  } catch (error:any) {
    console.error('Order creation failed:', error);
    return c.json({ error: error.message }, 500);
  }
});


app.patch("/:id", authMiddleware, async (c: Context) => {
  const { id } = c.req.param();

  try {

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.shipped },
    });

    return c.json({ message: "Order status updated successfully", orderId: updatedOrder.id });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    return c.json({ message: error.message}, 500);
  }
});

export default app;