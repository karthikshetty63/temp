import { listMyPayments } from "../api/payments";
import useApiList from "./useApiList";

const load = () => listMyPayments().then((data) => data.payments);

/** Every payment the signed-in NGO has recorded, newest first. */
const useMyPayments = () => {
  const { items: payments, loading, error, reload, refresh } = useApiList(load, "Could not load your payments.");
  return { payments, loading, error, reload, refresh };
};

export default useMyPayments;
