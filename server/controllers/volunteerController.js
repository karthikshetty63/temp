import mongoose from "mongoose";
import Project from "../models/Project.js";
import Volunteer from "../models/Volunteer.js";
import { VOLUNTEERS_MAX, getUnexpectedVolunteerFields, validateVolunteer } from "../../shared/volunteerRules.js";

const badRequest = (res, message, errors) => res.status(400).json({ message, ...(errors ? { errors } : {}) });
const notFound = (res) => res.status(404).json({ message: "Volunteer not found." });
const NOT_YOUR_PROJECT = "Choose one of the school needs your NGO has committed to fund.";

/** Project titles by id, for showing where each volunteer works. */
const projectTitles = async (volunteers) => {
    const ids = [...new Set(volunteers.map((v) => v.project?.toString()).filter(Boolean))];
    const projects = ids.length ? await Project.find({ _id: { $in: ids } }).select("title").lean() : [];
    return new Map(projects.map((p) => [p._id.toString(), p.title]));
};

const toClient = (v, titles) => ({
    id: v._id.toString(),
    name: v.name,
    role: v.role,
    phone: v.phone || "",
    project: v.project ? { id: v.project.toString(), title: titles.get(v.project.toString()) || "School need" } : null,
    createdAt: v.createdAt,
});

const readBody = (req, res, { isUpdate }) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        badRequest(res, "Request body must be a JSON object.");
        return null;
    }
    const unexpected = getUnexpectedVolunteerFields(body);
    if (unexpected.length) {
        badRequest(res, `Unexpected field(s): ${unexpected.join(", ")}.`, Object.fromEntries(unexpected.map((f) => [f, "This field is not allowed."])));
        return null;
    }
    const { errors, values } = validateVolunteer(body, { isUpdate });
    if (Object.keys(errors).length) {
        badRequest(res, Object.values(errors)[0], errors);
        return null;
    }
    return values;
};

/** `projectId` (if any) → the stored `project` field, or false when it isn't one of this NGO's funded needs. */
const toStoredFields = async (values, ngoId) => {
    const { projectId, ...rest } = values;
    if (projectId === undefined) return rest;
    if (projectId === null) return { ...rest, project: null };
    const funded = await Project.exists({ _id: projectId, reviewStatus: "OPEN", "fundingParts.ngo": ngoId });
    return funded ? { ...rest, project: funded._id } : false;
};

const findOwn = (req) =>
    mongoose.isValidObjectId(req.params.id) ? Volunteer.findOne({ _id: req.params.id, ngo: req.user._id }) : Promise.resolve(null);

// GET /api/ngo/volunteers — this NGO's volunteers, newest first.
export const listVolunteers = async (req, res, next) => {
    try {
        const volunteers = await Volunteer.find({ ngo: req.user._id }).sort({ createdAt: -1, _id: -1 }).lean();
        const titles = await projectTitles(volunteers);
        return res.json({ volunteers: volunteers.map((v) => toClient(v, titles)) });
    } catch (error) {
        return next(error);
    }
};

// POST /api/ngo/volunteers
export const createVolunteer = async (req, res, next) => {
    const values = readBody(req, res, { isUpdate: false });
    if (!values) return undefined;
    try {
        if ((await Volunteer.countDocuments({ ngo: req.user._id })) >= VOLUNTEERS_MAX) {
            return res.status(409).json({ message: `An NGO can list at most ${VOLUNTEERS_MAX} volunteers.` });
        }
        const fields = await toStoredFields(values, req.user._id);
        if (!fields) return badRequest(res, NOT_YOUR_PROJECT, { projectId: NOT_YOUR_PROJECT });
        const volunteer = await Volunteer.create({ ...fields, ngo: req.user._id });
        return res.status(201).json({ message: "Volunteer added.", volunteer: toClient(volunteer, await projectTitles([volunteer])) });
    } catch (error) {
        return next(error);
    }
};

// PATCH /api/ngo/volunteers/:id — only the fields sent are changed.
export const updateVolunteer = async (req, res, next) => {
    const values = readBody(req, res, { isUpdate: true });
    if (!values) return undefined;
    if (!Object.keys(values).length) return badRequest(res, "Nothing to update.");
    try {
        const volunteer = await findOwn(req);
        if (!volunteer) return notFound(res);
        const fields = await toStoredFields(values, req.user._id);
        if (!fields) return badRequest(res, NOT_YOUR_PROJECT, { projectId: NOT_YOUR_PROJECT });
        volunteer.set(fields);
        await volunteer.save();
        return res.json({ message: "Volunteer updated.", volunteer: toClient(volunteer, await projectTitles([volunteer])) });
    } catch (error) {
        return next(error);
    }
};

// DELETE /api/ngo/volunteers/:id
export const deleteVolunteer = async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    try {
        const { deletedCount } = await Volunteer.deleteOne({ _id: req.params.id, ngo: req.user._id });
        return deletedCount ? res.json({ message: "Volunteer removed." }) : notFound(res);
    } catch (error) {
        return next(error);
    }
};
