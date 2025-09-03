import { redis } from "@repo/redis/client"
import WebSocket from "ws"



const ws = new WebSocket("wss://ws.backpack.exchange")

ws.on("open", () => {
    console.log("connected")
    const payload = {
        method: "SUBSCRIBE",
        params: ["bookTicker.SOL_USDC_PERP", "bookTicker.BTC_USDC_PERP", "bookTicker.ETH_USDC_PERP"],
    }
    ws.send(JSON.stringify(payload))
})

const latestPrice: Record<string, { price: number, decimal: number }> = {}
const lastPublishedPrice: Record<string, number> = {}


const assetDecimals: Record<string, number> = {
    "BTC_USDC_PERP": 2,
    "SOL_USDC_PERP": 2,
    "ETH_USDC_PERP": 2
}

const toInt = (price: string, decimal: number) => {
    return Math.floor(parseFloat(price) * 10 ** decimal)
}

ws.on("message", (mesage) => {
    const data = JSON.parse(mesage.toString())
    // console.log(data)

    if (!data) {
        return
    }
    const { s: symbol, a: askStr } = data.data
    const decimal = assetDecimals[symbol] || 2
    const askPrice = toInt(askStr, decimal)
    latestPrice[symbol] = { price: askPrice, decimal }

})

setInterval(() => {

    const priceUpdatees:{asset:string,price:number,decimal:number}[]=[]
    for(const [asset,{price,decimal}]of Object.entries(latestPrice)){
        if(lastPublishedPrice[asset]!=price){
            lastPublishedPrice[asset]=price
            priceUpdatees.push({asset,price,decimal})
        }
    }
    if(priceUpdatees.length>0){
        redis.xadd(
            "trade-stream",
            "*",
            "data",
            JSON.stringify(priceUpdatees)
            
        )
        console.log("xadded",priceUpdatees)
    }


}, 100)
