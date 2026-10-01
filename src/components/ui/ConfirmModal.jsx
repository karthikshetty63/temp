import { useState } from "react";
import Alert from "./Alert";
import Button from "./Button";
import Modal from "./Modal";

/**
 * "Are you sure?" for an action that runs on the server. `onConfirm` returns a promise; while it
 * runs the dialog can't be closed, and if it fails the error is shown in place.
 */
const ConfirmModal = ({ title, children, confirmLabel, busyLabel, variant = "destructive", onConfirm, onClose }) => {
  const [state, setState] = useState({ busy: false, error: "" });

  const confirm = async () => {
    setState({ busy: true, error: "" });
    try {
      await onConfirm();
      onClose();
    } catch (actionError) {
      setState({ busy: false, error: actionError.message || "Something went wrong. Please try again." });
    }
  };

  return (
    <Modal
      open
      size="sm"
      onClose={state.busy ? () => {} : onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={state.busy}>Cancel</Button>
          <Button variant={variant} onClick={confirm} loading={state.busy}>{state.busy ? busyLabel : confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        {children}
        {state.error && <Alert tone="danger">{state.error}</Alert>}
      </div>
    </Modal>
  );
};

export default ConfirmModal;
