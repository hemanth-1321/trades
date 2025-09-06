import express from "express";
import AuthRoutes from "./routes/authRoutes";
import OrderRoutes from "./routes/OrderRoutes";
export const app = express();
app.use(express.json());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/trade", OrderRoutes);
