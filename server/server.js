import dotenv from "dotenv";
import process from "node:process";
import createApp from "./app.js";
import connectDB from "./config/db.js";
import { isEmailConfigured, verifyEmailTransport } from "./services/emailService.js";
import { isGoogleSignInConfigured } from "./services/googleAuth.js";
import { isLiveKeyConfigured, isRazorpayConfigured } from "./services/razorpay.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing from the project root .env file");
        }
        if (process.env.JWT_SECRET.length < 32) {
            console.warn("Warning: JWT_SECRET is shorter than 32 characters. Use a long random value.");
        }
        await connectDB();

        const app = createApp({
            corsOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
            trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : undefined,
        });
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });

        // Email is optional for starting the server; without it, forgot-password answers 503.
        if (!isEmailConfigured()) {
            console.warn("Email is not configured (SMTP_HOST / EMAIL_FROM). Password reset emails are disabled.");
        } else {
            verifyEmailTransport()
                .then(() => console.log("Email (SMTP) connection verified"))
                .catch((error) => console.warn("Email (SMTP) connection failed:", error.message));
        }
        console.log(
            isGoogleSignInConfigured()
                ? "Google sign-in: enabled"
                : "Google sign-in is not configured (VITE_GOOGLE_CLIENT_ID). The Google button stays hidden."
        );
        if (isRazorpayConfigured()) console.log("Donations: Razorpay test mode enabled");
        else if (isLiveKeyConfigured()) console.warn("Donations are off: RAZORPAY_KEY_ID is a live key. Only test keys (rzp_test_…) are accepted for now.");
        else console.warn("Donations are off: set RAZORPAY_KEY_ID (a rzp_test_ key) and RAZORPAY_KEY_SECRET in .env.");
    } catch (error) {
        console.error("Server failed to start:", error.message);
        process.exit(1);
    }
};

startServer();
