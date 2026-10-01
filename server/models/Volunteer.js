import mongoose from "mongoose";

// A volunteer an NGO manages. Validation lives in shared/volunteerRules.js; these are the
// database's own guarantees.
const volunteerSchema = new mongoose.Schema(
    {
        ngo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: true, trim: true, maxlength: 80 },
        role: { type: String, required: true, trim: true, maxlength: 60 },
        phone: { type: String, trim: true, default: "" },
        // One of the needs the NGO has committed to fund, or none.
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    },
    { timestamps: true }
);

// An NGO's own list, newest first.
volunteerSchema.index({ ngo: 1, createdAt: -1 });

const Volunteer = mongoose.models.Volunteer || mongoose.model("Volunteer", volunteerSchema);

export default Volunteer;
