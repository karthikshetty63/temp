import mongoose from "mongoose";
import { FUNDING_PARTS } from "../../shared/projectRules.js";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "../../shared/paymentRules.js";

// A payment an NGO made to a school for one or more of its committed parts, with proof. Validation
// lives in shared/paymentRules.js; these are the database's own guarantees.
const fundingPaymentSchema = new mongoose.Schema(
    {
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
        // The project's school (the one that confirms it) and the NGO that paid.
        school: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        ngo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        parts: { type: [{ type: Number, min: 1, max: FUNDING_PARTS }], required: true },
        // The exact sum of those parts, worked out by the server.
        amount: { type: Number, required: true, min: 1 },
        method: { type: String, required: true, enum: PAYMENT_METHODS },
        // UTR / transaction ID / cheque number, normalised (see normalizeReference).
        reference: { type: String, required: true, trim: true, maxlength: 40 },
        paidOn: { type: Date, required: true },
        note: { type: String, trim: true, maxlength: 300, default: "" },
        // The challan, receipt or screenshot (owned by the NGO; the school may view it).
        proof: { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile", required: true },

        status: { type: String, enum: PAYMENT_STATUSES, default: "SUBMITTED" },
        submittedAt: { type: Date, required: true },
        reviewedAt: { type: Date },
        rejectionReason: { type: String, trim: true, maxlength: 300 },
    },
    { timestamps: true }
);

// The NGO's own history and the school's list, newest first.
fundingPaymentSchema.index({ ngo: 1, submittedAt: -1 });
fundingPaymentSchema.index({ school: 1, submittedAt: -1 });
// Who may view a proof file.
fundingPaymentSchema.index({ proof: 1 });

const FundingPayment = mongoose.models.FundingPayment || mongoose.model("FundingPayment", fundingPaymentSchema);

export default FundingPayment;
