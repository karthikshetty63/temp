import mongoose from "mongoose";
import { DONATION_CURRENCY, DONATION_STATUSES } from "../../shared/donationRules.js";

// A donor's online donation to one approved project, paid through Razorpay. Not the same as an NGO's
// FundingPayment (a bank transfer the school confirms by hand): a donation counts only once the
// server has verified Razorpay's payment signature. Validation lives in shared/donationRules.js;
// these are the database's own guarantees.
//
// Card numbers, CVV, UPI PINs and bank log-ins never reach VIDYADAAN (Razorpay Checkout collects
// them), and the Razorpay key secret stays in the server's environment. None of them is stored here.
const donationSchema = new mongoose.Schema(
    {
        donor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
        // The project's school (who the money is for), fixed when the donation starts.
        school: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        // Whole rupees, like Project.budget and Project.raised. Razorpay is sent paise (× 100).
        amount: {
            type: Number,
            required: true,
            min: 1,
            validate: { validator: Number.isInteger, message: "A donation is a whole number of rupees." },
        },
        currency: { type: String, enum: [DONATION_CURRENCY], default: DONATION_CURRENCY },
        provider: { type: String, enum: ["razorpay"], default: "razorpay" },
        // "test": Razorpay test mode, no real money moved. Kept so test donations can always be told apart.
        mode: { type: String, enum: ["test", "live"], required: true },
        // The Razorpay order this server created (it fixes the amount) and, once verified, the payment that paid it.
        orderId: { type: String, required: true, unique: true },
        paymentId: { type: String },
        status: { type: String, enum: DONATION_STATUSES, default: "CREATED" },
        // When the server verified Razorpay's signature for the payment.
        verifiedAt: { type: Date },
    },
    { timestamps: true }
);

// One donation per Razorpay payment, however many times it is verified.
donationSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: "string" } } });
// A donor's own donations, newest first.
donationSchema.index({ donor: 1, createdAt: -1 });
// What donors have given to a project.
donationSchema.index({ project: 1, status: 1 });

const Donation = mongoose.models.Donation || mongoose.model("Donation", donationSchema);

export default Donation;
