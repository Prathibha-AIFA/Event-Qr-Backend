import { Router } from "express";
const router = Router();

// You can extend this later to fetch multiple events
router.get("/", (req, res) => {
  res.json({
    id: "tech2025",
    title: "Tech Event 2025",
    description: "Explore new technologies, network with peers, and gain insights."
  });
});

export default router;
