import { Link } from "react-router-dom";
import { LuBell, LuMenu } from "react-icons/lu";

// Only portals that actually have a notifications page show the bell.
const NOTIFICATION_PAGES = { school: "/dashboard/school/notifications" };

const DashboardNavbar = ({ role = "school", title = "Dashboard", subtitle = "", notifications = [], onMenuClick, menuOpen = false }) => {
  const notificationsHref = NOTIFICATION_PAGES[role];
  const unread = notifications.length;

  return (
    <header className="sticky top-0 z-30 h-16 sm:h-18 shrink-0 flex items-center gap-3 px-4 sm:px-6 lg:px-8 bg-white/70 backdrop-blur-md border-b border-slate-200/70">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-controls="dashboard-mobile-nav"
        aria-expanded={menuOpen}
        className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-900/[0.05]"
      >
        <LuMenu className="w-5 h-5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-base font-bold tracking-tight text-slate-900 truncate">{title}</p>
        {subtitle && <p className="hidden sm:block text-[13px] text-slate-500 truncate">{subtitle}</p>}
      </div>

      {notificationsHref && (
        <Link
          to={notificationsHref}
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-xs transition-colors duration-150 hover:text-slate-900 hover:border-slate-300"
        >
          <LuBell className="w-[18px] h-[18px]" aria-hidden="true" />
          {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" aria-hidden="true" />}
        </Link>
      )}
    </header>
  );
};

export default DashboardNavbar;
