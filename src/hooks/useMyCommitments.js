import { listMyCommitments } from "../api/projects";
import useApiList from "./useApiList";

const load = () => listMyCommitments().then((data) => data.projects);

/** The needs the signed-in NGO has committed to fund, latest commitment first. */
const useMyCommitments = () => {
  const { items: projects, loading, error, reload, refresh } = useApiList(load, "Could not load your commitments.");
  return { projects, loading, error, reload, refresh };
};

export default useMyCommitments;
