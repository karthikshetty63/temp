import mongoose from "mongoose";
import { UPI_QR_STATUSES } from "../../shared/upiQrRules.js";

const fileRef = { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile" };

// The school's UPI payment QR (shared/upiQrRules.js). Only the link read from the QR is stored —
// never the image — and the app draws the QR again from it, so NGOs scan exactly what was checked.
const paymentQrSchema = new mongoose.Schema(
    {
        link: { type: String, required: true },
        upiId: { type: String, required: true },
        payeeName: String,
        status: { type: String, enum: UPI_QR_STATUSES, required: true },
        submittedAt: { type: Date, required: true },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reviewedAt: Date,
        rejectionReason: String,
    },
    { _id: false }
);

const schoolProfileSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        schoolName: String,
        udise: String,
        address: String,
        district: String,
        state: String,
        principalName: String,
        email: String,
        phone: String,
        students: Number,
        teachers: Number,
        infrastructure: {
            hasToilets: Boolean,
            hasLibrary: Boolean,
            hasComputers: Boolean,
            hasDrinkingWater: Boolean,
        },
        bankAccount: String,
        ifsc: String,
        upi: String,
        paymentQr: paymentQrSchema,
        // School Photograph (shown on the school's dashboard/profile).
        photo: fileRef,
        // Private verification documents (owner + admin only).
        documents: {
            registrationCertificate: fileRef,
            principalIdProof: fileRef,
        },
    },
    { timestamps: true }
);

// One account per UDISE code. Partial so older records without a UDISE don't collide.
schoolProfileSchema.index(
    { udise: 1 },
    { unique: true, partialFilterExpression: { udise: { $type: "string", $gt: "" } } }
);

const SchoolProfile = mongoose.models.SchoolProfile || mongoose.model("SchoolProfile", schoolProfileSchema);

export default SchoolProfile;
