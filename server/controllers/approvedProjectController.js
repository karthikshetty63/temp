import mongoose from "mongoose";
import Project from "../models/Project.js";
import SchoolProfile from "../models/SchoolProfile.js";
import User from "../models/User.js";
import { splitIntoParts, validateFundingParts } from "../../shared/projectRules.js";

// Enough for the dashboard; a real browse page would paginate.
const MAX_PROJECTS = 200;

const formatINR = (n) => `₹${n.toLocaleString("en-IN")}`;
const notFound = (res) => res.status(404).json({ message: "This school need is no longer available." });

/** Where the money for one committed part stands. */
export const partStatus = (f) => (f.receivedAt ? "RECEIVED" : f.payment ? "PAYMENT_SUBMITTED" : "AWAITING_PAYMENT");

/**
 * The need's budget in equal parts, as one NGO sees them: each part is free, taken by this NGO (with
 * where its payment stands) or taken by another NGO (never named).
 */
const partsFor = (p, viewerId) => {
    const taken = new Map((p.fundingParts || []).map((f) => [f.part, f]));
    return splitIntoParts(p.budget).map(({ part, amount }) => {
        const t = taken.get(part);
        if (!t) return { part, amount, takenBy: null };
        if (!t.ngo.equals(viewerId)) return { part, amount: t.amount, takenBy: "other" };
        return { part, amount: t.amount, takenBy: "you", committedAt: t.committedAt, status: partStatus(t), receivedAt: t.receivedAt || null };
    });
};

/**
 * What NGOs may see of an approved project: the need itself, where the school is and which parts
 * are still free. Never the school's contact details, documents, UDISE code or anything about the review.
 */
const toPartnerView = (p, school, viewerId) => {
    const parts = partsFor(p, viewerId);
    return {
        id: p._id.toString(),
        title: p.title,
        category: p.category,
        problem: p.problem,
        priority: p.priority,
        budget: p.budget,
        raised: p.raised,
        committed: parts.reduce((sum, part) => sum + (part.takenBy ? part.amount : 0), 0),
        parts,
        studentsBenefited: p.studentsBenefited,
        expectedCompletion: p.expectedCompletion.toISOString().slice(0, 10),
        location: p.location,
        materials: p.materials,
        status: p.status,
        approvedAt: p.reviewedAt || null,
        school: { name: school?.schoolName || "Government school", district: school?.district || "", state: school?.state || "" },
    };
};

/**
 * What donors may see of a partner view: what the need is, whose school it is and how much money has
 * been confirmed for it. Nothing about NGO commitments or payments, and nothing from the admin review.
 */
const toDonorView = (v) => ({
    id: v.id,
    title: v.title,
    category: v.category,
    priority: v.priority,
    status: v.status,
    budget: v.budget,
    raised: v.raised,
    school: v.school,
});

/**
 * Partner views of `projects`, with each school's name and place. With `activeOnly`, a school
 * whose account is no longer active drops out, with all its projects.
 */
export const toPartnerViews = async (projects, viewerId, { activeOnly }) => {
    const schoolIds = [...new Set(projects.map((p) => p.school.toString()))];
    const [activeSchools, profiles] = await Promise.all([
        activeOnly ? User.find({ _id: { $in: schoolIds }, role: "school", accountStatus: "active" }).select("_id").lean() : null,
        SchoolProfile.find({ userId: { $in: schoolIds } }).select("userId schoolName district state").lean(),
    ]);
    const active = activeSchools && new Set(activeSchools.map((u) => u._id.toString()));
    const profileBySchool = new Map(profiles.map((p) => [p.userId.toString(), p]));
    return projects
        .filter((p) => !active || active.has(p.school.toString()))
        .map((p) => toPartnerView(p, profileBySchool.get(p.school.toString()), viewerId));
};

/**
 * An approved need that can still be funded: not completed, and its school's account is active.
 * The one rule for both NGO commitments and donor donations.
 */
export const findFundableProject = async (id) => {
    if (!mongoose.isValidObjectId(id)) return null;
    const project = await Project.findOneVisibleToPublic({ _id: id, status: { $ne: "Completed" } }).lean();
    if (!project) return null;
    const schoolActive = await User.exists({ _id: project.school, role: "school", accountStatus: "active" });
    return schoolActive ? project : null;
};

// GET /api/projects — approved school needs that still need support, newest approval first.
// NGOs get the partner view; donors get the same needs in the donor view.
export const listApprovedProjects = async (req, res, next) => {
    try {
        // findVisibleToPublic only ever returns approved (OPEN) projects.
        const projects = await Project.findVisibleToPublic({ status: { $ne: "Completed" } })
            .sort({ reviewedAt: -1, _id: -1 })
            .limit(MAX_PROJECTS)
            .lean();
        const views = await toPartnerViews(projects, req.user._id, { activeOnly: true });
        return res.json({ projects: req.user.role === "donor" ? views.map(toDonorView) : views });
    } catch (error) {
        return next(error);
    }
};

// GET /api/projects/committed — the needs this NGO has committed to fund (completed ones too),
// most recent commitment first.
export const listMyCommitments = async (req, res, next) => {
    try {
        const projects = await Project.findVisibleToPublic({ "fundingParts.ngo": req.user._id }).limit(MAX_PROJECTS).lean();
        const latest = (p) => Math.max(...p.fundingParts.filter((f) => f.ngo.equals(req.user._id)).map((f) => f.committedAt.getTime()));
        projects.sort((a, b) => latest(b) - latest(a));
        // The NGO keeps its own record even if the school's account is later closed.
        return res.json({ projects: await toPartnerViews(projects, req.user._id, { activeOnly: false }) });
    } catch (error) {
        return next(error);
    }
};

// POST /api/projects/:id/commitments  { parts: [1, 2] } — commit to fund one or more free parts
// (all of them is the full amount). No money moves on VIDYADAAN; the school confirms receipt.
export const commitFunding = async (req, res, next) => {
    const { error, value: parts } = validateFundingParts(req.body?.parts);
    if (error) return res.status(400).json({ message: error, errors: { parts: error } });
    try {
        const project = await findFundableProject(req.params.id);
        if (!project) return notFound(res);

        const amounts = splitIntoParts(project.budget);
        const committedAt = new Date();
        // One atomic update: it only goes through while none of these parts is taken and the budget
        // is still the one the amounts were worked out from, so two NGOs can never get the same part.
        const updated = await Project.findOneAndUpdate(
            { _id: project._id, reviewStatus: "OPEN", status: { $ne: "Completed" }, budget: project.budget, "fundingParts.part": { $nin: parts } },
            {
                $push: {
                    fundingParts: {
                        $each: parts.map((part) => ({ part, amount: amounts[part - 1].amount, ngo: req.user._id, committedAt })),
                        $sort: { part: 1 },
                    },
                },
            },
            { returnDocument: "after" }
        ).lean();

        if (!updated) {
            const latest = await Project.findOneVisibleToPublic({ _id: project._id }).lean();
            const taken = parts.filter((part) => latest?.fundingParts.some((f) => f.part === part));
            const message = taken.length
                ? `${taken.length === 1 ? `Part ${taken[0]} has` : `Parts ${taken.join(", ")} have`} just been taken by another NGO. Choose again.`
                : "This need has just changed. Reload the page and try again.";
            const [view] = latest ? await toPartnerViews([latest], req.user._id, { activeOnly: false }) : [];
            return res.status(409).json({ message, ...(view ? { project: view } : {}) });
        }

        const total = parts.reduce((sum, part) => sum + amounts[part - 1].amount, 0);
        const [view] = await toPartnerViews([updated], req.user._id, { activeOnly: false });
        return res.status(201).json({ message: `You've committed ${formatINR(total)} to “${updated.title}”.`, project: view });
    } catch (err) {
        return next(err);
    }
};

// DELETE /api/projects/:id/commitments — withdraw this NGO's parts that it hasn't paid for yet.
// Parts with a payment waiting for the school, or already received, stay.
export const withdrawFunding = async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    try {
        const mine = { ngo: req.user._id, receivedAt: null, payment: null };
        const updated = await Project.findOneAndUpdate(
            { _id: req.params.id, reviewStatus: "OPEN", fundingParts: { $elemMatch: mine } },
            { $pull: { fundingParts: mine } },
            { returnDocument: "after" }
        ).lean();
        if (!updated) return res.status(404).json({ message: "You have no unpaid parts on this need to withdraw." });
        const [view] = await toPartnerViews([updated], req.user._id, { activeOnly: false });
        return res.json({ message: "Your commitment has been withdrawn.", project: view });
    } catch (error) {
        return next(error);
    }
};
