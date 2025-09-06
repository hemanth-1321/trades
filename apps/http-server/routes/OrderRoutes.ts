import express from "express";
import { OrderSchema } from "@repo/validations/zod";
import { redis } from "@repo/redis/client";
import { authMiddleware } from "../middleware/middleware";
import { v4 as uuidv4 } from "uuid";
const router = express.Router();

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

    return res.status(200).json({ message: "Order queued", orderId });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error creating order" });
  }
});

export default router;
