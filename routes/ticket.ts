import { Router } from "express";
import Ticket from "../models/Tickets";

const router = Router();

router.get("/:id", async (req, res) => {
  const ticketId = req.params.id;
  console.log(`[Ticket API] Fetching ticket with ID: ${ticketId}`);

  try {
    const ticket = await Ticket.findById(ticketId).populate("userId");

    if (!ticket) {
      console.log(`[Ticket API] Ticket not found: ${ticketId}`);
      return res.status(404).json({ msg: "Ticket not found" });
    }

    // console.log(`[Ticket API] Ticket found:`, ticket);
    res.json(ticket);
  } catch (err: any) {
    console.error(`[Ticket API] Error fetching ticket: ${err.message}`);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});



export default router;
