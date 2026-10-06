import { useId } from "react";
import { inputClasses } from "./classes";

// Shared form controls. Labels are always linked to their input, and errors are
// announced through aria-describedby / aria-invalid.

export const Input = ({ invalid, className = "", ...props }) => (
  <input className={inputClasses({ invalid, className: `h-10 px-3 ${className}` })} aria-invalid={invalid || undefined} {...props} />
);

export const Select = ({ invalid, className = "", children, ...props }) => (
  <select className={inputClasses({ invalid, className: `h-10 px-3 pr-8 ${className}` })} aria-invalid={invalid || undefined} {...props}>
    {children}
  </select>
);

export const Textarea = ({ invalid, className = "", rows = 3, ...props }) => (
  <textarea rows={rows} className={inputClasses({ invalid, className: `px-3 py-2 resize-y ${className}` })} aria-invalid={invalid || undefined} {...props} />
);

/**
 * Label + control + hint/error.
 * `children` is a function receiving the props the control needs:
 *   <FormField label="Email" error={errors.email}>{(field) => <Input type="email" {...field} />}</FormField>
 */
const FormField = ({ label, required = false, hint, error, className = "", children, id: providedId }) => {
  const generatedId = useId();
  const id = providedId || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </label>
      {children({ id, invalid: Boolean(error), "aria-describedby": describedBy, "aria-required": required || undefined })}
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
};

export default FormField;
