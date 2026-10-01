import { useEffect, useState } from "react";
import { fetchFileObjectUrl } from "../../api/auth";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { buttonClasses } from "../ui/classes";

/**
 * Shows a payment proof (challan, receipt or transaction screenshot). Files are private, so it is
 * downloaded with the sign-in cookie and shown from a temporary URL: images inline, PDFs in a viewer.
 */
const ProofModal = ({ proof, title = "Payment proof", description, onClose }) => {
  const [state, setState] = useState({ url: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    fetchFileObjectUrl(proof.id).then(
      (url) => {
        objectUrl = url;
        if (cancelled) URL.revokeObjectURL(url);
        else setState({ url, error: "" });
      },
      (loadError) => !cancelled && setState({ url: null, error: loadError.message || "Could not load the proof." })
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proof.id]);

  const isPdf = proof.mimeType === "application/pdf";
  return (
    <Modal
      open
      size="lg"
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          {state.url && (
            <a href={state.url} download={proof.originalName || (isPdf ? "payment-proof.pdf" : "payment-proof")} className={buttonClasses({ variant: "secondary" })}>
              Download
            </a>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {!state.url && !state.error && <p className="text-sm text-slate-500" role="status">Loading the proof…</p>}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.url &&
        (isPdf ? (
          <iframe title="Payment proof (PDF)" src={state.url} className="h-[60vh] w-full rounded-lg border border-slate-200" />
        ) : (
          <img src={state.url} alt="Payment proof" className="max-h-[60vh] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain" />
        ))}
    </Modal>
  );
};

export default ProofModal;
