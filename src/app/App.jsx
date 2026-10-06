import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/public/Home";
import RoleSelector from "../pages/auth/RoleSelector";
import SchoolLogin from "../pages/auth/SchoolLogin";
import NGOLogin from "../pages/auth/NGOLogin";
import DonorLogin from "../pages/auth/DonorLogin";
import JoinSelector from "../pages/auth/JoinSelector";
import SchoolRegister from "../pages/auth/SchoolRegister";
import NGORegister from "../pages/auth/NGORegister";
import DonorRegister from "../pages/auth/DonorRegister";
import SchoolDashboard from "../pages/dashboard/school/SchoolDashboard";
import SchoolProfile from "../pages/dashboard/school/SchoolProfile";
import Infrastructure from "../pages/dashboard/school/Infrastructure";
import SchoolEvents from "../pages/dashboard/school/SchoolEvents";
import ManageProjects from "../pages/dashboard/school/ManageProjects";
import ProjectProgress from "../pages/dashboard/school/ProjectProgress";
import Gallery from "../pages/dashboard/school/Gallery";
import DonationHistory from "../pages/dashboard/school/DonationHistory";
import SchoolReports from "../pages/dashboard/school/Reports";
import SchoolNotifications from "../pages/dashboard/school/Notifications";
import SchoolSettings from "../pages/dashboard/school/Settings";
import NGODashboard from "../pages/dashboard/ngo/NGODashboard";
import DonorDashboard from "../pages/dashboard/donor/DonorDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<Home />} />

        {/* Auth — Login */}
        <Route path="/login" element={<RoleSelector />} />
        <Route path="/login/school" element={<SchoolLogin />} />
        <Route path="/login/ngo" element={<NGOLogin />} />
        <Route path="/login/donor" element={<DonorLogin />} />

        {/* Auth — Register */}
        <Route path="/join" element={<JoinSelector />} />
        <Route path="/join/school" element={<SchoolRegister />} />
        <Route path="/join/ngo" element={<NGORegister />} />
        <Route path="/join/donor" element={<DonorRegister />} />

        {/* School Admin Portal — 12 Pages */}
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

        {/* NGO & Donor Dashboards */}
        <Route path="/dashboard/ngo" element={<NGODashboard />} />
        <Route path="/dashboard/donor" element={<DonorDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;