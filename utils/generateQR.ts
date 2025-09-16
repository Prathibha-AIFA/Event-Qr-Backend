import QRCode from "qrcode";

export const generateQR = async (text: string) => {
  try {
    const qrCodeData = await QRCode.toDataURL(text);
    return qrCodeData;
  } catch (err) {
    console.error("Failed to generate QR code:", err);
    throw err;
  }
};
