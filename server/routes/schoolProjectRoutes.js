import { Router } from "express";
import { createProject, getMyProject, listMyProjects, updateMyProject } from "../controllers/projectController.js";
import requireAuth from "../middleware/authMiddleware.js";
import requireRole from "../middleware/roleMiddleware.js";

// A signed-in, approved school managing its own projects. (A public project list for donors
// will live under /api/projects.)
const router = Router();

router.use(requireAuth, requireRole("school"));

router.get("/", listMyProjects);
router.post("/", createProject);
router.get("/:id", getMyProject);
router.patch("/:id", updateMyProject);

export default router;
