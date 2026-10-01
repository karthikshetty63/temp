import mongoose from "mongoose";
import { FUNDING_PARTS, PROJECT_CATEGORIES, PROJECT_PRIORITIES, PROJECT_REVIEW_STATUSES, PROJECT_STATUSES } from "../../shared/projectRules.js";

// One part of the budget that an NGO has committed to fund (see splitIntoParts).
const fundingPartSchema = new mongoose.Schema(
    {
        part: { type: Number, required: true, min: 1, max: FUNDING_PARTS },
        amount: { type: Number, required: true, min: 0 },
        ngo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        committedAt: { type: Date, required: true },
        // The NGO's payment (with proof) that covers this part, while the school hasn't accepted or
        // rejected it. A part with a payment can't be withdrawn or paid again.
        payment: { type: mongoose.Schema.Types.ObjectId, ref: "FundingPayment" },
        // Set when the school accepts that payment: the money has reached it.
        receivedAt: { type: Date },
    },
    { _id: false }
);

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
        // Money confirmed for this project, in whole rupees: NGO payments the school accepted
        // (paymentController) plus donor donations whose Razorpay payment the server verified
        // (donationController). Each is added exactly once. Never set from the browser.
        raised: { type: Number, default: 0, min: 0 },
        // The verified donations already included in `raised`. The increase and this list change in
        // one atomic update, so a donation can never be counted twice. Not loaded unless asked for.
        countedDonations: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
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

        // NGO funding commitments, at most one per part, sorted by part. Set by the server only, and
        // only on approved projects. The budget can't change once any part is taken or any donation is received.
        fundingParts: { type: [fundingPartSchema], default: [] },
    },
    { timestamps: true }
);

// A school's own list, newest first.
projectSchema.index({ school: 1, createdAt: -1 });
// The admin review queue and, later, the list of approved projects.
projectSchema.index({ reviewStatus: 1, submittedAt: 1 });
// The needs an NGO has committed to.
projectSchema.index({ "fundingParts.ngo": 1 });

/** Matches projects waiting for review, including records saved before review existed. */
export const PENDING_REVIEW_FILTER = { $or: [{ reviewStatus: "PENDING_REVIEW" }, { reviewStatus: { $exists: false } }] };

/**
 * The only way NGO, donor and public features may read projects: approved (OPEN) ones only.
 * The review condition is applied last, so a caller's filter can never widen it.
 */
projectSchema.statics.findVisibleToPublic = function findVisibleToPublic(filter = {}) {
    return this.find({ ...filter, reviewStatus: "OPEN" });
};
/** One approved project, with the same guarantee as findVisibleToPublic. */
projectSchema.statics.findOneVisibleToPublic = function findOneVisibleToPublic(filter = {}) {
    return this.findOne({ ...filter, reviewStatus: "OPEN" });
};

const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);

export default Project;
