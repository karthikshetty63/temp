import { useState } from "react";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import FormField, { Input, Textarea } from "../../ui/FormField";
import Modal from "../../ui/Modal";
import { updateSchoolProfile } from "../../../api/profile";
import { REGISTRATION_SCHEMAS, SCHOOL_FACILITY_FIELDS, validateSchoolProfileUpdate } from "../../../../shared/registrationRules.js";

const FIELDS = REGISTRATION_SCHEMAS.school.fields;

// The stored profile → the form's values (numbers as text, facilities as booleans).
const fromProfile = (p) => ({
  principalName: p.principalName || "",
  phone: p.phone || "",
  address: p.address || "",
  students: p.students ?? "",
  teachers: p.teachers ?? "",
  ...Object.fromEntries(SCHOOL_FACILITY_FIELDS.map((f) => [f, p.infrastructure?.[f] === true])),
});

/**
 * Edit the details a school may change itself. Checks with the same rules as the server, sends
 * only what changed, and hands the saved profile to onSaved. The verified identity is shown read-only.
 */
const SchoolProfileModal = ({ open, onClose, profile, onSaved }) => {
  const initial = fromProfile(profile);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) => String(value) !== String(initial[key])));
    if (!Object.keys(changes).length) return onClose();

    const { errors: clientErrors } = validateSchoolProfileUpdate(changes);
    setErrors(clientErrors);
    setError("");
    if (Object.keys(clientErrors).length) return undefined;

    setSaving(true);
    try {
      const data = await updateSchoolProfile(changes);
      onSaved?.(data.profile, changes);
      onClose();
    } catch (saveError) {
      if (saveError.errors) setErrors(saveError.errors);
      else setError(saveError.message || "Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Edit school profile"
      description={`${profile.schoolName} · UDISE ${profile.udise}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="school-profile-form" loading={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </>
      }
    >
      <form id="school-profile-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <Alert tone="neutral">
          Your school&rsquo;s name, UDISE code, district, state, email and bank details were verified when your account was approved.
          To change them, contact the VIDYADAAN team.
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField label={FIELDS.principalName.label} required error={errors.principalName}>
            {(f) => <Input {...f} value={form.principalName} onChange={set("principalName")} maxLength={120} autoComplete="name" />}
          </FormField>
          <FormField label={FIELDS.phone.label} required error={errors.phone}>
            {(f) => <Input {...f} type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />}
          </FormField>
        </div>

        <FormField label={FIELDS.address.label} required error={errors.address}>
          {(f) => <Textarea {...f} rows={2} value={form.address} onChange={set("address")} maxLength={300} />}
        </FormField>

        <div className="grid grid-cols-2 gap-5">
          <FormField label={FIELDS.students.label} error={errors.students}>
            {(f) => <Input {...f} inputMode="numeric" value={form.students} onChange={set("students")} />}
          </FormField>
          <FormField label={FIELDS.teachers.label} error={errors.teachers}>
            {(f) => <Input {...f} inputMode="numeric" value={form.teachers} onChange={set("teachers")} />}
          </FormField>
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-slate-700 mb-2">Facilities your school has</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SCHOOL_FACILITY_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-3 h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={form[field]} onChange={set(field)} className="w-4 h-4 rounded border-slate-300 accent-primary-600" />
                {FIELDS[field].label}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};

export default SchoolProfileModal;
