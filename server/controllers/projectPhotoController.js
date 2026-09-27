import mongoose from "mongoose";
import Project from "../models/Project.js";
import ProjectPhoto from "../models/ProjectPhoto.js";
import UploadedFile from "../models/UploadedFile.js";
import { PROJECT_PHOTO_RULE, validatePhotoDetails } from "../../shared/projectRules.js";
import { deleteUploadedFiles, fileSummary, storeUploads, validateUploads } from "../services/uploadService.js";

const PHOTO_FIELD = "photo";
const RULES = { [PHOTO_FIELD]: PROJECT_PHOTO_RULE };
// Plenty for a real school's gallery; stops a runaway script from filling the disk.
const MAX_PHOTOS_PER_SCHOOL = 300;

const badRequest = (res, errors) => res.status(400).json({ message: Object.values(errors)[0], errors });

/** The only photo fields ever sent to the browser. `project` and `file` must be populated. */
const photoToClient = (photo) => ({
    id: photo._id.toString(),
    project: photo.project ? { id: photo.project._id.toString(), title: photo.project.title } : null,
    stage: photo.stage,
    caption: photo.caption,
    file: fileSummary(photo.file),
    createdAt: photo.createdAt,
});

// GET /api/school/photos — the signed-in school's own photos, newest first.
export const listMyPhotos = async (req, res, next) => {
    try {
        const photos = await ProjectPhoto.find({ school: req.user._id })
            .sort({ createdAt: -1, _id: -1 })
            .populate("project", "title")
            .populate("file")
            .lean();
        return res.json({ photos: photos.map(photoToClient) });
    } catch (error) {
        return next(error);
    }
};

// POST /api/school/photos  (multipart: file "photo" + fields projectId, stage, caption)
export const uploadPhoto = async (req, res, next) => {
    const { errors, values } = validatePhotoDetails(req.body);
    const files = req.files || [];
    if (!files.length) errors[PHOTO_FIELD] = "Choose a photo to upload.";
    if (Object.keys(errors).length) return badRequest(res, errors);

    // Real file type from the bytes, 5 MB limit, one photo, no other file fields.
    const { errors: fileErrors, accepted } = validateUploads(files, RULES);
    if (Object.keys(fileErrors).length) return badRequest(res, fileErrors);

    let stored = {};
    try {
        // Only the school's own project; anyone else's looks like it doesn't exist.
        const project = mongoose.isValidObjectId(values.projectId)
            ? await Project.findOne({ _id: values.projectId, school: req.user._id }).select("title").lean()
            : null;
        if (!project) return badRequest(res, { projectId: "Choose one of your projects." });

        if ((await ProjectPhoto.countDocuments({ school: req.user._id })) >= MAX_PHOTOS_PER_SCHOOL) {
            return res.status(409).json({ message: `A school can have at most ${MAX_PHOTOS_PER_SCHOOL} photos. Delete some to add more.` });
        }

        stored = await storeUploads(req.user._id, accepted);
        const photo = await ProjectPhoto.create({
            school: req.user._id,
            project: project._id,
            file: stored[PHOTO_FIELD]._id,
            stage: values.stage,
            caption: values.caption,
        });
        return res.status(201).json({
            message: "Photo added.",
            photo: photoToClient({ ...photo.toObject(), project, file: stored[PHOTO_FIELD] }),
        });
    } catch (error) {
        await deleteUploadedFiles(Object.values(stored));
        return next(error);
    }
};

// DELETE /api/school/photos/:id — removes the photo and its file.
export const deletePhoto = async (req, res, next) => {
    try {
        const photo = mongoose.isValidObjectId(req.params.id)
            ? await ProjectPhoto.findOneAndDelete({ _id: req.params.id, school: req.user._id })
            : null;
        if (!photo) return res.status(404).json({ message: "Photo not found." });

        const file = await UploadedFile.findOne({ _id: photo.file, owner: req.user._id });
        await deleteUploadedFiles([file]);
        return res.json({ message: "Photo deleted." });
    } catch (error) {
        return next(error);
    }
};
