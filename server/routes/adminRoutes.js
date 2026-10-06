import { Router } from "express";
import { approveAccount, getAccount, listAccounts, rejectAccount } from "../controllers/adminController.js";
import { approvePaymentQr, listPaymentQrs, rejectPaymentQr } from "../controllers/paymentQrController.js";
import { approveProject, getProjectForReview, listProjectsForReview, rejectProject } from "../controllers/projectReviewController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

const router = Router();

// Every admin route: logged in (cookie) AND role === "admin" according to the database.
router.use(requireAuth, requireRole("admin"));

router.get("/accounts", listAccounts);
router.get("/accounts/:id", getAccount);
router.patch("/accounts/:id/approve", approveAccount);
router.patch("/accounts/:id/reject", rejectAccount);

router.get("/projects", listProjectsForReview);
router.get("/projects/:id", getProjectForReview);
router.patch("/projects/:id/approve", approveProject);
router.patch("/projects/:id/reject", rejectProject);

router.get("/payment-qrs", listPaymentQrs);
router.patch("/payment-qrs/:schoolId/approve", approvePaymentQr);
router.patch("/payment-qrs/:schoolId/reject", rejectPaymentQr);

export default router;
