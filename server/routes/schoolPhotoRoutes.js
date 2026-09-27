import { Router } from "express";
import { deletePhoto, listMyPhotos, uploadPhoto } from "../controllers/projectPhotoController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";
import acceptUploads from "../middleware/uploadMiddleware.js";

// A signed-in, approved school's own project photos (its gallery).
const router = Router();

router.use(requireAuth, requireRole("school"));

router.get("/", listMyPhotos);
router.post("/", acceptUploads, uploadPhoto);
router.delete("/:id", deletePhoto);

export default router;
