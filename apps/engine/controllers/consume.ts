import { orderRedis, priceRedis } from "../redis";
import { latestPrice, pendingOrders, type Order } from "./states";
import {
  closeOrder,
  createOrder,
  type CheckOrdersParams,
} from "./OrderProcessing";
import { da } from "zod/locales";
import { takeSnapshot } from "./snapShots";

const priceStream = "trade-stream";
const orderStream = "trade-order";
const closeOrderStream = "close-order";
/**consume prices from the pooler and  */

async function consumePrices() {
  let lastId = "$";
  while (true) {
    try {
      const res = await priceRedis.xread(
        "COUNT",
        1,
        "BLOCK",
        0,
        "STREAMS",
        priceStream,
        lastId
      );
      // console.log("res", res);
      if (!res || res.length === 0) continue;
      const [streamkey, messages] = res[0] as [string, [string, string[]][]]; //[streamname,[id,data[]][]]

      for (const [id, fields] of messages) {
        const dataidx = fields.findIndex((f) => f === "data");
        if (dataidx == -1) {
          console.log("No data field found in message");
          continue;
        }
        const jsonstr = fields[dataidx + 1];
        if (!jsonstr) continue;

        try {
          const parsedData = JSON.parse(jsonstr);
          // console.log("parsed", parsedData);
          for (const item of parsedData) {
            const { asset, price, decimal } = item;
            latestPrice[asset] = { price, decimal, id };
            await autoClose({ symbol: asset, price });
          }
        } catch (error) {
          console.error("Error parsing price data:", error);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}

async function consumeOrders() {
  let lastId = "$";
  while (1) {
    try {
      const res = await orderRedis.xread(
        "COUNT",
        1,
        "BLOCK",
        0,
        "STREAMS",
        orderStream,
        lastId
      );

      if (!res || res.length === 0) {
        console.log("response is null");

        continue;
      }
      const [streamKey, messages] = res[0] as [string, [string, string[]][]];
      console.log(messages);
      for (const [id, fields] of messages) {
        // console.log(fields);
        const dataidx = fields.findIndex((f) => f === "data");
        console.log(dataidx);
        const orderId = fields[dataidx - 1];
        if (!orderId) continue;
        console.log("orderId", orderId);
        const jsonstr = fields[dataidx + 1];
        if (!jsonstr) continue;
        try {
          const parsedData = JSON.parse(jsonstr);
          console.log("parsed data", parsedData);
          const order: Order = {
            orderId,
            ...parsedData,
          };
          const priceInfo = latestPrice[order.asset]; // opening price

          if (!priceInfo || !priceInfo.price) {
            console.log(`No price available for asset: ${order.asset}`);
            continue;
          }

          createOrder(order, id, priceInfo);
        } catch (error) {
          console.log("error at conusme order", error);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}

async function OrderClose() {
  let lastId = "$";
  while (1) {
    try {
      const res = await orderRedis.xread(
        "COUNT",
        1,
        "BLOCK",
        0,
        "STREAMS",
        closeOrderStream,
        lastId
      );
      if (!res || res.length === 0) {
        console.log("response is null");

        continue;
      }
      const [streamKey, messages] = res[0] as [string, [string, string[]][]];
      for (const [id, fields] of messages) {
        // console.log("feilds", fields); //feilds [ "uid", "368081bd-cf6b-4eb0-933e-20efcfd42bb7", "data", "{\"orderId\":\"27bdc7cd-a5dd-45bc-bba8-66de31d4edb6\",\"userId\":\"1c43f1f2-e916-4f00-b3a3-3383c596a898\"}" ]
        const dataidx = fields.findIndex((f) => f === "data");
        const closeOrderId = fields[dataidx - 1];
        if (!closeOrderId) {
          console.log("uid not found");
          return;
        }
        const jsonstr = fields[dataidx + 1];
        if (!jsonstr) return;

        const parsedData = JSON.parse(jsonstr);
        const { orderId } = parsedData;
        const order = pendingOrders.find((o) => o.data.orderId == orderId);
        if (!order) {
          console.log("order not found");
          return;
        }
        const priceInfo = latestPrice[order?.data.asset];
        if (!priceInfo) return;
        const closingPrice = priceInfo?.price / 10 ** priceInfo?.decimal;
        // console.log("closeing", closingPrice);
        const result = await closeOrder({
          orderId,
          closingPrice,
          uid: closeOrderId,
        });
        // console.log("orderID", orderId);
      }
    } catch {}
  }
}

//liquidation
const autoClose = async ({ symbol, price }: CheckOrdersParams) => {
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

export async function main() {
  try {
    console.log("Starting consumers...");
    setInterval(() => {
      (async () => {
        await takeSnapshot(pendingOrders, latestPrice);
      })();
    }, 10_100);
    await Promise.all([consumePrices(), consumeOrders(), OrderClose()]);
  } catch (error) {
    console.error("Error in main:", error);
  }
}
