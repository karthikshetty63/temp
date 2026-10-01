import { Router } from "express";
import { acceptPayment, listSchoolPayments, rejectPayment } from "../controllers/paymentController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

// Payments NGOs have recorded for the signed-in school's projects, and confirming them.
const router = Router();

router.use(requireAuth, requireRole("school"));

router.get("/", listSchoolPayments);
router.patch("/:id/accept", acceptPayment);
router.patch("/:id/reject", rejectPayment);

export default router;
