import bcrypt from "bcryptjs";
import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import SchoolProfile from "../models/SchoolProfile.js";
import NGOProfile from "../models/NGOProfile.js";
import RevokedSession from "../models/RevokedSession.js";
import User from "../models/User.js";
import {
    EMAIL_PATTERN,
    PASSWORD_MAX_BYTES,
    PASSWORD_RESET_TOKEN_PATTERN,
    PASSWORD_RESET_TTL_MINUTES,
    PUBLIC_ROLES,
    ROLES,
    UDISE_PATTERN,
    UPLOAD_RULES,
    getAccountName,
    getMissingUploads,
    getPasswordError,
    getUnexpectedFields,
    normalizeEmail,
    pickProfileValues,
    validateRegistration,
} from "../../shared/registrationRules.js";
import { isEmailConfigured, sendPasswordResetEmail } from "../services/emailService.js";
import { GoogleTokenError, isGoogleSignInConfigured, verifyGoogleIdToken } from "../services/googleAuth.js";
import { PROFILE_MODELS, duplicateKeyError, toProfileDocument } from "../services/profileModels.js";
import { deleteUploadedFiles, storeUploads, validateUploads } from "../services/uploadService.js";
import { clearAuthCookie, getTokenFromRequest, safeUser, setAuthCookie, verifyToken } from "../utils/authToken.js";

const ROLE_LABELS = { donor: "Donor", school: "School", ngo: "NGO", admin: "Admin" };

const badRequest = (res, message, errors, extra = {}) => res.status(400).json({ message, ...(errors ? { errors } : {}), ...extra });

/**
 * Registration accepts either JSON, or multipart/form-data with:
 *   data = JSON string of the form values
 *   <upload field> = file (see UPLOAD_RULES)
 */
const readRegistrationBody = (req) => {
    if (!req.is("multipart/form-data")) {
        const body = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Request body must be a JSON object." };
        return { body };
    }
    const textFields = Object.keys(req.body || {});
    const unexpected = textFields.filter((name) => name !== "data");
    if (unexpected.length) return { error: `Unexpected field(s): ${unexpected.join(", ")}.` };
    try {
        const body = JSON.parse(req.body?.data ?? "{}");
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
        return { body };
    } catch {
        return { error: "Registration data must be valid JSON." };
    }
};

export const register = async (req, res, next) => {
    const { body, error: bodyError } = readRegistrationBody(req);
    if (bodyError) return badRequest(res, bodyError);

    // The server decides which roles may self-register and every account status.
    const role = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
    if (role === "admin") return badRequest(res, "Admin accounts cannot be registered.", { role: "Admin accounts cannot be registered." });
    if (!PUBLIC_ROLES.includes(role)) return badRequest(res, "Role must be donor, school, or ngo.", { role: "Role must be donor, school, or ngo." });

    // Mass-assignment protection: only fields shown on that role's form are accepted.
    const unexpected = getUnexpectedFields(role, body);
    if (unexpected.length) {
        return badRequest(res, `Unexpected field(s): ${unexpected.join(", ")}.`, Object.fromEntries(unexpected.map((f) => [f, "This field is not allowed."])));
    }

    const { errors, values, firstErrorStep } = validateRegistration(role, body);
    const uploadRules = UPLOAD_RULES[role];
    const { errors: uploadErrors, accepted } = validateUploads(req.files || [], uploadRules);
    for (const missing of getMissingUploads(role, accepted.map((f) => f.field), uploadRules)) uploadErrors[missing.field] = missing.message;

    const allErrors = { ...errors, ...uploadErrors };
    if (Object.keys(allErrors).length) {
        const uploadSteps = Object.keys(uploadErrors).map((f) => uploadRules[f]?.step ?? 0);
        const step = Math.min(...[firstErrorStep, ...uploadSteps].filter((s) => s !== null && s !== undefined));
        return badRequest(res, Object.values(allErrors)[0], allErrors, { step });
    }

    const email = values.email;
    let user;
    let storedFiles = {};
    try {
        // Friendly duplicate checks first; unique indexes below still catch races.
        if (await User.exists({ email })) {
            return res.status(409).json({ message: "An account with this email already exists.", errors: { email: "An account with this email already exists." } });
        }
        if (role === "school" && (await SchoolProfile.exists({ udise: values.udise }))) {
            return res.status(409).json({ message: "A school with this UDISE code is already registered.", errors: { udise: "A school with this UDISE code is already registered." } });
        }
        if (role === "ngo" && (await NGOProfile.exists({ pan: values.pan }))) {
            return res.status(409).json({ message: "An NGO with this PAN is already registered.", errors: { pan: "An NGO with this PAN is already registered." } });
        }

        user = await User.create({
            name: getAccountName(role, values),
            email,
            password: values.password,
            role,
            // Every new account (school, NGO or donor) is verified by an admin before it can log in.
            accountStatus: "pending",
        });

        storedFiles = await storeUploads(user._id, accepted);

        const profile = { ...toProfileDocument(role, pickProfileValues(role, values)), userId: user._id };
        if (role !== "donor") profile.email = email; // School/NGO profiles keep their official email.
        for (const [field, doc] of Object.entries(storedFiles)) {
            const [first, second] = uploadRules[field].profilePath.split(".");
            if (second) profile[first] = { ...(profile[first] || {}), [second]: doc._id };
            else profile[first] = doc._id;
        }
        await PROFILE_MODELS[role].create(profile);

        return res.status(201).json({
            message: "Registration submitted. Your account is pending admin approval.",
            user: safeUser(user),
        });
    } catch (error) {
        // Roll back everything this request created so no half-registered account remains.
        await deleteUploadedFiles(Object.values(storedFiles));
        if (user?._id) await User.deleteOne({ _id: user._id }).catch(() => {});

        if (error.code === 11000) {
            const { field, message } = duplicateKeyError(error);
            return res.status(409).json({ message, errors: { [field]: message } });
        }
        return next(error);
    }
};

// A real bcrypt hash of a random string, compared against when the email is unknown
// so "unknown email" and "wrong password" take about the same time.
let dummyHashPromise;
const getDummyHash = () => (dummyHashPromise ||= bcrypt.hash(`no-user-${Math.random()}`, 12));

const findUserForLogin = async (identifier, portalRole) => {
    if (EMAIL_PATTERN.test(identifier)) return User.findOne({ email: identifier }).select("+password");
    // The school portal also accepts the 11-digit UDISE code.
    if (portalRole === "school" && UDISE_PATTERN.test(identifier)) {
        const profile = await SchoolProfile.findOne({ udise: identifier }).select("userId");
        return profile ? User.findById(profile.userId).select("+password") : null;
    }
    return undefined;
};

// Once someone has proven who they are (password or Google), explain why they can't continue, if they can't.
const refuseSignIn = (res, user, portalRole) => {
    if (portalRole && user.role !== portalRole) {
        return res.status(403).json({
            code: "WRONG_PORTAL",
            role: user.role,
            message: `This is a ${ROLE_LABELS[user.role]} account. Please use the ${ROLE_LABELS[user.role]} login page.`,
        });
    }
    if (user.accountStatus === "pending") {
        return res.status(403).json({ code: "ACCOUNT_PENDING", message: "Your account is pending admin approval. You can log in once it has been approved." });
    }
    if (user.accountStatus === "rejected") {
        return res.status(403).json({
            code: "ACCOUNT_REJECTED",
            reason: user.rejectionReason || null,
            message: `Your registration was rejected${user.rejectionReason ? `: ${user.rejectionReason}` : "."} Please contact VIDYADAAN support.`,
        });
    }
    return null;
};

export const login = async (req, res, next) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const identifier = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const portalRole = body.role === undefined ? undefined : body.role;

    if (portalRole !== undefined && !ROLES.includes(portalRole)) return badRequest(res, "Unknown login portal.");
    if (!identifier || !password) {
        return badRequest(res, portalRole === "school" ? "Email / UDISE code and password are required." : "Email and password are required.");
    }

    try {
        const user = await findUserForLogin(identifier, portalRole);
        if (user === undefined) {
            return badRequest(res, portalRole === "school" ? "Enter a valid email address or 11-digit UDISE code." : "Enter a valid email address.");
        }

        const passwordFits = Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES;
        let passwordOk = false;
        // Google-only accounts have no password; they take the same slow path as an unknown email.
        if (user?.password && passwordFits) {
            passwordOk = await user.verifyPassword(password);
        } else {
            await bcrypt.compare(password.slice(0, PASSWORD_MAX_BYTES), await getDummyHash());
        }
        if (!user || !passwordOk) {
            return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
        }

        // The password was correct, so it is safe to explain why login cannot continue.
        const refused = refuseSignIn(res, user, portalRole);
        if (refused) return refused;

        setAuthCookie(res, user, body.remember === true);
        return res.status(200).json({ message: "Login successful.", user: safeUser(user) });
    } catch (error) {
        return next(error);
    }
};

export const me = (req, res) => res.status(200).json({ user: safeUser(req.user) });

export const logout = async (req, res, next) => {
    try {
        // Ends this device's session only; a copied cookie stops working too. Security events
        // (password reset, linking Google, rejection) still sign out every device via tokenVersion.
        const payload = verifyToken(getTokenFromRequest(req));
        if (payload?.sid) {
            await RevokedSession.updateOne(
                { sid: payload.sid },
                { $max: { expiresAt: new Date(payload.exp * 1000) } },
                { upsert: true }
            );
        } else if (payload?.userId) {
            // Sessions issued before per-device sign-out have no id: fall back to signing out everywhere.
            await User.updateOne({ _id: payload.userId }, { $inc: { tokenVersion: 1 } });
        }
        clearAuthCookie(res);
        return res.status(200).json({ message: "Logged out successfully." });
    } catch (error) {
        clearAuthCookie(res);
        return next(error);
    }
};

// ─── Sign in with Google ─────────────────────────────────────────────────────
// Sign-in only: every account is created through its registration form (with documents) and
// approved by an admin first. The admin console is password-only.
export const googleLogin = async (req, res, next) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const portalRole = body.role;
    const credential = typeof body.credential === "string" ? body.credential : "";

    if (portalRole === "admin") return badRequest(res, "Google sign-in isn't available for the admin console.");
    if (!PUBLIC_ROLES.includes(portalRole)) return badRequest(res, "Unknown login portal.");
    if (!credential || credential.length > 4096) return badRequest(res, "Google didn't send your sign-in details. Please try again.");
    if (!isGoogleSignInConfigured()) {
        return res.status(503).json({ code: "GOOGLE_UNAVAILABLE", message: "Google sign-in isn't set up yet. Please sign in with your email and password." });
    }

    let google;
    try {
        google = await verifyGoogleIdToken(credential);
    } catch (error) {
        if (error instanceof GoogleTokenError) {
            return res.status(401).json({ code: "GOOGLE_TOKEN_INVALID", message: "Google sign-in didn't work. Please try again." });
        }
        console.error("Google sign-in unavailable:", error.message);
        return res.status(503).json({ code: "GOOGLE_UNAVAILABLE", message: "Google sign-in isn't available right now. Please try again, or use your email and password." });
    }

    try {
        const user =
            (await User.findOne({ googleId: google.googleId }).select("+password")) ||
            (await User.findOne({ email: google.email }).select("+password"));

        if (!user) {
            return res.status(404).json({
                code: "GOOGLE_NO_ACCOUNT",
                message: `There's no ${ROLE_LABELS[portalRole]} account for ${google.email}. Register first, or sign in with your email and password.`,
            });
        }

        if (user.googleId && user.googleId !== google.googleId) {
            return res.status(409).json({
                code: "GOOGLE_ACCOUNT_MISMATCH",
                message: "This VIDYADAAN account is linked to a different Google account. Sign in with that Google account instead.",
            });
        }
        const refused = refuseSignIn(res, user, portalRole);
        if (refused) return refused;

        // First Google sign-in for an existing account: link it. Registration never proved that whoever set
        // the password owned this email, so that password is removed and every other session is signed out.
        const linked = !user.googleId;
        if (linked) {
            user.googleId = google.googleId;
            if (user.password) {
                user.password = undefined;
                user.tokenVersion = (user.tokenVersion ?? 0) + 1;
            }
            await user.save();
        }

        setAuthCookie(res, user, body.remember === true);
        return res.status(200).json({ message: "Login successful.", user: safeUser(user), linked });
    } catch (error) {
        return next(error);
    }
};

// ─── Forgot / reset password ─────────────────────────────────────────────────
const RESET_TTL_MS = PASSWORD_RESET_TTL_MINUTES * 60 * 1000;
// At most one reset email per account per minute, however many IP addresses ask.
const RESET_EMAIL_COOLDOWN_MS = 60 * 1000;
const FORGOT_PASSWORD_MESSAGE = "If an account exists for this email, a password reset link has been sent.";
const INVALID_RESET_LINK = {
    code: "INVALID_RESET_TOKEN",
    message: "This password reset link is invalid or has expired. Please request a new one.",
};

const hashResetToken = (token) => createHash("sha256").update(token).digest("hex");

// Not awaited by the request, so the response time does not reveal whether the account exists.
const deliverResetEmail = async (user, token, frontendOrigin) => {
    try {
        await sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetUrl: `${frontendOrigin}/reset-password/${token}`,
            expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
        });
    } catch (error) {
        // Never log the link or token. Drop the undelivered token so the user can ask again right away.
        console.error("Password reset email could not be sent:", error.message);
        await User.updateOne(
            { _id: user._id, passwordResetToken: hashResetToken(token) },
            { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } }
        ).catch(() => {});
    }
};

export const forgotPassword = async (req, res, next) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return badRequest(res, "Email address is required.", { email: "Email address is required." });
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
        return badRequest(res, "Enter a valid email address.", { email: "Enter a valid email address." });
    }
    // Checked before any lookup, so every email address gets the same answer.
    if (!isEmailConfigured()) {
        return res.status(503).json({
            code: "EMAIL_UNAVAILABLE",
            message: "Password reset emails are unavailable right now. Please try again later or contact VIDYADAAN support.",
        });
    }

    try {
        const user = await User.findOne({ email }).select("+passwordResetExpires");
        // A token's expiry minus its lifetime is when it was issued.
        const lastSentAt = user?.passwordResetExpires ? user.passwordResetExpires.getTime() - RESET_TTL_MS : 0;
        if (user && Date.now() - lastSentAt >= RESET_EMAIL_COOLDOWN_MS) {
            const token = randomBytes(32).toString("hex");
            await User.updateOne(
                { _id: user._id },
                { $set: { passwordResetToken: hashResetToken(token), passwordResetExpires: new Date(Date.now() + RESET_TTL_MS) } }
            );
            deliverResetEmail(user, token, req.app.locals.frontendOrigin);
        }
        return res.status(200).json({ message: FORGOT_PASSWORD_MESSAGE });
    } catch (error) {
        return next(error);
    }
};

export const resetPassword = async (req, res, next) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!password || !confirmPassword) {
        const errors = {};
        if (!password) errors.password = "New password is required.";
        if (!confirmPassword) errors.confirmPassword = "Please confirm your new password.";
        return badRequest(res, Object.values(errors)[0], errors);
    }
    const passwordError = getPasswordError(password);
    if (passwordError) return badRequest(res, passwordError, { password: passwordError });
    if (password !== confirmPassword) return badRequest(res, "Passwords do not match.", { confirmPassword: "Passwords do not match." });

    const { token } = req.params;
    if (!PASSWORD_RESET_TOKEN_PATTERN.test(token)) return res.status(400).json(INVALID_RESET_LINK);

    try {
        // Claim the token atomically: if the link is submitted twice at once, only one request succeeds.
        const user = await User.findOneAndUpdate(
            { passwordResetToken: hashResetToken(token), passwordResetExpires: { $gt: new Date() } },
            { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } }
        );
        if (!user) return res.status(400).json(INVALID_RESET_LINK);

        // Plain text here: the pre-save hook hashes it exactly once, the same way registration does.
        user.password = password;
        // Sign the account out on every device, in case someone else had access.
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
        await user.save();

        return res.status(200).json({ message: "Your password has been reset. You can now sign in with your new password." });
    } catch (error) {
        return next(error);
    }
};
