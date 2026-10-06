import mongoose from "mongoose";
import SchoolProfile from "../models/SchoolProfile.js";
import User from "../models/User.js";
import { UPI_QR_STATUSES, parseUpiQr, sameUpiId, validateUpiQrRejectionReason } from "../../shared/upiQrRules.js";

// A school's UPI payment QR (rules: shared/upiQrRules.js). The school saves or removes it; an admin
// approves or rejects one whose UPI ID isn't the one verified at registration. NGOs see it only while
// it is ACTIVE (paymentController.getPaymentDetails); donors never do.

const LIST_LIMIT = 200;

/** The stored QR → what the school or the admin sees (never who reviewed it). null when there is none. */
export const paymentQrToClient = (qr) =>
    qr
        ? {
              link: qr.link,
              upiId: qr.upiId,
              payeeName: qr.payeeName || "",
              status: qr.status,
              submittedAt: qr.submittedAt,
              reviewedAt: qr.reviewedAt || null,
              rejectionReason: qr.rejectionReason || null,
          }
        : null;

// ─── School ──────────────────────────────────────────────────────────────────

// PUT /api/profile/payment-qr  { link } — the text the browser read from the school's QR image
// (the image itself is never uploaded).
export const savePaymentQr = async (req, res, next) => {
    const { error, value } = parseUpiQr(req.body?.link);
    if (error) return res.status(400).json({ message: error, errors: { link: error } });
    try {
        const profile = await SchoolProfile.findOne({ userId: req.user._id }).select("upi paymentQr").lean();
        if (!profile) return res.status(404).json({ message: "School profile not found." });
        // The same QR again changes nothing (an approved QR stays approved).
        if (profile.paymentQr?.link === value.link && profile.paymentQr.status !== "REJECTED") {
            return res.json({ message: "This QR is already saved.", paymentQr: paymentQrToClient(profile.paymentQr) });
        }

        // Money to the UPI ID the admin verified at registration needs no second check; any other UPI ID does.
        const verified = sameUpiId(value.upiId, profile.upi);
        const paymentQr = { ...value, status: verified ? "ACTIVE" : "PENDING", submittedAt: new Date() };
        const updated = await SchoolProfile.findOneAndUpdate({ userId: req.user._id }, { $set: { paymentQr } }, { returnDocument: "after" }).lean();
        return res.json({
            message: verified
                ? "QR saved. NGOs paying your school can scan it now."
                : "QR saved. Its UPI ID isn't the one verified at registration, so the VIDYADAAN team will check it before NGOs see it.",
            paymentQr: paymentQrToClient(updated.paymentQr),
        });
    } catch (saveError) {
        return next(saveError);
    }
};

// DELETE /api/profile/payment-qr
export const removePaymentQr = async (req, res, next) => {
    try {
        const updated = await SchoolProfile.findOneAndUpdate({ userId: req.user._id }, { $unset: { paymentQr: "" } }, { returnDocument: "after" });
        if (!updated) return res.status(404).json({ message: "School profile not found." });
        return res.json({ message: "QR removed. NGOs will see only your bank details and UPI ID.", paymentQr: null });
    } catch (removeError) {
        return next(removeError);
    }
};

// ─── Admin ───────────────────────────────────────────────────────────────────

// GET /api/admin/payment-qrs?status=PENDING|ACTIVE|REJECTED
export const listPaymentQrs = async (req, res, next) => {
    const status = req.query.status ?? "PENDING";
    if (!UPI_QR_STATUSES.includes(status)) return res.status(400).json({ message: "status must be PENDING, ACTIVE or REJECTED." });
    try {
        // The review queue is first come, first served; decided QRs show the latest first.
        const sort = status === "PENDING" ? { "paymentQr.submittedAt": 1 } : { "paymentQr.reviewedAt": -1, "paymentQr.submittedAt": -1 };
        const [profiles, counts] = await Promise.all([
            SchoolProfile.find({ "paymentQr.status": status }).select("userId schoolName udise district state upi paymentQr").sort(sort).limit(LIST_LIMIT).lean(),
            SchoolProfile.aggregate([{ $match: { "paymentQr.status": { $in: UPI_QR_STATUSES } } }, { $group: { _id: "$paymentQr.status", count: { $sum: 1 } } }]),
        ]);
        const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } }).select("email accountStatus").lean();
        const userById = new Map(users.map((u) => [u._id.toString(), u]));
        return res.json({
            qrs: profiles.map((p) => {
                const user = userById.get(p.userId.toString());
                return {
                    school: {
                        id: p.userId.toString(),
                        name: p.schoolName,
                        udise: p.udise || null,
                        district: p.district || null,
                        state: p.state || null,
                        email: user?.email || null,
                        accountStatus: user?.accountStatus || null,
                    },
                    verifiedUpiId: p.upi || null,
                    matchesVerifiedUpi: sameUpiId(p.paymentQr.upiId, p.upi),
                    paymentQr: paymentQrToClient(p.paymentQr),
                };
            }),
            counts: Object.fromEntries(UPI_QR_STATUSES.map((s) => [s, counts.find((c) => c._id === s)?.count || 0])),
        });
    } catch (listError) {
        return next(listError);
    }
};

/** Why a decision didn't apply: no QR, the school replaced it since the admin looked, or it was already decided. */
const notDecidable = async (res, schoolId, link) => {
    const profile = await SchoolProfile.findOne({ userId: schoolId }).select("paymentQr").lean();
    if (!profile?.paymentQr) return res.status(404).json({ message: "This school has no payment QR." });
    if (profile.paymentQr.link !== link) {
        return res.status(409).json({ message: "The school has replaced this QR since you opened it. Review the new one.", paymentQr: paymentQrToClient(profile.paymentQr) });
    }
    return res.status(409).json({
        message: `This QR is not waiting for review (it is already ${profile.paymentQr.status === "ACTIVE" ? "approved" : "rejected"}).`,
        paymentQr: paymentQrToClient(profile.paymentQr),
    });
};

/**
 * The checks both decisions share. The admin sends back the link they reviewed, and the update applies
 * only while the school's QR is still that link and still waiting — so a QR the school swaps in after
 * the admin opened the page is never approved unseen.
 */
const readDecision = (req, res) => {
    if (!mongoose.isValidObjectId(req.params.schoolId)) {
        res.status(404).json({ message: "This school has no payment QR." });
        return null;
    }
    const link = typeof req.body?.link === "string" ? req.body.link.trim() : "";
    if (!link) {
        res.status(400).json({ message: "Send the QR link you reviewed.", errors: { link: "Send the QR link you reviewed." } });
        return null;
    }
    return { schoolId: req.params.schoolId, link };
};

// PATCH /api/admin/payment-qrs/:schoolId/approve  { link }
export const approvePaymentQr = async (req, res, next) => {
    const decision = readDecision(req, res);
    if (!decision) return undefined;
    try {
        const school = await User.findById(decision.schoolId).select("accountStatus").lean();
        if (school && school.accountStatus !== "active") {
            return res.status(409).json({ message: "This school's account is not active, so its QR can't be approved." });
        }
        const updated = await SchoolProfile.findOneAndUpdate(
            { userId: decision.schoolId, "paymentQr.status": "PENDING", "paymentQr.link": decision.link },
            { $set: { "paymentQr.status": "ACTIVE", "paymentQr.reviewedBy": req.user._id, "paymentQr.reviewedAt": new Date() }, $unset: { "paymentQr.rejectionReason": "" } },
            { returnDocument: "after" }
        ).lean();
        if (!updated) return notDecidable(res, decision.schoolId, decision.link);
        return res.json({ message: "QR approved. NGOs paying this school can scan it now.", paymentQr: paymentQrToClient(updated.paymentQr) });
    } catch (approveError) {
        return next(approveError);
    }
};

// PATCH /api/admin/payment-qrs/:schoolId/reject  { link, reason }
export const rejectPaymentQr = async (req, res, next) => {
    const { error, value: reason } = validateUpiQrRejectionReason(req.body?.reason);
    if (error) return res.status(400).json({ message: error, errors: { reason: error } });
    const decision = readDecision(req, res);
    if (!decision) return undefined;
    try {
        const updated = await SchoolProfile.findOneAndUpdate(
            { userId: decision.schoolId, "paymentQr.status": "PENDING", "paymentQr.link": decision.link },
            { $set: { "paymentQr.status": "REJECTED", "paymentQr.rejectionReason": reason, "paymentQr.reviewedBy": req.user._id, "paymentQr.reviewedAt": new Date() } },
            { returnDocument: "after" }
        ).lean();
        if (!updated) return notDecidable(res, decision.schoolId, decision.link);
        return res.json({ message: "QR rejected. The school can see the reason and upload another.", paymentQr: paymentQrToClient(updated.paymentQr) });
    } catch (rejectError) {
        return next(rejectError);
    }
};
