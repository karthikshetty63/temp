import { Router } from "express";
import { createVolunteer, deleteVolunteer, listVolunteers, updateVolunteer } from "../controllers/volunteerController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

// A signed-in, approved NGO managing its own records.
const router = Router();

router.use(requireAuth, requireRole("ngo"));

router.get("/volunteers", listVolunteers);
router.post("/volunteers", createVolunteer);
router.patch("/volunteers/:id", updateVolunteer);
router.delete("/volunteers/:id", deleteVolunteer);

export default router;
