import mongoose from "mongoose";
import Project from "../models/Project.js";
import SchoolProfile from "../models/SchoolProfile.js";
import { getUnexpectedProjectFields, validateProject } from "../../shared/projectRules.js";

// Plenty for any real school; stops a runaway script from filling the database.
const MAX_PROJECTS_PER_SCHOOL = 100;

const badRequest = (res, message, errors) => res.status(400).json({ message, ...(errors ? { errors } : {}) });
const notFound = (res) => res.status(404).json({ message: "Project not found." });

/** The only project fields ever sent to the browser (school and admin views). */
export const projectToClient = (p) => ({
    id: p._id.toString(),
    title: p.title,
    category: p.category,
    problem: p.problem,
    priority: p.priority,
    budget: p.budget,
    raised: p.raised,
    studentsBenefited: p.studentsBenefited,
    expectedCompletion: p.expectedCompletion.toISOString().slice(0, 10),
    location: p.location,
    materials: p.materials,
    status: p.status,
    // Records from before review existed count as waiting for review.
    reviewStatus: p.reviewStatus || "PENDING_REVIEW",
    rejectionReason: p.rejectionReason || null,
    reviewedAt: p.reviewedAt || null,
    submittedAt: p.submittedAt || p.createdAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
});
const toClient = projectToClient;

const readBody = (req, res, { isUpdate }) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        badRequest(res, "Request body must be a JSON object.");
        return null;
    }
    const unexpected = getUnexpectedProjectFields(body, { isUpdate });
    if (unexpected.length) {
        badRequest(res, `Unexpected field(s): ${unexpected.join(", ")}.`, Object.fromEntries(unexpected.map((f) => [f, "This field is not allowed."])));
        return null;
    }
    const { errors, values } = validateProject(body, { isUpdate });
    if (Object.keys(errors).length) {
        badRequest(res, Object.values(errors)[0], errors);
        return null;
    }
    if (values.expectedCompletion) values.expectedCompletion = new Date(`${values.expectedCompletion}T00:00:00Z`);
    return values;
};

// Only ever the signed-in school's own project; anything else looks like it doesn't exist.
const findOwnProject = (req) =>
    mongoose.isValidObjectId(req.params.id) ? Project.findOne({ _id: req.params.id, school: req.user._id }) : Promise.resolve(null);

// GET /api/school/projects
export const listMyProjects = async (req, res, next) => {
    try {
        const projects = await Project.find({ school: req.user._id }).sort({ createdAt: -1, _id: -1 }).lean();
        return res.json({ projects: projects.map(toClient) });
    } catch (error) {
        return next(error);
    }
};

// POST /api/school/projects
export const createProject = async (req, res, next) => {
    const values = readBody(req, res, { isUpdate: false });
    if (!values) return undefined;
    try {
        if ((await Project.countDocuments({ school: req.user._id })) >= MAX_PROJECTS_PER_SCHOOL) {
            return res.status(409).json({ message: `A school can have at most ${MAX_PROJECTS_PER_SCHOOL} projects.` });
        }
        // Without a location, use the school's own district and state from its registration.
        if (!values.location) {
            const profile = await SchoolProfile.findOne({ userId: req.user._id }).select("district state").lean();
            values.location = [profile?.district, profile?.state].filter(Boolean).join(", ");
        }
        // Every new project waits for an admin before anyone else can see it.
        const project = await Project.create({ ...values, school: req.user._id, reviewStatus: "PENDING_REVIEW", submittedAt: new Date() });
        return res.status(201).json({ message: "Project submitted for review.", project: toClient(project) });
    } catch (error) {
        return next(error);
    }
};

// GET /api/school/projects/:id
export const getMyProject = async (req, res, next) => {
    try {
        const project = await findOwnProject(req);
        return project ? res.json({ project: toClient(project) }) : notFound(res);
    } catch (error) {
        return next(error);
    }
};

// PATCH /api/school/projects/:id — only the fields sent are changed. Editing a rejected project
// sends it back for review.
export const updateMyProject = async (req, res, next) => {
    const values = readBody(req, res, { isUpdate: true });
    if (!values) return undefined;
    if (!Object.keys(values).length) return badRequest(res, "Nothing to update.");
    try {
        const project = await findOwnProject(req);
        if (!project) return notFound(res);

        const reviewStatus = project.reviewStatus || "PENDING_REVIEW";
        // The work can only start (In Progress, Completed…) once the project is approved.
        if ("status" in values && reviewStatus !== "OPEN") {
            const message = "You can change the status once the project is approved.";
            return badRequest(res, message, { status: message });
        }

        project.set(values);
        const resubmitted = reviewStatus === "REJECTED";
        if (resubmitted) {
            project.reviewStatus = "PENDING_REVIEW";
            project.submittedAt = new Date();
            project.rejectionReason = undefined;
            project.reviewedBy = undefined;
            project.reviewedAt = undefined;
        }
        await project.save();
        return res.json({ message: resubmitted ? "Project resubmitted for review." : "Project updated.", project: toClient(project) });
    } catch (error) {
        return next(error);
    }
};
