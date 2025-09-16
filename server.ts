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

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI || "")
  .then(() => console.log("[INFO] MongoDB connected"))
  .catch((err) => console.error("[ERROR] MongoDB connection error:", err));

// CORS setup
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  })
);

// Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

// Route: Start Google OAuth
app.get("/google", (req, res) => {
  const origin = req.query.origin as string;

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    prompt: "consent",
    state: origin, // pass frontend origin through state
  });

  console.log("[INFO] Redirecting to Google OAuth URL:", url);
  res.redirect(url);
});

// Route: Google OAuth callback
app.get("/google/callback", async (req, res) => {
  const code = req.query.code as string;
  const origin =
    (req.query.origin as string) ||
    (req.query.state as string) ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173";

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

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      console.log("[INFO] Creating new user...");
      user = await User.create({ name, email, googleId });
    } else {
      console.log("[INFO] User exists:", user._id);
    }

    // Create ticket
    console.log("[INFO] Generating ticket and QR code...");
    const ticket = new Ticket({
      userId: user._id,
      eventId: "tech2025",
    });

    // Ticket URL for frontend
    const ticketRedirectUrl = `${origin}/ticket/${ticket._id}?showQR=true`;
   const ticketQRUrl = `${origin}/ticket/${ticket._id}`;
  ticket.qrCodeData = await generateQR(ticketQRUrl);
await ticket.save();
    console.log("[INFO] Ticket created:", ticket._id);

    // Send email
    try {
      const emailHtml = `
        <h2>Hello ${user.name}</h2>
        <p>Your Tech Event ticket is ready.</p>
        <p><strong>Event:</strong> Tech 2025</p>
        <p><strong>Ticket ID:</strong> ${ticket._id}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <img src="cid:ticketqr" alt="QR Code" style="width:250px"/>
        <p>Or view your ticket online: <a href="${ticketRedirectUrl}">${ticketRedirectUrl}</a></p>
      `;
      await sendEmail(user.email, "Your Tech Event Ticket", emailHtml, ticket.qrCodeData);
      console.log("[INFO] Email sent successfully");
    } catch (emailErr: unknown) {
      console.error("[ERROR] Failed to send email:", emailErr);
    }

    // Redirect frontend to ticket page with QR
    res.redirect(ticketRedirectUrl);
  } catch (err: unknown) {
    console.error(
      "[ERROR] Google OAuth callback error:",
      (err as any)?.response?.data || (err as any)?.message || err
    );
    res.status(500).send("Authentication failed");
  }
});

// Manual registration route
app.post("/api/auth/register", async (req, res) => {
  const { name, email } = req.body;
  const origin = (req.query.origin as string) || process.env.FRONTEND_URL;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    user = await User.create({ name, email, googleId: "manual-registration" });

    console.log("[INFO] Generating ticket and QR code...");
    const ticket = new Ticket({
      userId: user._id,
      eventId: "tech2025",
    });

    // Generate the URLs
    const ticketRedirectUrl = `${origin}/ticket/${ticket._id}?showQR=true`; // redirect to show QR
    const ticketQRUrl = `${origin}/ticket/${ticket._id}`; // QR points to details view

    // Generate QR code
    ticket.qrCodeData = await generateQR(ticketQRUrl);
    await ticket.save();

    // Send email
    const emailHtml = `
      <h2>Hello ${user.name}</h2>
      <p>Your Tech Event ticket is ready.</p>
      <p><strong>Event:</strong> Tech 2025</p>
      <p><strong>Ticket ID:</strong> ${ticket._id}</p>
      <img src="cid:ticketqr" alt="QR Code" style="width:250px"/>
      <p>Or view your ticket online: <a href="${ticketRedirectUrl}">${ticketRedirectUrl}</a></p>
    `;
    await sendEmail(user.email, "Your Tech Event Ticket", emailHtml, ticket.qrCodeData);

    // Return redirect URL for frontend
    res.status(201).json({
      ticket: {
        _id: ticket._id,
        name: user.name,
        email: user.email,
        qrCodeData: ticket.qrCodeData,
      },
      redirect: ticketRedirectUrl,
    });

  } catch (err: unknown) {
    console.error("[ERROR] Manual registration error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});



// Ticket API routes
app.use("/api/tickets", ticketRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[INFO] Server running on port ${PORT}`));
