import { pendingOrders, type Order } from "./states";
import { prisma } from "@repo/db/client";

interface CheckOrdersParams {
  symbol: string;
  price: number;
}

/**
 * creates a order by pushing it to in memory array of of object => pendingOrders
 */
export const createOrder = async (order: Order, id: string) => {
  console.log("id", id);
  const {
    userId,
    asset,
    leverage,
    margin,
    type,
    openingPrice = 200,
    quantity,
  } = order;
  console.log("orderid", id);
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new Error("User not found");

    const exposure = openingPrice * quantity * leverage!;
    order.exposure = exposure;
    console.log("User balance before:", user.balance);

    if (user.balance <= openingPrice) {
      console.log("insuffient balance");
      return;
    }
    const newBalance = user.balance - openingPrice;
    console.log("new balance", newBalance);
    console.log("new balance", Number(newBalance));

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        balance: newBalance,
      },
    });

    const defaultStopLoss =
      order.type == "long" ? openingPrice * 0.98 : openingPrice * 1.02;
    order.stopLoss = defaultStopLoss;
    pendingOrders.push({ id, data: order });

    console.log("pending order", pendingOrders);

    return { success: true, order };
  } catch (error) {
    console.log("Error creating order", error);
    throw error;
  }
};




/**closes the order if  */
export const autoClose = async ({ symbol, price }: CheckOrdersParams) => {
  for (const orders of pendingOrders) {
    const { id: orderId, data: order } = orders;

    if (order.asset.toLocaleLowerCase() != symbol.toLocaleLowerCase()) continue;

    if (
      (order.type == "long" &&
        order.stopLoss !== undefined &&
        price <= order.stopLoss) ||
      (order.type == "short" &&
        order.stopLoss !== undefined &&
        price >= order.stopLoss)
    ) {
      await close({ orderId, closingPrice: price })
        .then((result) => console.log("order closed sucessfully",result))
        .catch((err) => console.log("Error closing order", err));
    }
  }
};

/**close order*/
export const closeOrder = async ({
  orderId,
  closingPrice,
}: {
  orderId: string;
  closingPrice: number;
}) => {
  const order = pendingOrders.find((o) => o.id === orderId);
  console.log("orderId", order);
  if (!order) {
    return {
      status: 404,
      message: "order not found",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: order?.data.userId,
    },
  });
  if (!user) {
    return {
      status: 404,
      message: "order not found",
    };
  }

  const pnl = calclualtePnl(order.data, Number(closingPrice));

  await prisma.user.update({
    where: {
      id: order.data.userId,
    },
    data: {
      balance: user.balance + pnl!,
    },
  });

  //finds the order index from the pendingOrders array
  const index = pendingOrders.findIndex((o) => o.id === orderId);
  //remove one element
  if (index > -1) {
    pendingOrders.splice(index, 1);
  }
};

function calclualtePnl(order: Order, closingPrice: number) {
  if (order.type == "long") {
    return (
      (closingPrice - order.openingPrice) * order.quantity * order.leverage!
    );
  } else {
    (order.openingPrice - closingPrice) * order.quantity * order.leverage!;
  }
}
