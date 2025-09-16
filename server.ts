import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { google } from "googleapis";
import User from "./models/User";
import Ticket from "./models/Tickets";
import { generateQR } from "./utils/generateQR";
import cors from "cors";
import ticketRoutes from "./routes/ticket";
import { sendEmail } from "./utils/sendEmail";

dotenv.config();
const app = express();
app.use(express.json());


mongoose
  .connect(process.env.MONGO_URI || "")
  .then(() => console.log("[INFO] MongoDB connected"))
  .catch((err) => console.error("[ERROR] MongoDB connection error:", err));


app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  })
);

app.use('/', (req, res)=>{
  res.send("hello")
})

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);


app.get("/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    prompt: "consent",
  });

  console.log("[INFO] Redirecting to Google OAuth URL:", url);
  res.redirect(url);
});

app.get("/google/callback", async (req, res) => {
  const code = req.query.code as string;
  const origin = process.env.FRONTEND_URL || "http://localhost:5173";

  if (!code) {
    console.error("[ERROR] No code provided in query parameters");
    return res.status(400).send("No code provided");
  }

  try {
    console.log("[INFO] Exchanging code for tokens...");
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log("[INFO] Fetching user info from Google...");
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const { email, name, id: googleId } = userInfo.data;

    if (!email || !name) {
      console.error("[ERROR] User info incomplete:", userInfo.data);
      return res.status(400).send("Failed to get user info");
    }

    let user = await User.findOne({ email });
    if (!user) {
      console.log("[INFO] User not found, creating new user...");
      user = await User.create({ name, email, googleId });
    } else {
      console.log("[INFO] User exists:", user._id);
    }

    console.log("[INFO] Generating ticket URL and QR code...");


    const ticket = new Ticket({
      userId: user._id,
      eventId: "tech2025",
    });

    const ticketUrl = `${origin}/ticket/${ticket._id}`;
    ticket.qrCodeData = await generateQR(ticketUrl);
    await ticket.save();

    console.log("[INFO] Ticket created with QR code:", ticket._id);

    try {
      console.log("[INFO] Sending ticket email to user...");
      const emailHtml = `
        <h2>Hello ${user.name}</h2>
        <p>Your Tech Event ticket is ready.</p>
        <p><strong>Event:</strong> Tech 2025</p>
        <p><strong>Ticket ID:</strong> ${ticket._id}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <img src="${ticket.qrCodeData}" alt="QR Code" style="width:250px"/>
        <p>Or view your ticket online: <a href="${ticketUrl}">${ticketUrl}</a></p>
      `;
      await sendEmail(user.email, "Your Tech Event Ticket", emailHtml);
      console.log("[INFO] Email sent successfully");
    } catch (emailErr: unknown) {
      console.error("[ERROR] Failed to send email:", emailErr);
    }

    res.redirect(ticketUrl);
  } catch (err: unknown) {
    console.error(
      "[ERROR] Google OAuth callback error:",
      (err as any)?.response?.data || (err as any)?.message || err
    );
    res.status(500).send("Authentication failed");
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email } = req.body;
  const origin = (req.query.origin as string) || process.env.FRONTEND_URL;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    user = await User.create({ name, email, googleId: "manual-registration"  });

    console.log("[INFO] Generating ticket URL and QR code...");
    const ticket = new Ticket({
      userId: user._id,
      eventId: "tech2025",
    });

    const ticketUrl = `${origin}/ticket/${ticket._id}`;
    ticket.qrCodeData = await generateQR(ticketUrl);
    await ticket.save();

    console.log("[INFO] Ticket created with QR code:", ticket._id);

    const emailHtml = `
      <h2>Hello ${user.name}</h2>
      <p>Your Tech Event ticket is ready.</p>
      <p><strong>Event:</strong> Tech 2025</p>
      <p><strong>Ticket ID:</strong> ${ticket._id}</p>
      <img src="cid:ticketqr" alt="QR Code" style="width:250px"/>
      <p>Or view your ticket online: <a href="${ticketUrl}">${ticketUrl}</a></p>
    `;
    await sendEmail(user.email, "Your Tech Event Ticket", emailHtml, ticket.qrCodeData);


    res.status(201).json({
      ticket: {
        _id: ticket._id,
        name: user.name,
        email: user.email,
        qrCodeData: ticket.qrCodeData,
      },
      redirect: ticketUrl,
    });
  } catch (err: unknown) {
    console.error("[ERROR] Manual registration error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});


app.use("/api/tickets", ticketRoutes);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[INFO] Server running on port ${PORT}`));
