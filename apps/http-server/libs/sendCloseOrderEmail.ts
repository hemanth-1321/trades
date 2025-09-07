import nodemailer from "nodemailer";
import { prisma } from "@repo/db/client";
import type { EngineResponse } from "../types/types";

export async function sendCloseOrderEmail(
  userId: string,
  trade: EngineResponse
) {
  console.log("sendCloseOrderEmail CALLED with:", userId, trade);

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    console.log(`❌ No user found in DB for id: ${userId}`);
    return;
  }
  if (!user.email) {
    console.log(`❌ User ${userId} has no email field set`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.FROM_EMAIL,
      pass: process.env.APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Trading Engine" <${process.env.FROM_EMAIL}>`,
      to: user.email,
      subject: `Your order ${trade.orderId} has been closed`,
      text: `Hello, your ${trade.type} trade on ${trade.asset} was closed at ${trade.closingPrice}. PnL: ${trade.pnl}`,
    });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}
