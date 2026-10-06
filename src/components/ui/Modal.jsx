import { useId, useRef } from "react";
import { LuX } from "react-icons/lu";
import useDialogFocus from "../../hooks/useDialogFocus";

const SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

/**
 * Accessible dialog: Escape and backdrop close it, focus moves into it on open,
 * Tab stays inside it, and focus returns to the trigger on close.
 * On phones it opens as a bottom sheet. `icon` (a react-icons component) shows in a tile by the title.
 * In the donor, NGO and school portals the header and footer take the sky colours (index.css).
 */
const Modal = ({ open, onClose, title, description, icon: Icon, size = "md", footer, dismissible = true, children }) => {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useDialogFocus(panelRef, open, onClose, { closeOnEscape: dismissible });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="fixed inset-0 bg-slate-900/50" aria-hidden="true" onClick={dismissible ? onClose : undefined} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative w-full ${SIZES[size] || SIZES.md} max-h-[92vh] flex flex-col overflow-hidden bg-white shadow-xl rounded-t-panel sm:rounded-panel focus:outline-none`}
      >
        <div className="dialog-head flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 shadow-xs ring-1 ring-inset ring-surface-line">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
              {description && <p id={descriptionId} className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-900/5">
              <LuX className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="dialog-foot flex flex-wrap items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
