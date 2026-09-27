import { Router } from "express";
import { getMyProfile, removePhoto, replacePhoto, updateSchoolProfile } from "../controllers/profileController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import acceptUploads from "../middleware/uploadMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/me", getMyProfile);
router.patch("/school", requireRole("school"), updateSchoolProfile);
router.put("/photo", requireRole("school"), acceptUploads, replacePhoto);
router.delete("/photo", requireRole("school"), removePhoto);

export default router;
