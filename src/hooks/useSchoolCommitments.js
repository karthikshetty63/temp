import { listSchoolCommitments } from "../api/projects";
import useApiList from "./useApiList";

const load = () => listSchoolCommitments().then((data) => data.commitments);

/** NGO funding commitments on the signed-in school's projects, newest first. */
const useSchoolCommitments = () => {
  const { items: commitments, loading, error, reload, refresh } = useApiList(load, "Could not load NGO commitments.");
  return { commitments, loading, error, reload, refresh };
};

export default useSchoolCommitments;
