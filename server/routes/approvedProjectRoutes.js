import { Router } from "express";
import { commitFunding, listApprovedProjects, listMyCommitments, withdrawFunding } from "../controllers/approvedProjectController.js";
import { getPaymentDetails, listMyPayments, startOnlinePayment, submitPayment, verifyOnlinePayment } from "../controllers/paymentController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import acceptUploads from "../middleware/uploadMiddleware.js";

// Approved school needs for verified partners. The online-order limiter is created per app (see app.js).
const createApprovedProjectRouter = ({ onlineOrderLimiter }) => {
    const router = Router();

    router.use(requireAuth);

    // Donors may read the list (a donor-safe view, see listApprovedProjects). Everything below is for NGOs only.
    router.get("/", requireRole("ngo", "donor"), listApprovedProjects);

    router.use(requireRole("ngo"));

    router.get("/committed", listMyCommitments);
    router.get("/payments", listMyPayments);
    router.post("/payments/:paymentId/verify", verifyOnlinePayment);
    router.post("/:id/commitments", commitFunding);
    router.delete("/:id/commitments", withdrawFunding);
    router.get("/:id/payment-details", getPaymentDetails);
    // Two ways to pay for committed parts: directly to the school (recorded with proof) or online via Razorpay.
    router.post("/:id/payments", acceptUploads, submitPayment);
    router.post("/:id/payments/online", onlineOrderLimiter, startOnlinePayment);

    return router;
};

export default createApprovedProjectRouter;
