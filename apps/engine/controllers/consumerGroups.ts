import { redis } from "@repo/redis/client"
import { latestPrice, pendingOrders } from "./states"
import { createOrder } from "./OrderProcessing"
const priceStream = "trade-stream"
const orderStream = "trade-order"

/**
 * consumer groups for order and prices
 */
export async function initConsumerGroups() {
    try {
        await redis.xgroup(
            "CREATE",
            priceStream,
            "price-engine",
            "$",
            "MKSTREAM"
        )
    } catch (error) {
        console.error("error creating consumer group ", error)
    }

    try {
        await redis.xgroup(
            "CREATE",
            orderStream,
            "order-engine",
            "$",
            "MKSTREAM"
        )
    } catch (error) {
        console.error("error creating consumer group ", error)
    }
}

/**
 * consumer for prices stream from pooler
 */
export async function consumePrices() {
    const consumerName = `price-consumer-${Math.floor(Math.random() * 1000)}`
    while (true) {
        try {
            const res = await redis.xreadgroup(
                "GROUP", "price-engine", consumerName,
                "COUNT", 1,
                "BLOCK", 5000,
                "STREAMS", priceStream, ">"
            )

            if (!res || res.length === 0) continue;

            const [streamKey, messages] = res[0] as [string, [string, string[]][]]

            for (const [id, fields] of messages) {
                const dataIdx = fields.findIndex((f) => f === "data")
                if (dataIdx === -1) continue;

                const jsonStr = fields[dataIdx + 1]
                if (!jsonStr) continue;

                try {
                    const parsedData = JSON.parse(jsonStr)
                    for (const item of parsedData) {
                        const { asset, price, decimal } = item
                        latestPrice[asset] = { price, decimal, id }
                    }
                } catch (parseError) {
                    console.error("Error parsing price data:", parseError)
                }

            }

            console.log("Latest prices:", latestPrice)
        } catch (error) {
            console.error("Error consuming prices:", error)
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }
}

/**
 *consumer for orders 
 */
export async function consumeOrders() {
    const consumerName = `order-consumer-${Math.floor(Math.random() * 1000)}`

    while (true) {
        try {
            const res = await redis.xreadgroup(
                "GROUP", "order-engine", consumerName,
                "COUNT", 1,
                "BLOCK", 5000,
                "STREAMS", orderStream, ">"
            )

            if (!res || res.length === 0) {
                continue;
            }

            // console.log("Received orders:", res)

            const [streamKey, messages] = res[0] as [string, [string, string[]][]]

            for (const [id, fields] of messages) {
                console.log("orderId",id)
                const dataIdx = fields.findIndex((f) => f === "data")

                if (dataIdx === -1) {
                    console.log("No data field found in message")
                    continue;
                }

                const jsonStr = fields[dataIdx + 1]
                if (!jsonStr) {
                    console.log("No data value found")
                    continue;
                }

                try {
                    try {
                        let orderData = JSON.parse(jsonStr)

                        if (!Array.isArray(orderData)) {
                            orderData = [orderData]
                        }

                        for (const order of orderData) {
                        //todo=calclualte the opening=price=quantity * assetPrice

                            createOrder(order,id)
                            console.log("order",order)
                        }


                    } catch (parseError) {
                        console.error("Error parsing order data:", parseError)
                    }
                } catch (parseError) {
                    console.error("Error parsing order data:", parseError)

                }
            }
        } catch (error) {
            console.error("Error consuming orders:", error)
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }
}

//will be deleted
export async function deleteConsumerGroups() {
    try {
        await redis.xgroup("DESTROY", priceStream, "price-engine")
        console.log("Price consumer group deleted")
    } catch (err: any) {
        if (err.message.includes("NOGROUP")) {
            console.log("Price consumer group does not exist")
        } else {
            console.error("Error deleting price consumer group:", err)
        }
    }

    try {
        await redis.xgroup("DESTROY", orderStream, "order-engine")
        console.log("Order consumer group deleted")
    } catch (err: any) {
        if (err.message.includes("NOGROUP")) {
            console.log("Order consumer group does not exist")
        } else {
            console.error("Error deleting order consumer group:", err)
        }
    }

    try {
        await redis.del(priceStream, orderStream)
        console.log("Streams deleted")
    } catch (err) {
        console.error("Error deleting streams:", err)
    }
}

export async function main() {
    try {
        console.log("Initializing consumer groups...")
        await initConsumerGroups()

        console.log("Starting consumers...")

        // Run consumers concurrently
        await Promise.all([
            consumePrices(),
            consumeOrders()
            // deleteConsumerGroups()
        ])
    } catch (error) {
        console.error("Error in main:", error)
    }
}
