import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import DashboardNavbar from "./DashboardNavbar";
import Alert from "../ui/Alert";

// Shell for every dashboard page: sidebar (drawer below 1024px) + top bar + scrolling content.
// `dashboard-theme` (index.css) gives every portal the indigo brand colour, its font and the soft
// background wash — dialogs opened from a page are inside it too. `dashboard-sky` fills the boxes
// with sky blue in the donor, NGO and school portals; the admin portal keeps white boxes.
const SKY_PORTALS = ["donor", "ngo", "school"];

const DashboardLayout = ({
    role = "school",
    userName = "Admin",
    userSub = "",
    title = "Dashboard",
    subtitle = "",
    notifications = [],
    children,
}) => {
    const [navOpen, setNavOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    // Set by the sign-in page the first time an existing account is linked to Google.
    const googleLinked = location.state?.notice === "google-linked";
    const dismissNotice = () => navigate(`${location.pathname}${location.search}`, { replace: true, state: null });

    return (
        <div className={`dashboard-theme ${SKY_PORTALS.includes(role) ? "dashboard-sky" : ""} flex h-screen overflow-hidden`}>
            <Sidebar role={role} userName={userName} userSub={userSub} mobileOpen={navOpen} onClose={() => setNavOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <DashboardNavbar
                    role={role}
                    title={title}
                    subtitle={subtitle}
                    notifications={notifications}
                    onMenuClick={() => setNavOpen(true)}
                    menuOpen={navOpen}
                />
                {googleLinked && (
                    <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-4">
                        <Alert tone="info" title="Google sign-in is now linked" className="mx-auto w-full max-w-7xl">
                            For your security, your old password was removed and other devices were signed out. To use a password
                            again, choose &ldquo;Forgot password?&rdquo; on the sign-in page.
                            <button type="button" onClick={dismissNotice} className="mt-2 block font-medium underline underline-offset-2">
                                Got it
                            </button>
                        </Alert>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
};

export default DashboardLayout;
