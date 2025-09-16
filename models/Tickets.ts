import mongoose, { Schema, Document } from "mongoose";

export interface ITicket extends Document {
  userId: Schema.Types.ObjectId;
  eventId: string;
  qrCodeData: string;
}

const TicketSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  eventId: { type: String, required: true },
  qrCodeData: { type: String, required: true },
});

export default mongoose.model<ITicket>("Ticket", TicketSchema);
