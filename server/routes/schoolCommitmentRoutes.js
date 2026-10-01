import { Router } from "express";
import { listSchoolCommitments } from "../controllers/schoolCommitmentController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

// NGO funding commitments on the signed-in school's own projects.
const router = Router();

router.use(requireAuth, requireRole("school"));

router.get("/", listSchoolCommitments);

export default router;
