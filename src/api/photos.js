import { apiRequest } from "./auth";

// Rules shared with the server (the server re-checks everything).
export { PHOTO_CAPTION_MAX, PHOTO_STAGES, PROJECT_PHOTO_RULE, validatePhotoDetails } from "../../shared/projectRules.js";

/** The signed-in school's own project photos, newest first. */
export const listMyPhotos = () => apiRequest("/api/school/photos");

export const uploadProjectPhoto = ({ projectId, stage, caption, file }) => {
  const form = new FormData();
  form.append("projectId", projectId);
  form.append("stage", stage);
  form.append("caption", caption);
  form.append("photo", file);
  return apiRequest("/api/school/photos", { method: "POST", body: form });
};

export const deleteProjectPhoto = (id) => apiRequest(`/api/school/photos/${encodeURIComponent(id)}`, { method: "DELETE" });
