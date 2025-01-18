import { Context, Hono } from "hono";
import prisma from "../../db/prisma";
import authMiddleware from "../../middleware/auth";
import checkRole from "../../middleware/role";
import dayjs from "dayjs";

const app = new Hono();

app.get("/customers", authMiddleware, checkRole("admin"), async (c: Context) => {
  try {

    const customers = await prisma.user.findMany({
      where: {
        roleId: 1 //customer
      },
      include: {
        Order: true
      }
    });

    const totalCustomers = customers.length;

    const newCustomers = customers.filter(
      (customer) => customer.Order.length === 1
    );
    const returningCustomers = customers.filter(
      (customer) => customer.Order.length > 1
    );

    const newCustomersPercentage =
      totalCustomers > 0 ? (newCustomers.length / totalCustomers) * 100 : 0;
    const returningCustomersPercentage =
      totalCustomers > 0 ? (returningCustomers.length / totalCustomers) * 100 : 0;

    const totalSpent = customers.reduce((sum, customer) => {
      const customerSpent = customer.Order.reduce(
        (orderSum, order) => orderSum + +order.totalAmount,
        0
      );
      return sum + customerSpent;
    }, 0);
    const averageSpentPerCustomer = totalCustomers > 0 ? totalSpent / totalCustomers : 0;

    const repeatPurchaseRate =
      totalCustomers > 0
        ? (returningCustomers.length / totalCustomers) * 100
        : 0;

    const highActivityCustomers = customers
      .map((customer) => {
        const totalSpentByCustomer = customer.Order.reduce(
          (sum, order) => sum + +order.totalAmount,
          0
        );
        return {
          id: customer.id,
          name: `${customer.firstName} ${customer.lastName}`,
          totalSpent: totalSpentByCustomer,
          image: customer.image,
          totalOrders: customer.Order.length
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent || b.totalOrders - a.totalOrders)
      .slice(0, 5);

    return c.json({
      totalCustomers,
      customerSegments: {
        newCustomersPercentage: newCustomersPercentage.toFixed(2),
        returningCustomersPercentage: returningCustomersPercentage.toFixed(2)
      },
      averageSpentPerCustomer: averageSpentPerCustomer.toFixed(2),
      repeatPurchaseRate: repeatPurchaseRate.toFixed(2),
      highActivityCustomers
    });
  } catch (error: any) {
    console.error(error);
    return c.json({ message: error.message }, 500);
  }
});

app.get("/products", authMiddleware, checkRole("admin"), async (c) => {
  try {

    const interval = c.req.query("interval") || "month"; // options: day, week, month, year, custom
    const customStartTimestamp = c.req.query("startDate");
    const customEndTimestamp = c.req.query("endDate");

    let startDate: Date;
    let endDate: Date;

    if (interval === "custom") {
      if (!customStartTimestamp || !customEndTimestamp) {
        return c.json({ error: "startDate and endDate are required for custom interval" }, 400);
      }
      startDate = new Date(Number(customStartTimestamp) * 1000);
      endDate = new Date(Number(customEndTimestamp) * 1000);
    } else {
      switch (interval) {
        case "day":
          startDate = dayjs().startOf("day").toDate();
          endDate = dayjs().endOf("day").toDate();
          break;
        case "week":
          startDate = dayjs().startOf("week").toDate();
          endDate = dayjs().endOf("week").toDate();
          break;
        case "year":
          startDate = dayjs().startOf("year").toDate();
          endDate = dayjs().endOf("year").toDate();
          break;
        case "month":
        default:
          startDate = dayjs().startOf("month").toDate();
          endDate = dayjs().endOf("month").toDate();
          break;
      }
    }

    console.log(`Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    if (!orders || orders.length === 0) {
      return c.json({
        interval,
        startDate,
        endDate,
        totalRevenue: 0,
        totalSales: 0,
        revenueChange: "0.00%",
        salesChange: "0.00%",
        topProducts: [],
        productAnalytics: []
      });
    }

    const productMap: Record<string, { name: string; image: string; totalRevenue: number; totalSold: number }> = {};

    orders.forEach((order) => {
      order.orderItems.forEach((item) => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = {
            name: item.product.name,
            image: item.product.image || "",
            totalRevenue: 0,
            totalSold: 0
          };
        }
        productMap[item.productId].totalRevenue += Number(item.price) * item.quantity;
        productMap[item.productId].totalSold += item.quantity;
      });
    });

    const productAnalytics = Object.values(productMap).sort((a, b) => b.totalSold - a.totalSold);

    const totalRevenue = productAnalytics.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalSales = productAnalytics.reduce((sum, p) => sum + p.totalSold, 0);

    const previousStartDate = dayjs(startDate).subtract(1, interval as dayjs.ManipulateType).toDate();
    const previousEndDate = dayjs(endDate).subtract(1, interval as dayjs.ManipulateType).toDate();

    const previousOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: previousStartDate,
          lte: previousEndDate
        }
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    const previousProductMap: Record<string, { totalRevenue: number; totalSold: number }> = {};

    previousOrders.forEach((order) => {
      order.orderItems.forEach((item) => {
        if (!previousProductMap[item.productId]) {
          previousProductMap[item.productId] = {
            totalRevenue: 0,
            totalSold: 0
          };
        }
        previousProductMap[item.productId].totalRevenue += Number(item.price) * item.quantity;
        previousProductMap[item.productId].totalSold += item.quantity;
      });
    });

    const previousTotalRevenue = Object.values(previousProductMap).reduce((sum, p) => sum + p.totalRevenue, 0);
    const previousTotalSales = Object.values(previousProductMap).reduce((sum, p) => sum + p.totalSold, 0);

    let revenueChange: number;
    if (previousTotalRevenue === 0) {
      revenueChange = totalRevenue > 0 ? 100 : 0;
    } else {
      revenueChange = ((totalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100;
    }

    let salesChange: number;
    if (previousTotalSales === 0) {
      salesChange = totalSales > 0 ? 100 : 0;
    } else {
      salesChange = ((totalSales - previousTotalSales) / previousTotalSales) * 100;
    }

    const formattedRevenueChange = revenueChange.toFixed(2);
    const formattedSalesChange = salesChange.toFixed(2);

    return c.json({
      interval,
      startDate,
      endDate,
      totalRevenue: totalRevenue.toFixed(2),
      totalSales,
      revenueChange: `${formattedRevenueChange}%`,
      salesChange: `${formattedSalesChange}%`,
      topProducts: productAnalytics.slice(0, 5),
      productAnalytics
    });
  } catch (error: any) {
    console.error(error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/orders", authMiddleware, checkRole("admin"), async (c) => {
  try {
    const interval = c.req.query("interval") || "month"; // options: day, week, month, year, custom
    const customStartTimestamp = c.req.query("startDate");
    const customEndTimestamp = c.req.query("endDate");

    let startDate: Date;
    let endDate: Date;

    if (interval === "custom") {
      if (!customStartTimestamp || !customEndTimestamp) {
        return c.json({ error: "startDate and endDate are required for custom interval" }, 400);
      }
      startDate = new Date(Number(customStartTimestamp) * 1000);
      endDate = new Date(Number(customEndTimestamp) * 1000);
    } else {
      switch (interval) {
        case "day":
          startDate = dayjs().startOf("day").toDate();
          endDate = dayjs().endOf("day").toDate();
          break;
        case "week":
          startDate = dayjs().startOf("week").toDate();
          endDate = dayjs().endOf("week").toDate();
          break;
        case "year":
          startDate = dayjs().startOf("year").toDate();
          endDate = dayjs().endOf("year").toDate();
          break;
        case "month":
        default:
          startDate = dayjs().startOf("month").toDate();
          endDate = dayjs().endOf("month").toDate();
          break;
      }
    }

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        },
        payments: true,
        user: true,
        UserAddress: true
      }
    });

    const totalRevenue = orders.reduce((sum, order) => sum + +order.totalAmount, 0);

    const averageCheckout = orders.length > 0
      ? orders.reduce((sum, order) => sum + +order.totalAmount, 0) / orders.length
      : 0;

    const popularCategories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    const formatedPopularCategories = popularCategories.map((category) => {
      return {
        name: category.name,
        count: category._count.products
      };
    });

    const popularPaymentMethods = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        payments: true
      }
    });

    const paymentMethodsCount = popularPaymentMethods.reduce((acc: { [key: string]: number }, order) => {
      acc[order.payments[0]?.paymentMethod] = (acc[order.payments[0]?.paymentMethod] || 0) + 1;
      return acc;
    }, {});

    const sortedPaymentMethods = Object.entries(paymentMethodsCount)
      .map(([method, count]) => ({ paymentMethod: method, count }))
      .sort((a, b) => b.count - a.count);

    const popularDeliveryCountries = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        UserAddress: {
          select: {
            country: true
          }
        }
      }
    });

    const deliveryCountriesCount = popularDeliveryCountries.reduce((acc: { [key: string]: number }, order) => {
      const country = order.UserAddress.country;
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    const sortedDeliveryCountries = Object.entries(deliveryCountriesCount)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);


    return c.json({
      interval,
      startDate,
      endDate,
      orders,
      totalOrders: orders.length,
      totalRevenue: totalRevenue.toFixed(2),
      averageCheckout: averageCheckout.toFixed(2),
      popularCategories: orders.length > 0 ? formatedPopularCategories : [],
      popularPaymentMethods: sortedPaymentMethods,
      popularDeliveryCountries: sortedDeliveryCountries
    });

  } catch (error: any) {
    console.error(error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;