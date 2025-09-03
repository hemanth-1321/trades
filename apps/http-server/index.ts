import express from "express"
import AuthRoutes from "./routes/authRoutes"
import OrderRoutes from "./routes/OrderRoutes"
const app=express()
app.use(express.json())
const PORT=process.env.PORT





app.use("/api/v1/auth",AuthRoutes)
app.use("/api/v1/trade",OrderRoutes)


app.listen(PORT,()=>{
    console.log("server is running at ",PORT)
})