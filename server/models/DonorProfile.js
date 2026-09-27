import mongoose from "mongoose";

const donorProfileSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        phone: String,
        dob: Date,
        address: String,
        city: String,
        state: String,
        pin: String,
        causes: [String],
        frequency: String,
        anonymous: { type: Boolean, default: false },
        // Private verification documents (owner + admin only).
        documents: {
            panCard: { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile" },
        },
    },
    { timestamps: true }
);

const DonorProfile = mongoose.models.DonorProfile || mongoose.model("DonorProfile", donorProfileSchema);

export default DonorProfile;
