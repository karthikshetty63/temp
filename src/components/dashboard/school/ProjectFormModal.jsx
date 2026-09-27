import { useState } from "react";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import FormField, { Input, Select, Textarea } from "../../ui/FormField";
import Modal from "../../ui/Modal";
import {
  PROJECT_BUDGET_MAX,
  PROJECT_BUDGET_MIN,
  PROJECT_CATEGORIES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  createProject,
  updateProject,
  validateProject,
} from "../../../api/projects";

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  title: "",
  category: "",
  priority: "",
  problem: "",
  budget: "",
  studentsBenefited: "",
  expectedCompletion: "",
  location: "",
  materials: "",
};

const fromProject = (p) => ({
  title: p.title,
  category: p.category,
  priority: p.priority,
  problem: p.problem,
  budget: String(p.budget),
  studentsBenefited: String(p.studentsBenefited),
  expectedCompletion: p.expectedCompletion,
  location: p.location,
  materials: p.materials.join(", "),
  status: p.status,
});

/**
 * Create a project, or edit one (pass `project`). Checks with the same rules as the server,
 * shows the server's per-field errors, and hands the saved project to onSaved.
 */
const ProjectFormModal = ({ open, onClose, onSaved, project = null }) => {
  const isEdit = Boolean(project);
  // Editing a rejected project sends it back for review; the work status only exists once approved.
  const isResubmit = project?.reviewStatus === "REJECTED";
  const canSetStatus = project?.reviewStatus === "OPEN";
  const [form, setForm] = useState(() => (project ? fromProject(project) : EMPTY));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    // An edit sends only what changed, so the server keeps everything else as it was.
    const payload = isEdit
      ? Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== fromProject(project)[key]))
      : form;
    if (isEdit && !Object.keys(payload).length) {
      if (!isResubmit) return onClose();
      setError("Make the changes the review team asked for, then resubmit.");
      return undefined;
    }

    const { errors: clientErrors } = validateProject(payload, { isUpdate: isEdit });
    setErrors(clientErrors);
    setError("");
    if (Object.keys(clientErrors).length) return undefined;

    setSaving(true);
    try {
      const data = isEdit ? await updateProject(project.id, payload) : await createProject(payload);
      onSaved?.(data.project);
      onClose();
    } catch (saveError) {
      if (saveError.errors) setErrors(saveError.errors);
      else setError(saveError.message || "Could not save the project. Please try again.");
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
      title={isResubmit ? "Edit and resubmit" : isEdit ? "Edit project" : "New project"}
      description={
        isResubmit
          ? "Make the requested changes, then resubmit the project for review."
          : isEdit
            ? project.title
            : "Describe what your school needs. The VIDYADAAN team reviews every project before NGOs and donors can see it."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="project-form" loading={saving}>
            {saving ? "Saving…" : isResubmit ? "Resubmit for review" : isEdit ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {isResubmit && project.rejectionReason && (
          <Alert tone="warning" title="Changes requested by the review team">{project.rejectionReason}</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField label="Project title" required error={errors.title}>
          {(f) => <Input {...f} value={form.title} onChange={set("title")} placeholder="e.g. Smart classroom for Grades 3–5" maxLength={120} />}
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField label="Category" required error={errors.category}>
            {(f) => (
              <Select {...f} value={form.category} onChange={set("category")}>
                <option value="">Select a category</option>
                {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Priority" required error={errors.priority} hint={form.priority === "Critical" ? "Use Critical only for a risk to students' safety or health." : undefined}>
            {(f) => (
              <Select {...f} value={form.priority} onChange={set("priority")}>
                <option value="">Select a priority</option>
                {PROJECT_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            )}
          </FormField>
        </div>

        <FormField label="What's the problem, and how will this help?" required error={errors.problem} hint="The current condition, why it matters, and how students will benefit. Donors read this first.">
          {(f) => <Textarea {...f} rows={4} value={form.problem} onChange={set("problem")} maxLength={2000} placeholder="e.g. The roof leaks in 3 classrooms every monsoon, so 120 students lose teaching days…" />}
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <FormField label="Estimated budget (₹)" required error={errors.budget} hint={`₹${PROJECT_BUDGET_MIN.toLocaleString("en-IN")} – ₹${PROJECT_BUDGET_MAX.toLocaleString("en-IN")}`}>
            {(f) => <Input {...f} inputMode="numeric" value={form.budget} onChange={set("budget")} placeholder="120000" />}
          </FormField>
          <FormField label="Students benefited" required error={errors.studentsBenefited}>
            {(f) => <Input {...f} inputMode="numeric" value={form.studentsBenefited} onChange={set("studentsBenefited")} placeholder="240" />}
          </FormField>
          <FormField label="Expected completion" required error={errors.expectedCompletion}>
            {(f) => <Input {...f} type="date" min={isEdit ? undefined : today()} value={form.expectedCompletion} onChange={set("expectedCompletion")} />}
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField label="Location" error={errors.location} hint={isEdit ? undefined : "Leave empty to use your school's district."}>
            {(f) => <Input {...f} value={form.location} onChange={set("location")} maxLength={150} placeholder="e.g. Block B, Honnali" />}
          </FormField>
          <FormField label="Required materials" error={errors.materials} hint="Separate items with commas.">
            {(f) => <Input {...f} value={form.materials} onChange={set("materials")} placeholder="e.g. Smart TV, dual desks, wiring kit" />}
          </FormField>
        </div>

        {isEdit && canSetStatus && (
          <FormField label="Status" error={errors.status} className="sm:max-w-xs">
            {(f) => (
              <Select {...f} value={form.status} onChange={set("status")}>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}
          </FormField>
        )}
      </form>
    </Modal>
  );
};

export default ProjectFormModal;
