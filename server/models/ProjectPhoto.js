import mongoose from "mongoose";
import { PHOTO_CAPTION_MAX, PHOTO_STAGES } from "../../shared/projectRules.js";

// A photo a school added to one of its own projects (its gallery). The image itself is an
// UploadedFile, so it is private: only the school that uploaded it and admins can open it.
const projectPhotoSchema = new mongoose.Schema(
    {
        school: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
        file: { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile", required: true },
        stage: { type: String, required: true, enum: PHOTO_STAGES },
        caption: { type: String, trim: true, maxlength: PHOTO_CAPTION_MAX, default: "" },
    },
    { timestamps: true }
);

// A school's gallery, newest first; and later, one project's photos.
projectPhotoSchema.index({ school: 1, createdAt: -1 });
projectPhotoSchema.index({ project: 1, createdAt: -1 });

const ProjectPhoto = mongoose.models.ProjectPhoto || mongoose.model("ProjectPhoto", projectPhotoSchema);

export default ProjectPhoto;
