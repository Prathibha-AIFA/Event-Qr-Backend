import nodemailer from "nodemailer";

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  qrCodeData?: string
) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // Prepare attachments if qrCodeData exists
    const attachments = qrCodeData
      ? [
          {
            filename: "ticket.png",
            content: Buffer.from(qrCodeData.split(",")[1], "base64"),
            cid: "ticketqr", // <img src="cid:ticketqr" />
          },
        ]
      : [];

    // Replace <img src="cid:ticketqr"> in html if qrCodeData exists
    const finalHtml = qrCodeData
      ? html.replace(
          /<img src="[^"]*"[^>]*>/,
          `<img src="cid:ticketqr" alt="QR Code" style="width:250px"/>`
        )
      : html;

    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      html: finalHtml,
      attachments,
    });

    console.log("[Email] Email sent successfully:", info.messageId);
  } catch (err: any) {
    console.error("[Email] Failed to send email:", err.message);
    throw err;
  }
};
