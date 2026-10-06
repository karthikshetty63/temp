import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LuBell, LuBuilding2, LuCalendarDays, LuChevronsLeft, LuChevronsRight, LuClipboardList,
  LuFileChartColumn, LuFolderKanban, LuHandCoins, LuImages, LuLayoutDashboard, LuLogOut, LuSchool, LuSettings,
  LuTrendingUp, LuUserCheck, LuUsers, LuWallet, LuX,
} from "react-icons/lu";
import { useAuth } from "../../context/AuthContext";
import useDialogFocus from "../../hooks/useDialogFocus";
import { LogoEmblem } from "../ui/VidyadaanLogo";

const NAV = {
  school: [
    { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard/school" },
    { icon: LuSchool, label: "School Profile", href: "/dashboard/school/profile" },
    { icon: LuBuilding2, label: "Infrastructure Needs", href: "/dashboard/school/infrastructure" },
    { icon: LuCalendarDays, label: "School Events", href: "/dashboard/school/events" },
    { icon: LuFolderKanban, label: "Manage Projects", href: "/dashboard/school/projects" },
    { icon: LuTrendingUp, label: "Project Progress", href: "/dashboard/school/progress" },
    { icon: LuImages, label: "Gallery", href: "/dashboard/school/gallery" },
    { icon: LuHandCoins, label: "Donation History", href: "/dashboard/school/donations" },
    { icon: LuFileChartColumn, label: "Reports", href: "/dashboard/school/reports" },
    { icon: LuBell, label: "Notifications", href: "/dashboard/school/notifications" },
    { icon: LuSettings, label: "Settings", href: "/dashboard/school/settings" },
  ],
  ngo: [
    { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard/ngo#overview" },
    { icon: LuClipboardList, label: "School Needs", href: "/dashboard/ngo#needs" },
    { icon: LuFolderKanban, label: "Your Projects", href: "/dashboard/ngo#projects" },
    { icon: LuWallet, label: "Funding", href: "/dashboard/ngo#funding" },
    { icon: LuUsers, label: "Volunteers", href: "/dashboard/ngo#volunteers" },
    { icon: LuCalendarDays, label: "School Events", href: "/dashboard/ngo#events" },
  ],
  // Only sections that exist on the donor page.
  donor: [
    { icon: LuLayoutDashboard, label: "Dashboard", href: "/dashboard/donor#overview" },
    { icon: LuClipboardList, label: "School Needs", href: "/dashboard/donor#needs" },
    { icon: LuHandCoins, label: "My Donations", href: "/dashboard/donor#donations" },
    { icon: LuCalendarDays, label: "School Events", href: "/dashboard/donor#events" },
  ],
  admin: [
    { icon: LuUserCheck, label: "Account Approvals", href: "/dashboard/admin" },
  ],
};

const PORTAL_LABELS = { school: "School portal", ngo: "NGO portal", donor: "Donor portal", admin: "Admin console" };

/**
 * Dashboard navigation.
 * ≥1024px: fixed sidebar (collapsible). <1024px: off-canvas drawer opened from the top bar.
 */
const Sidebar = ({ role = "school", userName = "Admin", userSub = "", mobileOpen = false, onClose = () => {} }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const drawerRef = useRef(null);
  useDialogFocus(drawerRef, mobileOpen, onClose);

  const links = NAV[role] || NAV.school;
  // Hash-based portals (NGO / donor) start on their first section.
  const currentHash = location.hash || (links[0].href.includes("#") ? `#${links[0].href.split("#")[1]}` : "");

  const isActive = (href) => (href.includes("#") ? location.pathname + currentHash === href : location.pathname === href);

  const handleNavClick = (href) => {
    onClose();
    if (href.includes("#")) {
      const id = href.split("#")[1];
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // AuthContext already cleared the local user; still leave the dashboard.
    }
    navigate(`/login/${role}`, { replace: true });
  };

  const renderNav = (compact) => (
    <>
      <nav aria-label="Main" className={`flex-1 overflow-y-auto py-5 ${compact ? "px-3" : "px-4"}`}>
        {!compact && <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Menu</p>}
        <ul className="space-y-1">
          {links.map(({ icon: Icon, label, href }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  to={href}
                  onClick={() => handleNavClick(href)}
                  aria-current={active ? "page" : undefined}
                  title={compact ? label : undefined}
                  className={`group flex items-center ${compact ? "justify-center px-0" : "gap-3 px-3"} h-10 rounded-xl text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "bg-primary-600 text-white shadow-sm shadow-primary-600/25"
                      : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors duration-150 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`}
                    aria-hidden="true"
                  />
                  {compact ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`m-3 rounded-2xl bg-slate-50/80 ring-1 ring-inset ring-slate-200/70 p-2.5 flex items-center ${compact ? "flex-col gap-2" : "gap-3"}`}>
        <span className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center shrink-0" aria-hidden="true">
          {(userName || "?").charAt(0).toUpperCase()}
        </span>
        {!compact && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
            {userSub && <p className="text-xs text-slate-500 truncate">{userSub}</p>}
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Log out"
          aria-label="Logout"
          className="p-2 rounded-lg text-slate-500 transition-colors duration-150 hover:text-slate-800 hover:bg-white disabled:opacity-50"
        >
          <LuLogOut className="w-[18px] h-[18px]" aria-hidden="true" />
        </button>
      </div>
    </>
  );

  const brand = (compact) => (
    <Link to="/" className="flex items-center gap-3 min-w-0 rounded-lg" aria-label="VIDYADAAN home">
      <LogoEmblem className="w-9 h-9 shrink-0" />
      {!compact && (
        <span className="min-w-0">
          <span className="block text-[15px] font-extrabold tracking-wide text-brand-navy leading-tight">VIDYADAAN</span>
          <span className="block text-xs font-medium text-slate-500 leading-tight">{PORTAL_LABELS[role]}</span>
        </span>
      )}
    </Link>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex ${collapsed ? "w-[76px]" : "w-68"} shrink-0 h-screen flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/70 transition-[width] duration-200 motion-reduce:transition-none`}
      >
        <div className={`h-18 shrink-0 flex items-center ${collapsed ? "justify-center" : "justify-between px-5"} border-b border-slate-200/70`}>
          {brand(collapsed)}
        </div>
        {renderNav(collapsed)}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="flex items-center justify-center gap-2 h-10 border-t border-slate-200/70 text-xs font-medium text-slate-500 transition-colors duration-150 hover:text-slate-800 hover:bg-slate-900/[0.03]"
        >
          {collapsed ? <LuChevronsRight className="w-4 h-4" aria-hidden="true" /> : <><LuChevronsLeft className="w-4 h-4" aria-hidden="true" /> Collapse</>}
        </button>
      </aside>

      {/* Mobile / tablet drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={onClose} />
          <aside
            id="dashboard-mobile-nav"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-white shadow-xl"
          >
            <div className="h-18 shrink-0 flex items-center justify-between px-5 border-b border-slate-200/70">
              {brand(false)}
              <button type="button" onClick={onClose} aria-label="Close navigation" data-autofocus className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">
                <LuX className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {renderNav(false)}
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
