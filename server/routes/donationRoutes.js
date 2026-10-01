import { Router } from "express";
import { createDonation, verifyDonation } from "../controllers/donationController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

// A signed-in, approved donor's own online donations. The order limiter is created per app (see app.js).
const createDonationRouter = ({ orderLimiter }) => {
    const router = Router();

    router.use(requireAuth, requireRole("donor"));

    router.post("/", orderLimiter, createDonation);
    router.post("/:id/verify", verifyDonation);

    return router;
};

export default createDonationRouter;
