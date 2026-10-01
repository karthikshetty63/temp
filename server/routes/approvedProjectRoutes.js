import { Router } from "express";
import { commitFunding, listApprovedProjects, listMyCommitments, withdrawFunding } from "../controllers/approvedProjectController.js";
import { getPaymentDetails, listMyPayments, submitPayment } from "../controllers/paymentController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import acceptUploads from "../middleware/uploadMiddleware.js";

// Approved school needs for verified partners.
const router = Router();

router.use(requireAuth);

// Donors may read the list (a donor-safe view, see listApprovedProjects). Everything below is for NGOs only.
router.get("/", requireRole("ngo", "donor"), listApprovedProjects);

router.use(requireRole("ngo"));

router.get("/committed", listMyCommitments);
router.get("/payments", listMyPayments);
router.post("/:id/commitments", commitFunding);
router.delete("/:id/commitments", withdrawFunding);
router.get("/:id/payment-details", getPaymentDetails);
router.post("/:id/payments", acceptUploads, submitPayment);

export default router;
