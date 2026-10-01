import { useState } from "react";
import { createVolunteer, updateVolunteer, validateVolunteer } from "../../../api/volunteers";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import FormField, { Input, Select } from "../../ui/FormField";
import Modal from "../../ui/Modal";

const fromVolunteer = (v) => ({ name: v?.name || "", role: v?.role || "", phone: v?.phone || "", projectId: v?.project?.id || "" });

/**
 * Add a volunteer, or edit one (pass `volunteer`). `projects` are the needs the NGO is funding —
 * the only ones a volunteer can be assigned to. Checks with the same rules as the server.
 */
const VolunteerFormModal = ({ volunteer = null, projects, onClose, onSaved }) => {
  const isEdit = Boolean(volunteer);
  const initial = fromVolunteer(volunteer);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Keep a current assignment selectable even if the NGO has since withdrawn from that need.
  const options = volunteer?.project && !projects.some((p) => p.id === volunteer.project.id) ? [volunteer.project, ...projects] : projects;
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    // An edit sends only what changed.
    const payload = isEdit ? Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== initial[key])) : form;
    if (isEdit && !Object.keys(payload).length) return onClose();

    const { errors: clientErrors } = validateVolunteer(payload, { isUpdate: isEdit });
    setErrors(clientErrors);
    setError("");
    if (Object.keys(clientErrors).length) return undefined;

    setSaving(true);
    try {
      const data = isEdit ? await updateVolunteer(volunteer.id, payload) : await createVolunteer(payload);
      onSaved(data.volunteer);
      onClose();
    } catch (saveError) {
      if (saveError.errors) setErrors(saveError.errors);
      else setError(saveError.message || "Could not save the volunteer. Please try again.");
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={isEdit ? "Edit volunteer" : "Add volunteer"}
      description={isEdit ? volunteer.name : "Someone from your NGO who works on school projects."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="volunteer-form" loading={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add volunteer"}</Button>
        </>
      }
    >
      <form id="volunteer-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label="Name" required error={errors.name}>
          {(f) => <Input {...f} value={form.name} onChange={set("name")} maxLength={80} autoComplete="off" />}
        </FormField>
        <FormField label="Role" required error={errors.role}>
          {(f) => <Input {...f} value={form.role} onChange={set("role")} maxLength={60} placeholder="e.g. Field coordinator" />}
        </FormField>
        <FormField label="Phone number" error={errors.phone} hint="Optional. A 10-digit Indian number.">
          {(f) => <Input {...f} type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} autoComplete="off" />}
        </FormField>
        <FormField
          label="Working on"
          error={errors.projectId}
          hint={options.length ? "One of the school needs your NGO is funding." : "Fund a school need first to assign volunteers to it."}
        >
          {(f) => (
            <Select {...f} value={form.projectId} onChange={set("projectId")} disabled={!options.length}>
              <option value="">Not assigned yet</option>
              {options.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          )}
        </FormField>
      </form>
    </Modal>
  );
};

export default VolunteerFormModal;
