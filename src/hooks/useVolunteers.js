import { useCallback } from "react";
import { listVolunteers } from "../api/volunteers";
import useApiList from "./useApiList";

const load = () => listVolunteers().then((data) => data.volunteers);

/** The signed-in NGO's volunteers, newest first. */
const useVolunteers = () => {
  const { items: volunteers, setItems, loading, error, reload } = useApiList(load, "Could not load your volunteers.");

  /** Put an added or edited volunteer into the list without reloading. */
  const upsert = useCallback(
    (volunteer) =>
      setItems((current) =>
        current.some((v) => v.id === volunteer.id) ? current.map((v) => (v.id === volunteer.id ? volunteer : v)) : [volunteer, ...current]
      ),
    [setItems]
  );
  const remove = useCallback((id) => setItems((current) => current.filter((v) => v.id !== id)), [setItems]);

  return { volunteers, loading, error, reload, upsert, remove };
};

export default useVolunteers;
