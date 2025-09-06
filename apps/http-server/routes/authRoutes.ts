import express from "express";
import { userSchema } from "@repo/validations/zod";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { prisma } from "@repo/db/client";

const router = express.Router();

router.post("/signup", async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid inputs" });
  }

  const email = parsed.data.email;

  // Create or find existing user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email } });
  }

  // Sign JWT with user ID
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
  });
  const link = `${process.env.AUTH_URL}/token=${token}`;

  // Send magic link via email
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: process.env.FROM_EMAIL, pass: process.env.APP_PASSWORD },
    });

    await transporter.sendMail({
      from: `"Super30 Trading" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Verify your account - Super30 Trading",
      html: `<a href="${link}">Click here to verify your email</a>`,
    });

    return res
      .status(200)
      .json({ message: "Magic link sent successfully", link });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/token=:token", async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(404).json({ message: "Token not found" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
    };

    // Set cookie for auth
    res.cookie("auth", token, { httpOnly: true });

    return res
      .status(200)
      .json({ message: "Login successful", userId: decoded.id });
  } catch {
    return res.status(401).json({ message: "Login not successful" });
  }
});

export default router;
