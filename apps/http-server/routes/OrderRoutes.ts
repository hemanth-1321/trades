import express from "express"
import { OrderSchema } from "@repo/validations/zod"
import { redis } from "@repo/redis/client"
const router = express.Router()



 router.post("/create", async(req, res) => {
    const parsedData = OrderSchema.safeParse(req.body)
    if (!parsedData.success) {
        return res.status(403).json({
            message: "invalid inputs"
        })
    }
    try {

        const payload = {
            asset: parsedData.data.asset,
            type: parsedData.data.type,
            margin: parsedData.data.margin,
            leverage: parsedData.data.leverage,
            slippage: parsedData.data.slippage
        }
        const id =await redis.xadd(
            "trade-order",
            "*",
            "data",
            JSON.stringify(payload)
        )
        return res.status(200).json({
            message: "your order has been queued",
            orderId: id
        })

    } catch (error) {
        console.log("error creating order", error)
    }


})




export default router