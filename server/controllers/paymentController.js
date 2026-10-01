import mongoose from "mongoose";
import FundingPayment from "../models/FundingPayment.js";
import NGOProfile from "../models/NGOProfile.js";
import Project from "../models/Project.js";
import SchoolProfile from "../models/SchoolProfile.js";
import { PAYMENT_PROOF_RULE, validatePaymentDetails, validateRejectionReason } from "../../shared/paymentRules.js";
import { deleteUploadedFiles, fileSummary, storeUploads, validateUploads } from "../services/uploadService.js";
import { toPartnerViews } from "./approvedProjectController.js";
import { projectToClient } from "./projectController.js";

// Money never passes through VIDYADAAN. The NGO pays the school directly, records the payment here
// with proof, and the school accepts it once the money has reached its account.

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
    method: p.method,
    reference: p.reference,
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
        const school = await SchoolProfile.findOne({ userId: project.school }).select("schoolName bankAccount ifsc upi").lean();
        return res.json({
            payee: { name: school?.schoolName || "Government school", bankAccount: school?.bankAccount || "", ifsc: school?.ifsc || "", upi: school?.upi || "" },
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

        // Each part must be this NGO's, not yet received and not already in a payment.
        const mine = new Map(project.fundingParts.filter((f) => f.ngo.equals(req.user._id)).map((f) => [f.part, f]));
        for (const part of values.parts) {
            const entry = mine.get(part);
            const problem = !entry
                ? `Part ${part} isn't one of your parts of this need.`
                : entry.receivedAt
                  ? `Part ${part} has already been received by the school.`
                  : entry.payment
                    ? `Part ${part} already has a payment waiting for the school.`
                    : null;
            if (problem) return badRequest(res, { parts: problem });
        }
        const chosen = values.parts.map((part) => mine.get(part));
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

// GET /api/projects/payments — every payment this NGO has recorded, newest first.
export const listMyPayments = async (req, res, next) => {
    try {
        const payments = await FundingPayment.find({ ngo: req.user._id }).sort({ submittedAt: -1, _id: -1 }).limit(500).populate("proof").lean();
        return res.json({ payments: await withNames(payments, { forSchool: false }) });
    } catch (error) {
        return next(error);
    }
};

// ─── School ──────────────────────────────────────────────────────────────────

// GET /api/school/payments — payments NGOs have recorded for this school's projects, newest first.
export const listSchoolPayments = async (req, res, next) => {
    try {
        const payments = await FundingPayment.find({ school: req.user._id }).sort({ submittedAt: -1, _id: -1 }).limit(500).populate("proof").lean();
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
