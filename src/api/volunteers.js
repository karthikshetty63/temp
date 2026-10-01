import { apiRequest } from "./auth";

// Rules shared with the server (the server re-checks everything).
export { validateVolunteer } from "../../shared/volunteerRules.js";

/** The signed-in NGO's volunteers, newest first. */
export const listVolunteers = () => apiRequest("/api/ngo/volunteers");

export const createVolunteer = (values) => apiRequest("/api/ngo/volunteers", { method: "POST", body: values });

/** Only the fields in `changes` are updated. */
export const updateVolunteer = (id, changes) =>
  apiRequest(`/api/ngo/volunteers/${encodeURIComponent(id)}`, { method: "PATCH", body: changes });

export const deleteVolunteer = (id) => apiRequest(`/api/ngo/volunteers/${encodeURIComponent(id)}`, { method: "DELETE" });
