import{z} from "zod"
import { OrderSchema } from "@repo/validations/zod"

type Order=z.infer<typeof OrderSchema>
export const latestPrice:Record<string,{price:number,decimal:number,id:string}>={}

export const pendingOrders:{id:string,data:Order}[]=[]
