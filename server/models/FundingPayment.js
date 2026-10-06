import mongoose from "mongoose";
import { FUNDING_PARTS } from "../../shared/projectRules.js";
import { ONLINE_PAYMENT_METHOD, ONLINE_PAYMENT_STATUSES, PAYMENT_CHANNELS, PAYMENT_METHODS, PAYMENT_STATUSES } from "../../shared/paymentRules.js";

// A payment an NGO made for one or more of its committed parts: either DIRECT to the school, with
// proof, or ONLINE to VIDYADAAN through Razorpay (see shared/paymentRules.js). Validation lives in
// shared/paymentRules.js; these are the database's own guarantees.
const isDirect = function () {
    return this.channel !== "ONLINE";
};

const fundingPaymentSchema = new mongoose.Schema(
    {
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
        // The project's school (the one that confirms it) and the NGO that paid.
        school: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        ngo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        parts: { type: [{ type: Number, min: 1, max: FUNDING_PARTS }], required: true },
        // The exact sum of those parts, worked out by the server.
        amount: { type: Number, required: true, min: 1 },
        channel: { type: String, enum: PAYMENT_CHANNELS, default: "DIRECT" },
        method: { type: String, required: true, enum: [...PAYMENT_METHODS, ONLINE_PAYMENT_METHOD] },
        // UTR / transaction ID / cheque number, normalised (see normalizeReference). Online: the
        // Razorpay order ID until it is paid, then the Razorpay payment ID.
        reference: { type: String, required: true, trim: true, maxlength: 40 },
        paidOn: { type: Date, required: true },
        note: { type: String, trim: true, maxlength: 300, default: "" },
        // The challan, receipt or screenshot (owned by the NGO; the school may view it). Direct payments only.
        proof: { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile", required: isDirect },

        // Online payments only. No card, UPI or bank details: Razorpay Checkout collects those.
        orderId: { type: String },
        razorpayPaymentId: { type: String },
        mode: { type: String, enum: ["test", "live"] },

        status: { type: String, enum: [...PAYMENT_STATUSES, ...ONLINE_PAYMENT_STATUSES], default: "SUBMITTED" },
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
// One payment record per Razorpay order, and a Razorpay payment can be recorded only once.
fundingPaymentSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: "string" } } });
fundingPaymentSchema.index({ razorpayPaymentId: 1 }, { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } });

const FundingPayment = mongoose.models.FundingPayment || mongoose.model("FundingPayment", fundingPaymentSchema);

export default FundingPayment;
