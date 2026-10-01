import NGOProfile from "../models/NGOProfile.js";
import Project from "../models/Project.js";
import { partStatus } from "./approvedProjectController.js";

// GET /api/school/commitments — every NGO commitment on this school's projects, newest first, with
// where its payment stands. The school sees who committed and how to reach them (NGOs are told
// this before they commit).
export const listSchoolCommitments = async (req, res, next) => {
    try {
        const projects = await Project.find({ school: req.user._id, "fundingParts.0": { $exists: true } })
            .select("title fundingParts")
            .lean();
        const ngoIds = [...new Set(projects.flatMap((p) => p.fundingParts.map((f) => f.ngo.toString())))];
        const profiles = await NGOProfile.find({ userId: { $in: ngoIds } }).select("userId ngoName email phone district state").lean();
        const ngoById = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const commitments = projects
            .flatMap((p) =>
                p.fundingParts.map((f) => {
                    const ngo = ngoById.get(f.ngo.toString());
                    return {
                        projectId: p._id.toString(),
                        projectTitle: p.title,
                        part: f.part,
                        amount: f.amount,
                        committedAt: f.committedAt,
                        status: partStatus(f),
                        paymentId: f.payment ? f.payment.toString() : null,
                        receivedAt: f.receivedAt || null,
                        ngo: {
                            name: ngo?.ngoName || "NGO partner",
                            email: ngo?.email || "",
                            phone: ngo?.phone || "",
                            district: ngo?.district || "",
                            state: ngo?.state || "",
                        },
                    };
                })
            )
            .sort((a, b) => b.committedAt - a.committedAt || a.part - b.part);
        return res.json({ commitments });
    } catch (error) {
        return next(error);
    }
};
