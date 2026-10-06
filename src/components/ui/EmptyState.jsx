import { LuInbox } from "react-icons/lu";

const EmptyState = ({ icon: Icon = LuInbox, title, description, action, className = "" }) => (
  <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
    <span className="w-11 h-11 rounded-xl bg-surface-muted ring-1 ring-inset ring-slate-200/80 flex items-center justify-center">
      <Icon className="w-5 h-5 text-slate-400" aria-hidden="true" />
    </span>
    <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
    {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
