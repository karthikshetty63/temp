import { useEffect, useId, useRef, useState } from "react";
import { LuImagePlus } from "react-icons/lu";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import FormField, { Input, Select } from "../../ui/FormField";
import Modal from "../../ui/Modal";
import { PHOTO_CAPTION_MAX, PHOTO_STAGES, PROJECT_PHOTO_RULE, uploadProjectPhoto, validatePhotoDetails } from "../../../api/photos";
import { getUploadError } from "../../../../shared/registrationRules.js";

/**
 * Add a photo to one of the school's projects. Checks with the same rules as the server,
 * shows the server's per-field errors, and hands the saved photo to onAdded.
 */
const AddPhotoModal = ({ open, onClose, onAdded, projects }) => {
  const [form, setForm] = useState(() => ({ projectId: projects.length === 1 ? projects[0].id : "", stage: "", caption: "" }));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const previewUrl = useRef(null);
  const photoId = useId();

  // The preview is a temporary browser URL; free it when the dialog closes.
  useEffect(() => () => previewUrl.current && URL.revokeObjectURL(previewUrl.current), []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const choosePhoto = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    const problem = getUploadError(PROJECT_PHOTO_RULE, chosen);
    if (problem) {
      setErrors((e) => ({ ...e, photo: problem }));
      return;
    }
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(chosen);
    setFile(chosen);
    setPreview(previewUrl.current);
    setErrors((e) => ({ ...e, photo: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { errors: detailErrors, values } = validatePhotoDetails(form);
    const clientErrors = { ...detailErrors, ...(file ? {} : { photo: "Choose a photo to upload." }) };
    setErrors(clientErrors);
    setError("");
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const data = await uploadProjectPhoto({ ...values, file });
      onAdded?.(data.photo);
      onClose();
    } catch (saveError) {
      if (saveError.errors) setErrors(saveError.errors);
      else setError(saveError.message || "Could not add the photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const openPicker = () => fileInput.current?.click();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add photo"
      description="Only your school and the VIDYADAAN team can see your photos."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="photo-form" loading={saving}>{saving ? "Uploading…" : "Add photo"}</Button>
        </>
      }
    >
      <form id="photo-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}

        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1.5">
            Photo<span className="text-red-600" aria-hidden="true"> *</span>
          </p>
          <input ref={fileInput} type="file" accept={PROJECT_PHOTO_RULE.types.join(",")} onChange={choosePhoto} className="hidden" aria-label="Photo" />
          {preview ? (
            <div className="space-y-2">
              <img src={preview} alt="The photo you chose" className="w-full h-56 object-contain rounded-lg border border-slate-200 bg-slate-100" />
              <Button variant="secondary" size="sm" onClick={openPicker}>Choose a different photo</Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openPicker}
              aria-describedby={`${photoId}-hint${errors.photo ? ` ${photoId}-error` : ""}`}
              className="w-full h-40 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              <LuImagePlus className="w-6 h-6" aria-hidden="true" />
              <span className="text-sm font-medium">Choose a photo</span>
            </button>
          )}
          <p id={`${photoId}-hint`} className="mt-1.5 text-xs text-slate-500">{PROJECT_PHOTO_RULE.hint}</p>
          {errors.photo && <p id={`${photoId}-error`} className="mt-1 text-xs font-medium text-red-600">{errors.photo}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField label="Project" required error={errors.projectId}>
            {(f) => (
              <Select {...f} value={form.projectId} onChange={set("projectId")}>
                <option value="">Select a project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Stage" required error={errors.stage}>
            {(f) => (
              <Select {...f} value={form.stage} onChange={set("stage")}>
                <option value="">When was it taken?</option>
                {PHOTO_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}
          </FormField>
        </div>

        <FormField label="Caption" error={errors.caption} hint="Optional. What does the photo show?">
          {(f) => <Input {...f} value={form.caption} onChange={set("caption")} maxLength={PHOTO_CAPTION_MAX} placeholder="e.g. The leaking roof above Class 4" />}
        </FormField>
      </form>
    </Modal>
  );
};

export default AddPhotoModal;
