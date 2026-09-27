import mongoose from "mongoose";
import { PROJECT_CATEGORIES, PROJECT_PRIORITIES, PROJECT_REVIEW_STATUSES, PROJECT_STATUSES } from "../../shared/projectRules.js";

// A school's infrastructure need. Validation lives in shared/projectRules.js; these are the
// database's own guarantees.
const projectSchema = new mongoose.Schema(
    {
        school: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        title: { type: String, required: true, trim: true, maxlength: 120 },
        category: { type: String, required: true, enum: PROJECT_CATEGORIES },
        problem: { type: String, required: true, trim: true, maxlength: 2000 },
        priority: { type: String, required: true, enum: PROJECT_PRIORITIES },
        budget: { type: Number, required: true, min: 0 },
        // Updated by donations later; never set from the browser.
        raised: { type: Number, default: 0, min: 0 },
        studentsBenefited: { type: Number, required: true, min: 1 },
        expectedCompletion: { type: Date, required: true },
        location: { type: String, trim: true, maxlength: 150, default: "" },
        materials: { type: [String], default: [] },
        status: { type: String, enum: PROJECT_STATUSES, default: "Open" },

        // Admin review — set by the server only. Records from before review existed have no
        // reviewStatus and are treated as PENDING_REVIEW (see PENDING_REVIEW_FILTER).
        reviewStatus: { type: String, enum: PROJECT_REVIEW_STATUSES, default: "PENDING_REVIEW" },
        rejectionReason: { type: String, trim: true, maxlength: 500 },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reviewedAt: { type: Date },
        // When the school last sent it for review (creation or resubmission after a rejection).
        // Set by the controller; older records fall back to createdAt.
        submittedAt: { type: Date },
    },
    { timestamps: true }
);

// A school's own list, newest first.
projectSchema.index({ school: 1, createdAt: -1 });
// The admin review queue and, later, the list of approved projects.
projectSchema.index({ reviewStatus: 1, submittedAt: 1 });

/** Matches projects waiting for review, including records saved before review existed. */
export const PENDING_REVIEW_FILTER = { $or: [{ reviewStatus: "PENDING_REVIEW" }, { reviewStatus: { $exists: false } }] };

/**
 * The only way NGO, donor and public features may read projects: approved (OPEN) ones only.
 * The review condition is applied last, so a caller's filter can never widen it.
 */
projectSchema.statics.findVisibleToPublic = function findVisibleToPublic(filter = {}) {
    return this.find({ ...filter, reviewStatus: "OPEN" });
};

const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);

export default Project;
