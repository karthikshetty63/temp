import { LuCalendarDays } from "react-icons/lu";
import { Link } from "react-router-dom";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import { buttonClasses } from "../../../components/ui/classes";
import { useAuth } from "../../../context/AuthContext";

// Events aren't stored anywhere yet, so there is nothing real to show or save. The previous
// sample events and "Create event" form (which kept nothing) have been removed.
const SchoolEvents = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="School events" subtitle="Sports Day, Annual Day, fairs and drives">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader title="School events" description="Plan Sports Day, Annual Day, science fairs and meal drives, and ask NGOs and donors to support them." />
          <Card>
            <EmptyState
              icon={LuCalendarDays}
              title="School events are coming soon"
              description="You'll be able to create events and ask for support here. Until then, add what your school needs as a project."
              action={<Link to="/dashboard/school/projects" className={buttonClasses({ variant: "secondary" })}>Go to projects</Link>}
            />
          </Card>
        </div>
      </main>
    </DashboardLayout>
  );
};

export default SchoolEvents;
