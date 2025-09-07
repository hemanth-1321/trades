import { Redis } from "ioredis";
import { subscriberClient } from "../libs/redis";
type CallbackData = {
  orderId: string;
  userId: string;
  asset: string;
  type: string;
  margin: number;
  leverage: number;
  quantity: number;
  openingPrice: number;
  exposure: number;
  stopLoss: number;
  processed: boolean;
  closingPrice?: number;
};

export class CallbackQueueConsumer {
  private client: Redis;
  private callbacks: Record<string, (value: CallbackData) => void>;

  constructor() {
    this.client = subscriberClient;
    this.callbacks = {};
    this.runLoop();
  }

  async runLoop() {
    while (true) {
      try {
        const response = await this.client.xread(
          "COUNT",
          1,
          "BLOCK",
          0,
          "STREAMS",
          "callback-queue",
          "$"
        );

        if (!response) {
          continue;
        }
        const [id, messages] = response[0] as [string, [string, string[]][]];
        for (const [id, messageArr] of messages) {
          let messageObj: Record<string, string> = {};

          for (let i = 0; i < messageArr.length; i += 2) {
            const key = messageArr[i];
            const value = messageArr[i + 1];

            if (typeof key === "string" && typeof value === "string") {
              messageObj[key] = value; //uuid=839h8r82hf2     data=[orderId....]
            }
          }
          const uid = messageObj["uid"];
          if (uid && this.callbacks[uid]) {
            const data: CallbackData = JSON.parse(messageObj["data"]!);
            this.callbacks[uid](data);
            delete this.callbacks[uid];
          }
        }
      } catch (err) {
        console.error("Error reading from callback-queue:", err);
      }
    }
  }

  waitForMessage(callbackId: string) {
    return new Promise((resolve, reject) => {
      this.callbacks[callbackId] = resolve;
      setTimeout(() => {
        if (this.callbacks[callbackId]) {
          delete this.callbacks[callbackId];

          reject(new Error("Timeout waiting for callback"));
        }
      }, 5000);
    });
  }
}
