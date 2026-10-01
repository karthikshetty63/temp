import { useCallback } from "react";
import { listApprovedProjects } from "../api/projects";
import useApiList from "./useApiList";

const load = () => listApprovedProjects().then((data) => data.projects);

/** Approved school needs from the server (the NGO or donor view), with loading and error states. */
const useApprovedProjects = () => {
  const { items: projects, setItems, loading, error, reload, refresh } = useApiList(load, "Could not load school needs.");

  /** Show a need's latest state (e.g. after committing) in place, keeping the list order. */
  const update = useCallback((project) => setItems((current) => current.map((p) => (p.id === project.id ? project : p))), [setItems]);

  return { projects, loading, error, reload, refresh, update };
};

export default useApprovedProjects;
