import { pendingOrders, type Order } from "./states";
import { prisma } from "@repo/db/client";
import { callbackRedis as redis } from "../redis/index";

export interface CheckOrdersParams {
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

    const exposure = openingPrice * quantity;
    order.exposure = exposure;

    const requiredMargin = exposure / leverage!;
    if (user.balance < requiredMargin) {
      console.log("Insufficient balance");
      return { success: false, message: "Insufficient balance" };
    }

    const newBalance = user.balance - requiredMargin;

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
 * Closes an order and updates user balance
 */

export const closeOrder = async ({
  orderId,
  closingPrice,
  uid,
}: {
  orderId: string;
  closingPrice: number;
  uid?: string;
}) => {
  const orderEntry = pendingOrders.find((o) => o.data.orderId === orderId);

  if (!orderEntry) {
    return { status: 404, message: "Order not found" };
  }

  const user = await prisma.user.findUnique({
    where: { id: orderEntry.data.userId },
  });

  if (!user) return { status: 404, message: "User not found" };

  const pnl = calculatePnl(orderEntry.data, closingPrice);

  try {
    await prisma.user.update({
      where: { id: orderEntry.data.userId },
      data: { balance: user.balance + pnl },
    });
    console.log("User balance updated successfully");
  } catch (error) {
    console.error("Error updating user balance:", error);
    return { status: 500, message: "Database update failed" };
  }

  const index = pendingOrders.findIndex((o) => o.data.orderId === orderId);

  const payload = {
    closingPrice,
    pnl,
    ...orderEntry.data,
  };
  if (index > -1) {
    pendingOrders.splice(index, 1);
    redis.xadd(
      "callback-queue",
      "*",
      "uid",
      uid!,
      "data",
      JSON.stringify(payload)
    );
  } else {
    console.log("Order not found in pendingOrders for removal");
    console.log(pendingOrders.map((o) => o.data.orderId));
  }

  return { status: 200, message: "Order closed successfully", pnl };
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
