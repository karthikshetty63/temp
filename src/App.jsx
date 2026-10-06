import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import GuestRoute from "./components/auth/GuestRoute";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Home from "./pages/Home";
import Contact from "./pages/legal/Contact";
import Privacy from "./pages/legal/Privacy";
import RefundPolicy from "./pages/legal/RefundPolicy";
import Terms from "./pages/legal/Terms";
import RoleSelector from "./pages/auth/RoleSelector";
import SchoolLogin from "./pages/auth/SchoolLogin";
import NGOLogin from "./pages/auth/NGOLogin";
import DonorLogin from "./pages/auth/DonorLogin";
import JoinSelector from "./pages/auth/JoinSelector";
import SchoolRegister from "./pages/auth/SchoolRegister";
import NGORegister from "./pages/auth/NGORegister";
import DonorRegister from "./pages/auth/DonorRegister";
import SchoolDashboard from "./pages/dashboard/school/SchoolDashboard";
import SchoolProfile from "./pages/dashboard/school/SchoolProfile";
import Infrastructure from "./pages/dashboard/school/Infrastructure";
import SchoolEvents from "./pages/dashboard/school/SchoolEvents";
import ManageProjects from "./pages/dashboard/school/ManageProjects";
import ProjectProgress from "./pages/dashboard/school/ProjectProgress";
import Gallery from "./pages/dashboard/school/Gallery";
import DonationHistory from "./pages/dashboard/school/DonationHistory";
import SchoolReports from "./pages/dashboard/school/Reports";
import SchoolNotifications from "./pages/dashboard/school/Notifications";
import SchoolSettings from "./pages/dashboard/school/Settings";
import NGODashboard from "./pages/dashboard/ngo/NGODashboard";
import DonorDashboard from "./pages/dashboard/donor/DonorDashboard";
import AdminLogin from "./pages/auth/AdminLogin";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import AdminDashboard from "./pages/dashboard/admin/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public landing page and policies (open to everyone, signed in or not) */}
          <Route path="/" element={<Home />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/contact" element={<Contact />} />

          {/* Sign-in and registration: anyone already signed in goes straight to their dashboard */}
          <Route element={<GuestRoute />}>
            {/* Auth — Login */}
            <Route path="/login" element={<RoleSelector />} />
            <Route path="/login/school" element={<SchoolLogin />} />
            <Route path="/login/ngo" element={<NGOLogin />} />
            <Route path="/login/donor" element={<DonorLogin />} />
            {/* Admin login only — admin accounts are created with `npm run create-admin` */}
            <Route path="/login/admin" element={<AdminLogin />} />

            {/* Auth — Register */}
            <Route path="/join" element={<JoinSelector />} />
            <Route path="/join/school" element={<SchoolRegister />} />
            <Route path="/join/ngo" element={<NGORegister />} />
            <Route path="/join/donor" element={<DonorRegister />} />
          </Route>

          {/* Auth — Password reset, shared by every portal (accounts are identified by email) */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* School Admin Portal — 12 Pages */}
          <Route element={<ProtectedRoute role="school" />}>
            <Route path="/dashboard/school" element={<SchoolDashboard />} />
            <Route path="/dashboard/school/profile" element={<SchoolProfile />} />
            <Route path="/dashboard/school/infrastructure" element={<Infrastructure />} />
            <Route path="/dashboard/school/events" element={<SchoolEvents />} />
            <Route path="/dashboard/school/projects" element={<ManageProjects />} />
            <Route path="/dashboard/school/progress" element={<ProjectProgress />} />
            <Route path="/dashboard/school/gallery" element={<Gallery />} />
            <Route path="/dashboard/school/donations" element={<DonationHistory />} />
            <Route path="/dashboard/school/reports" element={<SchoolReports />} />
            <Route path="/dashboard/school/notifications" element={<SchoolNotifications />} />
            <Route path="/dashboard/school/settings" element={<SchoolSettings />} />
          </Route>

          {/* NGO & Donor Dashboards */}
          <Route element={<ProtectedRoute role="ngo" />}>
            <Route path="/dashboard/ngo" element={<NGODashboard />} />
          </Route>
          <Route element={<ProtectedRoute role="donor" />}>
            <Route path="/dashboard/donor" element={<DonorDashboard />} />
          </Route>

          {/* Platform admin — approves school & NGO registrations */}
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/dashboard/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;