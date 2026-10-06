import { apiRequest } from "./auth";

export const getMyProfile = () => apiRequest("/api/profile/me");

export const uploadSchoolPhoto = (file) => {
    const form = new FormData();
    form.append("schoolPhoto", file);
    return apiRequest("/api/profile/photo", { method: "PUT", body: form });
};

export const removeSchoolPhoto = () => apiRequest("/api/profile/photo", { method: "DELETE" });

/** `link` is the text read from the school's UPI QR in the browser (the image is never uploaded). */
export const savePaymentQr = (link) => apiRequest("/api/profile/payment-qr", { method: "PUT", body: { link } });

export const removePaymentQr = () => apiRequest("/api/profile/payment-qr", { method: "DELETE" });

/** Only the fields in `changes` are updated (see SCHOOL_PROFILE_EDITABLE). */
export const updateSchoolProfile = (changes) => apiRequest("/api/profile/school", { method: "PATCH", body: changes });
