import { listSchoolPayments } from "../api/payments";
import useApiList from "./useApiList";

const load = () => listSchoolPayments().then((data) => data.payments);

/** Payments NGOs have recorded for the signed-in school's projects, newest first. */
const useSchoolPayments = () => {
  const { items: payments, loading, error, reload, refresh } = useApiList(load, "Could not load payments.");
  return { payments, loading, error, reload, refresh };
};

export default useSchoolPayments;
