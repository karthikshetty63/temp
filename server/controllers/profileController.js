import User from "../models/User.js";
import UploadedFile from "../models/UploadedFile.js";
import { SCHOOL_FACILITY_FIELDS, UPLOAD_RULES, validateSchoolProfileUpdate } from "../../shared/registrationRules.js";
import { PROFILE_MODELS } from "../services/profileModels.js";
import { paymentQrToClient } from "./paymentQrController.js";
import { deleteUploadedFiles, fileSummary, storeUploads, validateUploads } from "../services/uploadService.js";

const PHOTO_FIELD = "schoolPhoto";

const maskAccountNumber = (value) => (value ? `•••• ${String(value).slice(-4)}` : null);

/** A stored profile (lean) → what the owner's browser receives. */
const profileToClient = async (user, profile) => {
    const fileIds = [profile.photo, ...Object.values(profile.documents || {})].filter(Boolean);
    const files = await UploadedFile.find({ _id: { $in: fileIds }, owner: user._id });
    const byId = new Map(files.map((f) => [f._id.toString(), fileSummary(f)]));

    const result = { ...profile };
    for (const internal of ["_id", "__v", "userId"]) delete result[internal];
    if ("bankAccount" in result) result.bankAccount = maskAccountNumber(result.bankAccount);
    // Always present for schools (null when there is no photo) so the UI gets one consistent shape.
    if (user.role === "school") {
        result.photo = result.photo ? byId.get(result.photo.toString()) || null : null;
        result.paymentQr = paymentQrToClient(profile.paymentQr);
    }
    if (result.documents) {
        result.documents = Object.fromEntries(
            Object.entries(result.documents).map(([key, id]) => [key, id ? byId.get(id.toString()) || null : null])
        );
    }
    return result;
};

// GET /api/profile/me — the logged-in user's own registration profile.
export const getMyProfile = async (req, res, next) => {
    try {
        const Model = PROFILE_MODELS[req.user.role];
        if (!Model) return res.json({ role: req.user.role, profile: null });

        const profile = await Model.findOne({ userId: req.user._id }).lean();
        if (!profile) return res.json({ role: req.user.role, profile: null });

        return res.json({ role: req.user.role, profile: await profileToClient(req.user, profile) });
    } catch (error) {
        return next(error);
    }
};

// PATCH /api/profile/school — school only. Changes only the editable fields sent
// (SCHOOL_PROFILE_EDITABLE); the verified identity fields are refused.
export const updateSchoolProfile = async (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ message: "Request body must be a JSON object." });
    const { errors, values, cleared } = validateSchoolProfileUpdate(body);
    if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors)[0], errors });
    if (!Object.keys(values).length && !cleared.length) return res.status(400).json({ message: "Nothing to update." });

    // Facilities are stored together under `infrastructure`.
    const path = (name) => (SCHOOL_FACILITY_FIELDS.includes(name) ? `infrastructure.${name}` : name);
    const update = {};
    if (Object.keys(values).length) update.$set = Object.fromEntries(Object.entries(values).map(([name, value]) => [path(name), value]));
    if (cleared.length) update.$unset = Object.fromEntries(cleared.map((name) => [path(name), ""]));

    try {
        const profile = await PROFILE_MODELS.school.findOneAndUpdate({ userId: req.user._id }, update, { returnDocument: "after" }).lean();
        if (!profile) return res.status(404).json({ message: "School profile not found." });
        // The principal's name is also the account name shown when signed in.
        if (values.principalName) await User.updateOne({ _id: req.user._id }, { $set: { name: values.principalName } });
        return res.json({ message: "Profile updated.", profile: await profileToClient(req.user, profile) });
    } catch (error) {
        return next(error);
    }
};

// PUT /api/profile/photo  (multipart, field "schoolPhoto") — school only.
export const replacePhoto = async (req, res, next) => {
    const rules = { [PHOTO_FIELD]: UPLOAD_RULES.school[PHOTO_FIELD] };
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: "Choose a photo to upload.", errors: { [PHOTO_FIELD]: "Choose a photo to upload." } });

    const { errors, accepted } = validateUploads(files, rules);
    if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors)[0], errors });

    let stored = {};
    try {
        stored = await storeUploads(req.user._id, accepted);
        const newFile = stored[PHOTO_FIELD];

        // Swap the reference first; the old file is removed only after the profile points at the new one.
        const previous = await PROFILE_MODELS.school.findOneAndUpdate(
            { userId: req.user._id },
            { $set: { photo: newFile._id } },
            { returnDocument: "before" }
        );
        if (!previous) {
            await deleteUploadedFiles([newFile]);
            return res.status(404).json({ message: "School profile not found." });
        }
        if (previous.photo) {
            const old = await UploadedFile.findOne({ _id: previous.photo, owner: req.user._id });
            await deleteUploadedFiles([old]);
        }

        return res.json({ message: "School photograph updated.", photo: fileSummary(newFile) });
    } catch (error) {
        await deleteUploadedFiles(Object.values(stored));
        return next(error);
    }
};

// DELETE /api/profile/photo — school only.
export const removePhoto = async (req, res, next) => {
    try {
        const previous = await PROFILE_MODELS.school.findOneAndUpdate(
            { userId: req.user._id },
            { $unset: { photo: "" } },
            { returnDocument: "before" }
        );
        if (!previous) return res.status(404).json({ message: "School profile not found." });
        if (previous.photo) {
            const old = await UploadedFile.findOne({ _id: previous.photo, owner: req.user._id });
            await deleteUploadedFiles([old]);
        }
        return res.json({ message: "School photograph removed.", photo: null });
    } catch (error) {
        return next(error);
    }
};
