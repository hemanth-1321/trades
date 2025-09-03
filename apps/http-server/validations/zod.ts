import {z} from "zod"



export const userSchema=z.object({
    email:z.email()
})

export const OrderSchema=z.object({
    asset:z.string(),
    type:z.enum(["long","short"]),
    margin:z.number(),
    leverage:z.number(),
    slippage:z.number()
})