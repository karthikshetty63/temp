import { useCallback, useEffect, useState } from "react";
import { listMyProjects } from "../api/projects";

const fetchProjects = () =>
  listMyProjects().then(
    (data) => ({ projects: data.projects, error: "" }),
    (loadError) => ({ projects: null, error: loadError.message || "Could not load your projects." })
  );

/** The signed-in school's projects from the server, with loading and error states. */
const useMyProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apply = useCallback((result) => {
    if (result.projects) setProjects(result.projects);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchProjects().then((result) => active && apply(result));
    return () => {
      active = false;
    };
  }, [apply]);

  /** Load again (the "Try again" button). */
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    apply(await fetchProjects());
  }, [apply]);

  /** Put a created or edited project into the list without reloading. */
  const upsert = useCallback((project) => {
    setProjects((current) => [project, ...current.filter((p) => p.id !== project.id)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  }, []);

  return { projects, loading, error, reload, upsert };
};

export default useMyProjects;
