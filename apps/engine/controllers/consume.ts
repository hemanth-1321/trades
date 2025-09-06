import { json } from "zod";
import { orderRedis, priceRedis } from "../redis";
import { latestPrice, pendingOrders, type Order } from "./states";
import { createOrder } from "./OrderProcessing";

const priceStream = "trade-stream";
const orderStream = "trade-order";

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
export async function main() {
  try {
    console.log("Starting consumers...");
    // setInterval(() => {
    //   console.log(
    //     "📊 latestPrice snapshot:",
    //     JSON.stringify(latestPrice, null, 2)
    //   );
    // }, 1000);
    // Run consumers concurrently
    await Promise.all([consumePrices(), consumeOrders()]);
  } catch (error) {
    console.error("Error in main:", error);
  }
}
