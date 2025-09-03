import express, { Router } from "express"
import { userSchema } from "../validations/zod"
import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"
const router = express.Router()



router.post("/signup", async (req, res) => {
    const parsed = userSchema.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({
            message: "invalid inputs"
        })
    }
    const email = parsed.data.email
    const token = jwt.sign(email, process.env.JWT_SECRET!)
    const link = `${process.env.AUTH_URL}/token=${token}`
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.FROM_EMAIL,
                pass: process.env.APP_PASSWORD,
            },
        })
        const info = await transporter.sendMail({
            from: `"Super30 Trading" <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: "Verify your account - Super30 Trading",
            text: `Welcome to Super30 Trading!\n\nPlease verify your account by clicking this link:\n${link}\n\nIf you did not request this, please ignore this email.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #2c3e50; text-align: center;">Welcome to Super30 Trading 🚀</h2>
                    <p style="font-size: 16px; color: #444;">
                    Hi there,
                    </p>
                    <p style="font-size: 16px; color: #444;">
                    Thanks for choosing <b>Super30 Trading</b>. To get started, please confirm your email address by clicking the button below:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                    <a href="${link}" style="background: #2d89ef; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-size: 16px;">
                        Verify Email
                    </a>
                    </div>
                    <p style="font-size: 14px; color: #777;">
                    If the button doesn’t work, copy and paste the link below into your browser:
                    </p>
                    <p style="font-size: 14px; color: #2d89ef; word-break: break-all;">
                    ${link}
                    </p>
                    <hr style="margin: 30px 0;"/>
                    <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated message from Super30 Trading. Please do not reply.<br/>
                    &copy; ${new Date().getFullYear()} Super30 Trading. All rights reserved.
                </p>
            </div>
    `
        })
        console.log("message sent", info.messageId)
        return res.status(200).json({
            message: "magiclink sent successfuly",
            link
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "internal server error"
        })
    }
})

router.get("/token=:token",async(req,res)=>{
    const{token}=req.params

    if(!token){
        return res.status(404).json({
            message:"token not found"
        })
    }
    const decode=jwt.verify(token,process.env.JWT_SECRET!)

    if(!decode){
        return res.status(401).json({
            message:"login not successfull"
        })
    }
    res.cookie("auth",token,{
        httpOnly:true
    })

    return res.status(200).json({
        message:"login successfull",
        user:decode
    })

})


export default router