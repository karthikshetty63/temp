import { useCallback, useEffect, useState } from "react";

/**
 * A list loaded from the API, with loading and error states.
 * `load` must be a stable (module-level) function that resolves to the list.
 */
const useApiList = (load, fallbackError) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(
    () => load().then((list) => ({ list, error: "" }), (loadError) => ({ list: null, error: loadError.message || fallbackError })),
    [load, fallbackError]
  );
  const apply = useCallback((result) => {
    if (result.list) setItems(result.list);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    run().then((result) => active && apply(result));
    return () => {
      active = false;
    };
  }, [run, apply]);

  /** Load again, showing the loading state (the "Try again" button). */
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    apply(await run());
  }, [run, apply]);

  /** Load again in the background, keeping what's on screen until the new list arrives. */
  const refresh = useCallback(async () => apply(await run()), [run, apply]);

  return { items, setItems, loading, error, reload, refresh };
};

export default useApiList;
