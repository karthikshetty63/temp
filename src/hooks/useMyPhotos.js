import { useCallback, useEffect, useState } from "react";
import { listMyPhotos } from "../api/photos";

const fetchPhotos = () =>
  listMyPhotos().then(
    (data) => ({ photos: data.photos, error: "" }),
    (loadError) => ({ photos: null, error: loadError.message || "Could not load your photos." })
  );

/** The signed-in school's own project photos from the server, with loading and error states. */
const useMyPhotos = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apply = useCallback((result) => {
    if (result.photos) setPhotos(result.photos);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchPhotos().then((result) => active && apply(result));
    return () => {
      active = false;
    };
  }, [apply]);

  /** Load again (the "Try again" button). */
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    apply(await fetchPhotos());
  }, [apply]);

  /** A newly added photo goes first (the list is newest first). */
  const add = useCallback((photo) => setPhotos((current) => [photo, ...current]), []);
  const remove = useCallback((id) => setPhotos((current) => current.filter((p) => p.id !== id)), []);

  return { photos, loading, error, reload, add, remove };
};

export default useMyPhotos;
