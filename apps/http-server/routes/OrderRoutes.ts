import express from "express";
import { OrderSchema } from "@repo/validations/zod";
import { redis } from "@repo/redis/client";
import { authMiddleware } from "../middleware/middleware";
import { v4 as uuidv4 } from "uuid";
import { CallbackQueueConsumer } from "../redis-subscriber/index";
const router = express.Router();
const consumer = new CallbackQueueConsumer();

router.post("/create", authMiddleware, async (req, res) => {
  const parsedData = OrderSchema.safeParse(req.body);
  const userId = req.userId;

  if (!userId)
    return res.status(403).json({ message: "User not authenticated" });
  if (!parsedData.success)
    return res.status(400).json({ message: "Invalid inputs" });
  const uid = uuidv4();
  try {
    const payload = { userId, ...parsedData.data };
    const orderId = await redis.xadd(
      "trade-order",
      "*",
      "uid",
      uid,
      "data",
      JSON.stringify(payload)
    );

    const responseFromEngine = await consumer.waitForMessage(uid);

    return res
      .status(200)
      .json({ message: "Order queued", orderId, responseFromEngine });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error creating order" });
  }
});

router.post("/close", authMiddleware, async (req, res) => {
  const { orderId } = req.body;
  const userId = req.userId;

  if (!userId)
    return res.status(403).json({ message: "User not authenticated" });

  if (!orderId) {
    return res.status(400).json({ message: "Missing or invalid orderId" });
  }
  const uid = uuidv4();

  try {
    const id = await redis.xadd(
      "close-order",
      "*",
      "uid",
      uid,
      "data",
      JSON.stringify({ orderId, userId })
    );

    const responseFromEngine = await consumer.waitForMessage(uid);
    
    return res
      .status(200)
      .json({ message: "closed", orderId, responseFromEngine });
  } catch (error) {
    console.log("error closing order", error);
    res.status(500).json({
      message: "error cloing order",
    });
  }
});

export default router;
