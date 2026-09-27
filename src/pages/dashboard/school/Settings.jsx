import { useState } from "react";
import { Link } from "react-router-dom";
import { LuKeyRound, LuPencil } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import Alert from "../../../components/ui/Alert";
import Button from "../../../components/ui/Button";
import Card, { CardHeader } from "../../../components/ui/Card";
import PageHeader from "../../../components/ui/PageHeader";
import { buttonClasses } from "../../../components/ui/classes";
import { requestPasswordReset } from "../../../api/auth";
import { useAuth } from "../../../context/AuthContext";
import { PASSWORD_RESET_TTL_MINUTES } from "../../../../shared/registrationRules.js";

const Settings = () => {
  const { user } = useAuth();
  const [reset, setReset] = useState({ busy: false, sent: false, error: "" });

  // Uses the same emailed-link flow as "Forgot password?", so the new password is set on a
  // secure page and every other device is signed out.
  const sendResetLink = async () => {
    setReset({ busy: true, sent: false, error: "" });
    try {
      await requestPasswordReset(user.email);
      setReset({ busy: false, sent: true, error: "" });
    } catch (err) {
      setReset({ busy: false, sent: false, error: err.message || "Could not send the email. Please try again." });
    }
  };

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Settings" subtitle="Your account">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader title="Settings" description="Your sign-in details and password." />

          <Card>
            <CardHeader title="Account" />
            <dl className="divide-y divide-slate-200">
              {[
                ["Name", user?.name],
                ["Sign-in email", user?.email],
                ["Account type", "School"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 px-5 py-3 text-sm">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="sm:col-span-2 font-medium text-slate-900 break-words">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">The principal&rsquo;s name, phone, address and facilities are edited on your school profile.</p>
              <Link to="/dashboard/school/profile" className={buttonClasses({ variant: "secondary", size: "sm", className: "shrink-0" })}>
                <LuPencil className="w-3.5 h-3.5" aria-hidden="true" /> School profile
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Password" />
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                To change your password, we&rsquo;ll email you a secure link. It works for {PASSWORD_RESET_TTL_MINUTES} minutes, and
                setting a new password signs you out on every other device.
              </p>
              {reset.sent && (
                <Alert tone="success" title="Check your email">
                  We&rsquo;ve sent a link to {user?.email}. If it doesn&rsquo;t arrive in a few minutes, check your spam folder.
                </Alert>
              )}
              {reset.error && <Alert tone="danger">{reset.error}</Alert>}
              <Button variant="secondary" icon={LuKeyRound} onClick={sendResetLink} loading={reset.busy} disabled={!user?.email}>
                {reset.busy ? "Sending…" : reset.sent ? "Send the link again" : "Email me a reset link"}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </DashboardLayout>
  );
};

export default Settings;
