// Builds the Express application. Kept separate from server.js (which loads .env,
// connects to MongoDB and listens) so the automated tests can create the exact same
// app against a throwaway database.
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";
import adminRoutes from "./routes/adminRoutes.js";
import createApprovedProjectRouter from "./routes/approvedProjectRoutes.js";
import createAuthRouter from "./routes/authRoutes.js";
import createDonationRouter from "./routes/donationRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import ngoRoutes from "./routes/ngoRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import schoolCommitmentRoutes from "./routes/schoolCommitmentRoutes.js";
import schoolPaymentRoutes from "./routes/schoolPaymentRoutes.js";
import schoolPhotoRoutes from "./routes/schoolPhotoRoutes.js";
import schoolProjectRoutes from "./routes/schoolProjectRoutes.js";

const DEFAULT_RATE_LIMITS = {
    // Counts only failed attempts: 10 wrong passwords per 15 minutes per IP.
    login: { windowMs: 15 * 60 * 1000, limit: 10 },
    register: { windowMs: 60 * 60 * 1000, limit: 20 },
    // Each request can send an email, so this is kept tight: 5 per 15 minutes per IP.
    forgotPassword: { windowMs: 15 * 60 * 1000, limit: 5 },
    resetPassword: { windowMs: 15 * 60 * 1000, limit: 10 },
    // Each new donation is a request to Razorpay: 20 per 15 minutes per donor.
    donationOrders: { windowMs: 15 * 60 * 1000, limit: 20 },
    // The same for an NGO paying its parts online: 20 per 15 minutes per NGO.
    ngoOnlineOrders: { windowMs: 15 * 60 * 1000, limit: 20 },
};

const makeLimiter = (config, message, options = {}) =>
    config
        ? rateLimit({
            windowMs: config.windowMs,
            limit: config.limit,
            standardHeaders: "draft-8",
            legacyHeaders: false,
            message: { message },
            ...options,
        })
        : (_req, _res, next) => next();

/**
 * @param {object} [options]
 * @param {string} [options.corsOrigin] the React app's origin (cookies are only accepted from it)
 * @param {false|{login?:object, register?:object, forgotPassword?:object, resetPassword?:object, donationOrders?:object, ngoOnlineOrders?:object}} [options.rateLimits] false disables limits (tests)
 * @param {string|number|boolean} [options.trustProxy] set when running behind a reverse proxy
 */
export const createApp = ({ corsOrigin = "http://localhost:5173", rateLimits = DEFAULT_RATE_LIMITS, trustProxy } = {}) => {
    const app = express();
    if (trustProxy !== undefined) app.set("trust proxy", trustProxy);
    // Links in emails point at the configured React app — never at the request's Host header.
    app.locals.frontendOrigin = corsOrigin.replace(/\/+$/, "");

    const limits = rateLimits === false ? {} : { ...DEFAULT_RATE_LIMITS, ...rateLimits };

    // Security headers. Resource policy "same-site" lets the React dev server (another port) read API responses.
    app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
    app.use(cors({ origin: corsOrigin, credentials: true }));
    app.use(express.json({ limit: "100kb" }));

    app.get("/api/test", (_req, res) => {
        res.json({ message: "Vidyaadaan API is working" });
    });

    app.use("/api/auth", createAuthRouter({
        loginLimiter: makeLimiter(limits.login, "Too many failed login attempts. Please wait 15 minutes and try again.", { skipSuccessfulRequests: true }),
        registerLimiter: makeLimiter(limits.register, "Too many registration attempts. Please try again later."),
        forgotPasswordLimiter: makeLimiter(limits.forgotPassword, "Too many password reset requests. Please wait 15 minutes and try again."),
        resetPasswordLimiter: makeLimiter(limits.resetPassword, "Too many password reset attempts. Please wait 15 minutes and try again."),
    }));
    app.use("/api/admin", adminRoutes);
    app.use("/api/profile", profileRoutes);
    app.use("/api/files", fileRoutes);
    app.use("/api/school/projects", schoolProjectRoutes);
    app.use("/api/school/photos", schoolPhotoRoutes);
    app.use("/api/school/commitments", schoolCommitmentRoutes);
    app.use("/api/school/payments", schoolPaymentRoutes);
    app.use("/api/projects", createApprovedProjectRouter({
        // Counted per signed-in NGO (the router checks who it is before this runs).
        onlineOrderLimiter: makeLimiter(limits.ngoOnlineOrders, "Too many payment attempts. Please wait a few minutes and try again.", {
            keyGenerator: (req) => req.user._id.toString(),
        }),
    }));
    app.use("/api/ngo", ngoRoutes);
    app.use("/api/donations", createDonationRouter({
        // Counted per signed-in donor (the router checks who it is before this runs).
        orderLimiter: makeLimiter(limits.donationOrders, "Too many donation attempts. Please wait a few minutes and try again.", {
            keyGenerator: (req) => req.user._id.toString(),
        }),
    }));

    app.use("/api", apiNotFound);
    app.use(errorHandler);

    return app;
};

export default createApp;
