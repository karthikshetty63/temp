import mongoose from "mongoose";
import DonorProfile from "../models/DonorProfile.js";
import NGOProfile from "../models/NGOProfile.js";
import SchoolProfile from "../models/SchoolProfile.js";
import UploadedFile from "../models/UploadedFile.js";
import User from "../models/User.js";
import { ACCOUNT_STATUSES, APPROVAL_ROLES } from "../../shared/registrationRules.js";
import { fileSummary } from "../services/uploadService.js";

const PROFILE_BY_ROLE = { school: SchoolProfile, ngo: NGOProfile, donor: DonorProfile };
const REJECTION_REASON_MIN = 5;
const REJECTION_REASON_MAX = 500;

const accountSummary = (user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    statusChangedAt: user.statusChangedAt || null,
    rejectionReason: user.rejectionReason || null,
});

const organisationSummary = (role, profile) => {
    if (!profile) return { organisationName: null };
    const documentCount = Object.values(profile.documents || {}).filter(Boolean).length;
    if (role === "school") {
        return { organisationName: profile.schoolName, identifier: profile.udise, district: profile.district, state: profile.state, documentCount, hasPhoto: Boolean(profile.photo) };
    }
    if (role === "ngo") {
        return { organisationName: profile.ngoName, identifier: profile.regNumber, district: profile.district, state: profile.state, documentCount, hasPhoto: false };
    }
    // Donors are people, not organisations: show where they are.
    return { organisationName: null, identifier: null, district: profile.city, state: profile.state, documentCount, hasPhoto: false };
};

// GET /api/admin/accounts?role=school|ngo|donor|all&status=pending|active|rejected
export const listAccounts = async (req, res, next) => {
    const role = req.query.role ?? "all";
    const status = req.query.status ?? "pending";
    if (role !== "all" && !APPROVAL_ROLES.includes(role)) return res.status(400).json({ message: "role must be school, ngo, donor, or all." });
    if (!ACCOUNT_STATUSES.includes(status)) return res.status(400).json({ message: "status must be pending, active, or rejected." });

    try {
        const roles = role === "all" ? APPROVAL_ROLES : [role];
        const users = await User.find({ role: { $in: roles }, accountStatus: status }).sort({ createdAt: -1 }).limit(200);

        const ids = users.map((u) => u._id);
        const [schools, ngos, donors, pendingCounts] = await Promise.all([
            SchoolProfile.find({ userId: { $in: ids } }),
            NGOProfile.find({ userId: { $in: ids } }),
            DonorProfile.find({ userId: { $in: ids } }),
            User.aggregate([
                { $match: { role: { $in: APPROVAL_ROLES }, accountStatus: "pending" } },
                { $group: { _id: "$role", count: { $sum: 1 } } },
            ]),
        ]);
        const profiles = new Map([...schools, ...ngos, ...donors].map((p) => [p.userId.toString(), p]));

        return res.json({
            accounts: users.map((u) => ({ ...accountSummary(u), ...organisationSummary(u.role, profiles.get(u._id.toString())) })),
            pendingCounts: Object.fromEntries(APPROVAL_ROLES.map((r) => [r, pendingCounts.find((c) => c._id === r)?.count || 0])),
        });
    } catch (error) {
        return next(error);
    }
};

const findApprovalAccount = async (id) => {
    if (!mongoose.isValidObjectId(id)) return null;
    const user = await User.findById(id);
    return user && APPROVAL_ROLES.includes(user.role) ? user : null;
};

// GET /api/admin/accounts/:id — full registration details for review
export const getAccount = async (req, res, next) => {
    try {
        const user = await findApprovalAccount(req.params.id);
        if (!user) return res.status(404).json({ message: "Account not found." });

        const profile = await PROFILE_BY_ROLE[user.role].findOne({ userId: user._id }).lean();
        const fileIds = profile ? [profile.photo, ...Object.values(profile.documents || {})].filter(Boolean) : [];
        const files = await UploadedFile.find({ _id: { $in: fileIds } });
        const fileById = new Map(files.map((f) => [f._id.toString(), fileSummary(f)]));

        let details = null;
        if (profile) {
            const fields = { ...profile };
            for (const internal of ["_id", "__v", "userId", "photo", "documents"]) delete fields[internal];
            details = {
                ...fields,
                photo: profile.photo ? fileById.get(profile.photo.toString()) || null : null,
                documents: Object.fromEntries(Object.entries(profile.documents || {}).map(([key, id]) => [key, id ? fileById.get(id.toString()) || null : null])),
            };
        }

        return res.json({ account: accountSummary(user), profile: details });
    } catch (error) {
        return next(error);
    }
};

// PATCH /api/admin/accounts/:id/approve
export const approveAccount = async (req, res, next) => {
    try {
        const user = await findApprovalAccount(req.params.id);
        if (!user) return res.status(404).json({ message: "Account not found." });

        // Conditional update: only succeeds if the account is still pending/rejected.
        const updated = await User.findOneAndUpdate(
            { _id: user._id, accountStatus: { $in: ["pending", "rejected"] } },
            { $set: { accountStatus: "active", statusChangedAt: new Date(), statusChangedBy: req.user._id }, $unset: { rejectionReason: "" } },
            { returnDocument: "after" }
        );
        if (!updated) return res.status(409).json({ message: "This account is already active." });

        return res.json({ message: "Account approved. The user can now log in.", account: accountSummary(updated) });
    } catch (error) {
        return next(error);
    }
};

// PATCH /api/admin/accounts/:id/reject  { reason }
export const rejectAccount = async (req, res, next) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (reason.length < REJECTION_REASON_MIN || reason.length > REJECTION_REASON_MAX) {
        return res.status(400).json({ message: `Give a rejection reason between ${REJECTION_REASON_MIN} and ${REJECTION_REASON_MAX} characters.`, errors: { reason: "A clear reason is required." } });
    }

    try {
        const user = await findApprovalAccount(req.params.id);
        if (!user) return res.status(404).json({ message: "Account not found." });

        const updated = await User.findOneAndUpdate(
            { _id: user._id, accountStatus: { $in: ["pending", "active"] } },
            {
                $set: { accountStatus: "rejected", rejectionReason: reason, statusChangedAt: new Date(), statusChangedBy: req.user._id },
                // Ends any session the user may already have.
                $inc: { tokenVersion: 1 },
            },
            { returnDocument: "after" }
        );
        if (!updated) return res.status(409).json({ message: "This account is already rejected." });

        return res.json({ message: "Account rejected.", account: accountSummary(updated) });
    } catch (error) {
        return next(error);
    }
};
