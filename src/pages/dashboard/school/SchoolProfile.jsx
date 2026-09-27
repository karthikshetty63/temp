import { useRef, useState } from "react";
import { LuCircleCheck, LuPencil, LuSchool } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import SchoolProfileModal from "../../../components/dashboard/school/SchoolProfileModal";
import Alert from "../../../components/ui/Alert";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card, { CardHeader } from "../../../components/ui/Card";
import PageHeader from "../../../components/ui/PageHeader";
import ProtectedImage from "../../../components/ui/ProtectedImage";
import StatCard from "../../../components/ui/StatCard";
import { removeSchoolPhoto, uploadSchoolPhoto } from "../../../api/profile";
import { useAuth } from "../../../context/AuthContext";
import useMyProfile from "../../../hooks/useMyProfile";
import { REGISTRATION_SCHEMAS, SCHOOL_FACILITY_FIELDS, UPLOAD_RULES, getUploadError } from "../../../../shared/registrationRules.js";

const PHOTO_RULE = UPLOAD_RULES.school.schoolPhoto;
const FIELDS = REGISTRATION_SCHEMAS.school.fields;

// Stored as +91 and 10 digits; shown the way people write it.
const formatPhone = (phone) => (/^\+91\d{10}$/.test(phone || "") ? `+91 ${phone.slice(3, 8)} ${phone.slice(8)}` : phone);
const formatCount = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : "—");

const DetailList = ({ items }) => (
  <dl className="divide-y divide-slate-200">
    {items.map(([label, value]) => (
      <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 px-5 py-3 text-sm">
        <dt className="text-slate-500">{label}</dt>
        <dd className="sm:col-span-2 font-medium text-slate-900 break-words">{value || "—"}</dd>
      </div>
    ))}
  </dl>
);

const SchoolProfile = () => {
  const { user, refreshUser } = useAuth();
  // Everything on this page comes from the school's own registration (GET /api/profile/me).
  const { profile, loading, error, reload, setProfile } = useMyProfile();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const photoInput = useRef(null);
  const [photoStatus, setPhotoStatus] = useState({ busy: false, error: "", message: "" });

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = getUploadError(PHOTO_RULE, file);
    if (problem) return setPhotoStatus({ busy: false, error: problem, message: "" });
    setPhotoStatus({ busy: true, error: "", message: "" });
    try {
      const res = await uploadSchoolPhoto(file);
      setProfile((p) => ({ ...p, photo: res.photo }));
      setPhotoStatus({ busy: false, error: "", message: "Photo updated." });
    } catch (err) {
      setPhotoStatus({ busy: false, error: err.message, message: "" });
    }
  };

  const handlePhotoRemove = async () => {
    setPhotoStatus({ busy: true, error: "", message: "" });
    try {
      await removeSchoolPhoto();
      setProfile((p) => ({ ...p, photo: null }));
      setPhotoStatus({ busy: false, error: "", message: "Photo removed." });
    } catch (err) {
      setPhotoStatus({ busy: false, error: err.message, message: "" });
    }
  };

  const handleSaved = (saved, changes) => {
    setProfile(saved);
    setNotice("Your changes have been saved.");
    // The principal's name is also the account name in the sidebar.
    if ("principalName" in changes) refreshUser();
  };

  const facilities = SCHOOL_FACILITY_FIELDS.map((field) => ({ label: FIELDS[field].label, available: profile?.infrastructure?.[field] === true }));
  const location = [profile?.district, profile?.state].filter(Boolean).join(", ");

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="School profile" subtitle={profile?.schoolName}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            title="School profile"
            description="Details from your registration. Keep them accurate so NGOs and donors can trust your requests."
            actions={profile && <Button variant="secondary" icon={LuPencil} onClick={() => { setNotice(""); setIsEditOpen(true); }}>Edit profile</Button>}
          />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}
          {loading && <p className="text-sm text-slate-500" role="status">Loading your profile…</p>}
          {notice && <Alert tone="success">{notice}</Alert>}

          {profile && (
            <>
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="flex items-center gap-4">
                    <span className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                      <ProtectedImage
                        fileId={profile.photo?.id}
                        alt={`${profile.schoolName} photograph`}
                        className="w-full h-full object-cover"
                        fallback={<LuSchool className="w-8 h-8 text-slate-400" aria-hidden="true" />}
                      />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-slate-900">{profile.schoolName}</h2>
                      <p className="mt-0.5 text-sm text-slate-500">UDISE {profile.udise}{location && ` · ${location}`}</p>
                      {/* Only accounts the admin has approved can sign in, so this is always true here. */}
                      <Badge tone="success" icon={LuCircleCheck} className="mt-2">Verified school</Badge>
                    </div>
                  </div>

                  <div className="sm:ml-auto flex flex-wrap items-center gap-2">
                    <input ref={photoInput} type="file" accept={PHOTO_RULE.types.join(",")} onChange={handlePhotoSelected} className="sr-only" aria-label="Choose school photograph" />
                    <Button variant="secondary" size="sm" loading={photoStatus.busy} onClick={() => photoInput.current?.click()}>
                      {photoStatus.busy ? "Saving…" : profile.photo ? "Change photo" : "Add photo"}
                    </Button>
                    {profile.photo && !photoStatus.busy && (
                      <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={handlePhotoRemove}>Remove</Button>
                    )}
                  </div>
                </div>

                {photoStatus.error && <Alert tone="danger" className="mt-4">{photoStatus.error}</Alert>}
                {photoStatus.message && <Alert tone="success" className="mt-4">{photoStatus.message}</Alert>}
                <p className="mt-4 text-xs text-slate-500">School photograph: JPG, PNG or WebP, up to 5 MB.</p>
              </Card>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Students enrolled" value={formatCount(profile.students)} />
                <StatCard label="Teaching staff" value={formatCount(profile.teachers)} />
                <StatCard label="Facilities" value={`${facilities.filter((f) => f.available).length} of ${facilities.length}`} hint="Available at your school" />
                <StatCard label="Verification" value="Verified" hint="Approved by VIDYADAAN" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader title="Principal & contact" />
                  <DetailList
                    items={[
                      ["Principal", profile.principalName],
                      ["Phone", formatPhone(profile.phone)],
                      ["Official email", profile.email],
                      ["Address", profile.address],
                      ["District & state", location],
                    ]}
                  />
                </Card>

                <Card>
                  <CardHeader title="Facilities" description="As you reported them. Keep this up to date as things change." />
                  <ul className="divide-y divide-slate-200">
                    {facilities.map((f) => (
                      <li key={f.label} className="flex items-center justify-between gap-4 px-5 py-3">
                        <p className="text-sm font-medium text-slate-900">{f.label}</p>
                        <Badge tone={f.available ? "success" : "neutral"}>{f.available ? "Available" : "Not available"}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
      {isEditOpen && profile && <SchoolProfileModal open profile={profile} onClose={() => setIsEditOpen(false)} onSaved={handleSaved} />}
    </DashboardLayout>
  );
};

export default SchoolProfile;
