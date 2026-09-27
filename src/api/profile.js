import { apiRequest } from "./auth";

export const getMyProfile = () => apiRequest("/api/profile/me");

export const uploadSchoolPhoto = (file) => {
    const form = new FormData();
    form.append("schoolPhoto", file);
    return apiRequest("/api/profile/photo", { method: "PUT", body: form });
};

export const removeSchoolPhoto = () => apiRequest("/api/profile/photo", { method: "DELETE" });

/** Only the fields in `changes` are updated (see SCHOOL_PROFILE_EDITABLE). */
export const updateSchoolProfile = (changes) => apiRequest("/api/profile/school", { method: "PATCH", body: changes });
