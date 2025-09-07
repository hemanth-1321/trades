import Redis from "ioredis";

export const priceRedis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});
export const orderRedis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

export const callbackRedis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});
