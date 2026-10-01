import mongoose from "mongoose";
import FundingPayment from "../models/FundingPayment.js";
import UploadedFile from "../models/UploadedFile.js";
import { createReadStream, storedFileExists } from "../utils/fileStorage.js";

const notFound = (res) => res.status(404).json({ message: "File not found." });

/** A school may view the payment proof an NGO sent for one of the school's own projects. */
const isPaymentProofForSchool = (file, user) =>
    user.role === "school" && file.purpose === "proof" && FundingPayment.exists({ proof: file._id, school: user._id });

// GET /api/files/:id — private file download.
// Allowed only for the file's owner, an admin, or the school a payment proof was sent to. Everyone
// else gets 404, so the existence of someone else's documents is not revealed.
export const getFile = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
        const file = await UploadedFile.findById(req.params.id);
        if (!file) return notFound(res);

        const isOwner = file.owner.equals(req.user._id);
        if (!isOwner && req.user.role !== "admin" && !(await isPaymentProofForSchool(file, req.user))) return notFound(res);
        if (!(await storedFileExists(file.storageKey))) return notFound(res);

        const extension = file.storageKey.split(".").pop();
        const safeName = `${file.purpose}.${extension}`;
        res.set({
            "Content-Type": file.mimeType,
            "Content-Length": String(file.size),
            "Cache-Control": "private, no-store",
            // Type was verified from the file bytes; never let the browser guess or run anything.
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Content-Disposition": `${file.mimeType === "application/pdf" ? "attachment" : "inline"}; filename="${safeName}"`,
        });

        const stream = createReadStream(file.storageKey);
        stream.on("error", next);
        return stream.pipe(res);
    } catch (error) {
        return next(error);
    }
};
