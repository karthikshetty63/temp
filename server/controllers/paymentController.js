import mongoose from "mongoose";
import FundingPayment from "../models/FundingPayment.js";
import NGOProfile from "../models/NGOProfile.js";
import Project from "../models/Project.js";
import SchoolProfile from "../models/SchoolProfile.js";
import { ONLINE_PAYMENT_METHOD, PAYMENT_PROOF_RULE, validateOnlinePayment, validatePaymentDetails, validateRejectionReason } from "../../shared/paymentRules.js";
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured, isValidPaymentSignature, razorpayMode, readCheckoutResult } from "../services/razorpay.js";
import { deleteUploadedFiles, fileSummary, storeUploads, validateUploads } from "../services/uploadService.js";
import { toPartnerViews } from "./approvedProjectController.js";
import { projectToClient } from "./projectController.js";

// An NGO pays for its committed parts in one of two ways (shared/paymentRules.js):
//   DIRECT  it pays the school directly, records the payment here with proof, and the school accepts
//           it once the money has reached its account. This money never passes through VIDYADAAN.
//   ONLINE  it pays VIDYADAAN through Razorpay. The parts count as paid as soon as the server has
//           verified Razorpay's signature; VIDYADAAN transfers the money to the school.

const PROOF_FIELD = "proof";
const PROOF_RULES = { [PROOF_FIELD]: PAYMENT_PROOF_RULE };

const formatINR = (n) => `₹${n.toLocaleString("en-IN")}`;
const dateOnly = (d) => d.toISOString().slice(0, 10);
const badRequest = (res, errors) => res.status(400).json({ message: Object.values(errors)[0], errors });
const needNotFound = (res) => res.status(404).json({ message: "This school need is no longer available." });
const paymentNotFound = (res) => res.status(404).json({ message: "Payment not found." });

/** Every part in `parts` must be this NGO's, on this project, matching `extra` — as one atomic condition. */
const partsCondition = (parts, ngoId, extra) => ({
    $and: parts.map((part) => ({ fundingParts: { $elemMatch: { part, ngo: ngoId, ...extra } } })),
});

/** What both sides see of a payment. `proof` must be populated; `school`/`ngo` are display objects. */
const paymentToClient = (p, { projectTitle, school, ngo }) => ({
    id: p._id.toString(),
    project: { id: p.project.toString(), title: projectTitle || "School need" },
    parts: p.parts,
    amount: p.amount,
    channel: p.channel || "DIRECT",
    method: p.method,
    reference: p.reference,
    ...(p.channel === "ONLINE" ? { mode: p.mode || "test" } : {}),
    paidOn: dateOnly(p.paidOn),
    note: p.note || "",
    proof: fileSummary(p.proof),
    status: p.status,
    rejectionReason: p.rejectionReason || null,
    submittedAt: p.submittedAt,
    reviewedAt: p.reviewedAt || null,
    ...(school ? { school } : {}),
    ...(ngo ? { ngo } : {}),
});

/** Payments with project titles and the other party's name (and, for schools, the NGO's contact). */
const withNames = async (payments, { forSchool }) => {
    const projectIds = [...new Set(payments.map((p) => p.project.toString()))];
    const projects = await Project.find({ _id: { $in: projectIds } }).select("title").lean();
    const titles = new Map(projects.map((p) => [p._id.toString(), p.title]));

    if (forSchool) {
        const ngoIds = [...new Set(payments.map((p) => p.ngo.toString()))];
        const ngos = await NGOProfile.find({ userId: { $in: ngoIds } }).select("userId ngoName email phone").lean();
        const byId = new Map(ngos.map((n) => [n.userId.toString(), n]));
        return payments.map((p) => {
            const n = byId.get(p.ngo.toString());
            return paymentToClient(p, {
                projectTitle: titles.get(p.project.toString()),
                ngo: { name: n?.ngoName || "NGO partner", email: n?.email || "", phone: n?.phone || "" },
            });
        });
    }
    const schoolIds = [...new Set(payments.map((p) => p.school.toString()))];
    const schools = await SchoolProfile.find({ userId: { $in: schoolIds } }).select("userId schoolName").lean();
    const byId = new Map(schools.map((s) => [s.userId.toString(), s]));
    return payments.map((p) =>
        paymentToClient(p, { projectTitle: titles.get(p.project.toString()), school: { name: byId.get(p.school.toString())?.schoolName || "Government school" } })
    );
};

// ─── NGO ─────────────────────────────────────────────────────────────────────

/**
 * The NGO's parts to pay for: each must be the NGO's, not yet received and not already in a payment.
 * @returns {{ chosen?: object[], problem?: string }}
 */
const payableParts = (project, ngoId, parts) => {
    const mine = new Map(project.fundingParts.filter((f) => f.ngo.equals(ngoId)).map((f) => [f.part, f]));
    for (const part of parts) {
        const entry = mine.get(part);
        if (!entry) return { problem: `Part ${part} isn't one of your parts of this need.` };
        if (entry.receivedAt) return { problem: `Part ${part} has already been paid.` };
        if (entry.payment) return { problem: `Part ${part} already has a payment waiting for the school.` };
    }
    return { chosen: parts.map((part) => mine.get(part)) };
};

// GET /api/projects/:id/payment-details — where to send the money. Only for an NGO that has
// committed to parts of this need and not yet paid for all of them.
export const getPaymentDetails = async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return needNotFound(res);
    try {
        const project = await Project.findOneVisibleToPublic({
            _id: req.params.id,
            fundingParts: { $elemMatch: { ngo: req.user._id, receivedAt: null, payment: null } },
        })
            .select("school")
            .lean();
        if (!project) return needNotFound(res);
        const school = await SchoolProfile.findOne({ userId: project.school }).select("schoolName bankAccount ifsc upi paymentQr").lean();
        // The school's UPI QR only once it is ACTIVE (its verified UPI ID, or approved by an admin).
        const qr = school?.paymentQr?.status === "ACTIVE" ? { link: school.paymentQr.link, upiId: school.paymentQr.upiId, payeeName: school.paymentQr.payeeName || "" } : null;
        return res.json({
            payee: { name: school?.schoolName || "Government school", bankAccount: school?.bankAccount || "", ifsc: school?.ifsc || "", upi: school?.upi || "", qr },
        });
    } catch (error) {
        return next(error);
    }
};

// POST /api/projects/:id/payments  (multipart: file "proof" + fields parts, method, reference, paidOn, note)
export const submitPayment = async (req, res, next) => {
    const { errors, values } = validatePaymentDetails(req.body);
    const files = req.files || [];
    if (!files.length) errors[PROOF_FIELD] = "Upload the challan, receipt or a screenshot of the transaction.";
    if (Object.keys(errors).length) return badRequest(res, errors);
    // Real file type from the bytes, 5 MB limit, one file, no other file fields.
    const { errors: fileErrors, accepted } = validateUploads(files, PROOF_RULES);
    if (Object.keys(fileErrors).length) return badRequest(res, fileErrors);
    if (!mongoose.isValidObjectId(req.params.id)) return needNotFound(res);

    let stored = {};
    try {
        const project = await Project.findOneVisibleToPublic({ _id: req.params.id }).lean();
        if (!project) return needNotFound(res);

        const { chosen, problem } = payableParts(project, req.user._id, values.parts);
        if (problem) return badRequest(res, { parts: problem });
        const firstCommitted = dateOnly(new Date(Math.min(...chosen.map((f) => f.committedAt.getTime()))));
        if (values.paidOn < firstCommitted) return badRequest(res, { paidOn: `The payment date can't be before you committed (${firstCommitted}).` });
        const duplicate = await FundingPayment.exists({ ngo: req.user._id, reference: values.reference, status: { $ne: "REJECTED" } });
        if (duplicate) return res.status(409).json({ message: "You've already recorded a payment with this transaction reference.", errors: { reference: "You've already recorded a payment with this transaction reference." } });

        stored = await storeUploads(req.user._id, accepted);
        const paymentId = new mongoose.Types.ObjectId();
        // Lock the parts to this payment in one atomic update, so they can't be withdrawn or paid twice.
        const locked = await Project.updateOne(
            { _id: project._id, reviewStatus: "OPEN", ...partsCondition(values.parts, req.user._id, { receivedAt: null, payment: null }) },
            { $set: { "fundingParts.$[p].payment": paymentId } },
            { arrayFilters: [{ "p.part": { $in: values.parts }, "p.ngo": req.user._id }] }
        );
        if (!locked.modifiedCount) {
            await deleteUploadedFiles(Object.values(stored));
            return res.status(409).json({ message: "These parts have just changed. Reload the page and try again." });
        }

        let payment;
        try {
            payment = await FundingPayment.create({
                _id: paymentId,
                project: project._id,
                school: project.school,
                ngo: req.user._id,
                parts: values.parts,
                amount: chosen.reduce((sum, f) => sum + f.amount, 0),
                method: values.method,
                reference: values.reference,
                paidOn: new Date(`${values.paidOn}T00:00:00Z`),
                note: values.note,
                proof: stored[PROOF_FIELD]._id,
                submittedAt: new Date(),
            });
        } catch (error) {
            await Project.updateOne({ _id: project._id }, { $unset: { "fundingParts.$[p].payment": "" } }, { arrayFilters: [{ "p.payment": paymentId }] });
            throw error;
        }

        const [updated] = await toPartnerViews([await Project.findById(project._id).lean()], req.user._id, { activeOnly: false });
        const [view] = await withNames([{ ...payment.toObject(), proof: stored[PROOF_FIELD] }], { forSchool: false });
        return res.status(201).json({
            message: `Payment of ${formatINR(payment.amount)} recorded. The school will accept it once the money reaches its account.`,
            payment: view,
            project: updated,
        });
    } catch (error) {
        await deleteUploadedFiles(Object.values(stored));
        return next(error);
    }
};

// GET /api/projects/payments — every payment this NGO has made or recorded, newest first (not online
// orders it never paid).
export const listMyPayments = async (req, res, next) => {
    try {
        const payments = await FundingPayment.find({ ngo: req.user._id, status: { $ne: "CREATED" } }).sort({ submittedAt: -1, _id: -1 }).limit(500).populate("proof").lean();
        return res.json({ payments: await withNames(payments, { forSchool: false }) });
    } catch (error) {
        return next(error);
    }
};

const onlineUnavailable = (res) =>
    res.status(503).json({ code: "PAYMENTS_UNAVAILABLE", message: "Online payments aren't available right now. You can still pay the school directly and record it." });

// POST /api/projects/:id/payments/online  { parts } — pay committed parts online. The server works out
// the amount from the parts and creates the Razorpay order, which fixes that amount. Nothing counts yet,
// and the parts aren't locked: the payment is applied to them only once it is verified.
export const startOnlinePayment = async (req, res, next) => {
    if (!isRazorpayConfigured()) return onlineUnavailable(res);
    const { errors, values } = validateOnlinePayment(req.body);
    if (Object.keys(errors).length) return badRequest(res, errors);
    if (!mongoose.isValidObjectId(req.params.id)) return needNotFound(res);
    try {
        const project = await Project.findOneVisibleToPublic({ _id: req.params.id }).lean();
        if (!project) return needNotFound(res);
        const { chosen, problem } = payableParts(project, req.user._id, values.parts);
        if (problem) return badRequest(res, { parts: problem });
        const amount = chosen.reduce((sum, f) => sum + f.amount, 0);

        // The payment's ID is the order's receipt, so every Razorpay order points back to its payment.
        const paymentId = new mongoose.Types.ObjectId();
        let order;
        try {
            order = await createRazorpayOrder({
                amount: amount * 100, // paise
                currency: "INR",
                receipt: paymentId.toString(),
                notes: { projectId: project._id.toString(), kind: "ngo-parts" },
            });
        } catch (error) {
            console.error("Razorpay order could not be created:", error.message);
            return res.status(502).json({ message: "We couldn't reach the payment service. Please try again in a moment." });
        }

        const now = new Date();
        await FundingPayment.create({
            _id: paymentId,
            project: project._id,
            school: project.school,
            ngo: req.user._id,
            parts: values.parts,
            amount,
            channel: "ONLINE",
            method: ONLINE_PAYMENT_METHOD,
            reference: order.id,
            orderId: order.id,
            mode: razorpayMode(),
            paidOn: now,
            status: "CREATED",
            submittedAt: now,
        });
        const which = values.parts.length === 1 ? `part ${values.parts[0]}` : `parts ${values.parts.join(", ")}`;
        return res.status(201).json({
            message: "Payment started. It counts only once the payment has been verified.",
            payment: { id: paymentId.toString(), parts: values.parts, amount },
            // What Razorpay Checkout needs to open this order. The key ID is public; the secret never leaves the server.
            checkout: {
                keyId: getRazorpayKeyId(),
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                name: "VIDYADAAN",
                description: `${project.title} (${which})`,
            },
        });
    } catch (error) {
        return next(error);
    }
};

// POST /api/projects/payments/:paymentId/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// The values Razorpay Checkout hands the browser after a payment. Safe to send more than once. Only a valid
// signature counts: the parts become paid and the amount is added to "raised", exactly once. If the parts
// were paid another way meanwhile, the money is recorded as REFUND_DUE instead of being lost.
export const verifyOnlinePayment = async (req, res, next) => {
    if (!isRazorpayConfigured()) return onlineUnavailable(res);
    const checkout = readCheckoutResult(req.body);
    if (!checkout) return res.status(400).json({ message: "The payment details are missing or incomplete." });
    if (!mongoose.isValidObjectId(req.params.paymentId)) return paymentNotFound(res);

    try {
        // Only the signed-in NGO's own online payment; anyone else's looks like it doesn't exist.
        let payment = await FundingPayment.findOne({ _id: req.params.paymentId, ngo: req.user._id, channel: "ONLINE" }).lean();
        if (!payment) return paymentNotFound(res);
        if (checkout.orderId !== payment.orderId) return res.status(400).json({ message: "These payment details are for a different payment." });
        // The proof that Razorpay took the payment: only Razorpay (and this server) can make this signature.
        if (!isValidPaymentSignature({ orderId: payment.orderId, paymentId: checkout.paymentId, signature: checkout.signature })) {
            return res.status(400).json({ message: "We couldn't verify this payment, so nothing was recorded. If money left your account, contact VIDYADAAN support with your payment ID." });
        }

        if (payment.status === "CREATED") {
            const now = new Date();
            // Mark the parts paid and add the amount in one atomic update, only while every part is still
            // unpaid: it can't happen twice, or overlap a direct payment for the same parts.
            const applied = await Project.updateOne(
                { _id: payment.project, ...partsCondition(payment.parts, payment.ngo, { receivedAt: null, payment: null }) },
                { $set: { "fundingParts.$[p].payment": payment._id, "fundingParts.$[p].receivedAt": now }, $inc: { raised: payment.amount } },
                { arrayFilters: [{ "p.part": { $in: payment.parts }, "p.ngo": payment.ngo }] }
            );
            // A repeat request (or a retry after a failure just here) finds the parts already marked with this payment.
            const ours = applied.modifiedCount === 1 || Boolean(await Project.exists({ _id: payment.project, ...partsCondition(payment.parts, payment.ngo, { payment: payment._id }) }));
            try {
                await FundingPayment.updateOne(
                    { _id: payment._id, status: "CREATED" },
                    { $set: { status: ours ? "ACCEPTED" : "REFUND_DUE", razorpayPaymentId: checkout.paymentId, reference: checkout.paymentId, paidOn: now, reviewedAt: now } }
                );
            } catch (error) {
                // The unique index on razorpayPaymentId: this Razorpay payment already belongs to another record.
                if (error.code === 11000) return res.status(409).json({ message: "This payment has already been recorded." });
                throw error;
            }
            payment = await FundingPayment.findById(payment._id).lean();
        }
        if (payment.razorpayPaymentId !== checkout.paymentId) {
            return res.status(409).json({ message: "This payment has already been made with a different Razorpay payment." });
        }
        if (payment.status === "REFUND_DUE") {
            return res.status(409).json({
                code: "REFUND_DUE",
                message: `Your payment of ${formatINR(payment.amount)} was received, but these parts had already been paid another way. VIDYADAAN will refund it: email support with your payment ID.`,
            });
        }

        const [updated] = await toPartnerViews([await Project.findById(payment.project).lean()], req.user._id, { activeOnly: false });
        const [view] = await withNames([payment], { forSchool: false });
        return res.json({
            message: `Payment of ${formatINR(payment.amount)} confirmed. Those parts are now paid, and VIDYADAAN will transfer the full amount to the school.`,
            payment: view,
            project: updated,
        });
    } catch (error) {
        return next(error);
    }
};

// ─── School ──────────────────────────────────────────────────────────────────

// GET /api/school/payments — payments NGOs have recorded or made online for this school's projects,
// newest first. Unpaid online orders and online payments that couldn't be applied aren't the school's concern.
export const listSchoolPayments = async (req, res, next) => {
    try {
        const payments = await FundingPayment.find({ school: req.user._id, status: { $nin: ["CREATED", "REFUND_DUE"] } }).sort({ submittedAt: -1, _id: -1 }).limit(500).populate("proof").lean();
        return res.json({ payments: await withNames(payments, { forSchool: true }) });
    } catch (error) {
        return next(error);
    }
};

/** Reply for a payment the school can't act on: missing (404) or already decided (409). */
const cannotReview = async (req, res) => {
    const existing = await FundingPayment.findOne({ _id: req.params.id, school: req.user._id }).select("status").lean();
    if (!existing) return paymentNotFound(res);
    return res.status(409).json({ message: `This payment has already been ${existing.status === "ACCEPTED" ? "accepted" : "rejected"}.` });
};

const reviewedReply = async (res, paymentId, message, project) => {
    const payment = await FundingPayment.findById(paymentId).populate("proof").lean();
    const [view] = await withNames([payment], { forSchool: true });
    return res.json({ message, payment: view, ...(project ? { project: projectToClient(project) } : {}) });
};

// PATCH /api/school/payments/:id/accept — the money has reached the school: its parts count as
// received and the amount is added to "raised".
export const acceptPayment = async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return paymentNotFound(res);
    try {
        const reviewedAt = new Date();
        // Claim the payment first, so it can't be accepted (or rejected) twice at the same moment.
        const payment = await FundingPayment.findOneAndUpdate(
            { _id: req.params.id, school: req.user._id, status: "SUBMITTED" },
            { $set: { status: "ACCEPTED", reviewedAt } },
            { returnDocument: "after" }
        ).lean();
        if (!payment) return cannotReview(req, res);

        const project = await Project.findOneAndUpdate(
            { _id: payment.project, school: req.user._id, ...partsCondition(payment.parts, payment.ngo, { payment: payment._id, receivedAt: null }) },
            { $set: { "fundingParts.$[p].receivedAt": reviewedAt }, $inc: { raised: payment.amount } },
            { arrayFilters: [{ "p.part": { $in: payment.parts }, "p.payment": payment._id }], returnDocument: "after" }
        ).lean();
        if (!project) {
            await FundingPayment.updateOne({ _id: payment._id }, { $set: { status: "SUBMITTED" }, $unset: { reviewedAt: "" } });
            return res.status(409).json({ message: "This payment's parts have changed. Reload the page and try again." });
        }
        return reviewedReply(res, payment._id, `Payment of ${formatINR(payment.amount)} accepted and added to “Raised so far”.`, project);
    } catch (error) {
        return next(error);
    }
};

// PATCH /api/school/payments/:id/reject  { reason } — the money hasn't arrived (or the proof is
// wrong). The NGO sees the reason and its parts are open for a new payment.
export const rejectPayment = async (req, res, next) => {
    const { error, value: reason } = validateRejectionReason(req.body?.reason);
    if (error) return badRequest(res, { reason: error });
    if (!mongoose.isValidObjectId(req.params.id)) return paymentNotFound(res);
    try {
        const payment = await FundingPayment.findOneAndUpdate(
            { _id: req.params.id, school: req.user._id, status: "SUBMITTED" },
            { $set: { status: "REJECTED", rejectionReason: reason, reviewedAt: new Date() } },
            { returnDocument: "after" }
        ).lean();
        if (!payment) return cannotReview(req, res);

        const project = await Project.findOneAndUpdate(
            { _id: payment.project },
            { $unset: { "fundingParts.$[p].payment": "" } },
            { arrayFilters: [{ "p.payment": payment._id, "p.receivedAt": null }], returnDocument: "after" }
        ).lean();
        return reviewedReply(res, payment._id, "Payment rejected. The NGO will see your reason and can send it again.", project);
    } catch (err) {
        return next(err);
    }
};
