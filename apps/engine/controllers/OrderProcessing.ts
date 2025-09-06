import { pendingOrders, type Order } from "./states";
import { prisma } from "@repo/db/client";
import { redis } from "@repo/redis/client";

interface CheckOrdersParams {
  symbol: string;
  price: number;
}

/**
 * Creates an order by pushing it to the in-memory array `pendingOrders`
 */
export const createOrder = async (
  order: Order,
  id: string,
  priceInfo: { price: number; decimal: number; id: string }
) => {
  const { userId, leverage, quantity } = order;
  const openingPrice = priceInfo.price / 10 ** priceInfo.decimal;
  order.openingPrice = openingPrice;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const exposure = openingPrice * quantity * leverage!;
    order.exposure = exposure;

    if (user.balance <= openingPrice) {
      console.log("Insufficient balance");
      return;
    }

    const newBalance = user.balance - openingPrice;
    await prisma.user.update({
      where: { id: user.id },
      data: { balance: newBalance },
    });

    // Set default stop loss
    order.stopLoss =
      order.type === "long" ? openingPrice * 0.98 : openingPrice * 1.02;
    order.processed = true;

    // Add to in-memory pending orders and push to Redis
    pendingOrders.push({ id, data: order });
    redis.xadd(
      "callback-queue",
      "*",
      "uid",
      order.orderId,
      "data",
      JSON.stringify(order)
    );

    console.log("Pending order:", pendingOrders);
    return { success: true, order };
  } catch (error) {
    console.log("Error creating order", error);
    throw error;
  }
};

/**
 * Automatically closes orders if stop loss conditions are met
 */
export const autoClose = async ({ symbol, price }: CheckOrdersParams) => {
  for (const { id: orderId, data: order } of pendingOrders) {
    if (order.asset.toLowerCase() !== symbol.toLowerCase()) continue;

    const shouldClose =
      (order.type === "long" &&
        order.stopLoss !== undefined &&
        price <= order.stopLoss) ||
      (order.type === "short" &&
        order.stopLoss !== undefined &&
        price >= order.stopLoss);

    if (shouldClose) {
      await closeOrder({ orderId, closingPrice: price })
        .then((res) => console.log("Order closed successfully", res))
        .catch((err) => console.log("Error closing order", err));
    }
  }
};

/**
 * Closes an order and updates user balance
 */
export const closeOrder = async ({
  orderId,
  closingPrice,
}: {
  orderId: string;
  closingPrice: number;
}) => {
  const orderEntry = pendingOrders.find((o) => o.id === orderId);
  if (!orderEntry) return { status: 404, message: "Order not found" };

  const user = await prisma.user.findUnique({
    where: { id: orderEntry.data.userId },
  });
  if (!user) return { status: 404, message: "User not found" };

  const pnl = calculatePnl(orderEntry.data, closingPrice);

  await prisma.user.update({
    where: { id: orderEntry.data.userId },
    data: { balance: user.balance + pnl },
  });

  // Remove order from pendingOrders
  const index = pendingOrders.findIndex((o) => o.id === orderId);
  if (index > -1) pendingOrders.splice(index, 1);
};

/**
 * Calculates PnL for an order
 */
function calculatePnl(order: Order, closingPrice: number) {
  if (order.type === "long") {
    return (
      (closingPrice - order.openingPrice) * order.quantity * order.leverage!
    );
  } else {
    return (
      (order.openingPrice - closingPrice) * order.quantity * order.leverage!
    );
  }
}
