import RegistrationLayout, { AgreeCheckbox, RegistrationSuccess, ReviewSummary } from "../../components/auth/RegistrationLayout";
import FileUploadField from "../../components/auth/FileUploadField";
import Alert from "../../components/ui/Alert";
import ChoiceChips from "../../components/ui/ChoiceChips";
import FormField, { Input, Select, Textarea } from "../../components/ui/FormField";
import useRegistrationForm from "../../hooks/useRegistrationForm";
import { NGO_FOCUS_AREAS, NGO_STATES, NGO_TYPES } from "../../../shared/registrationRules.js";

const STEPS = ["Organisation", "Mission", "Registration", "Address", "Contact & account", "Documents", "Review"];

const INITIAL_FORM = {
  ngoName: "", type: "", established: "", website: "", mission: "",
  focus: [], regNumber: "", regDate: "", pan: "",
  address: "", district: "", state: "",
  contactName: "", email: "", phone: "", altPhone: "", password: "", confirm: "",
  agree: false,
};

const NGORegister = () => {
  const { form, set, files, setFile, step, errors, messages, loading, handleContinue, handleSubmit, prev, uploadRules } = useRegistrationForm("ngo", INITIAL_FORM);
  const isLastStep = step === STEPS.length - 1;

  if (step === STEPS.length) {
    return (
      <RegistrationSuccess label="NGO registration" title="Registration submitted" actionHref="/login/ngo" actionLabel="Go to NGO sign in">
        Your NGO is <strong className="font-semibold text-slate-900">pending admin approval</strong>. Our compliance team will verify your organisation and activate your account.
        You can sign in once it has been approved.
      </RegistrationSuccess>
    );
  }

  const attachedDocs = Object.entries(files).filter(([, f]) => f).map(([field]) => uploadRules[field].label);

  const steps = [
    <div key="organisation" className="space-y-5">
      <FormField label="NGO / organisation name" required error={errors.ngoName}>
        {(f) => <Input {...f} autoComplete="organization" value={form.ngoName} onChange={(e) => set("ngoName", e.target.value)} placeholder="Shiksha Foundation" />}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Organisation type" error={errors.type}>
          {(f) => (
            <Select {...f} value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="">Select type</option>
              {NGO_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          )}
        </FormField>
        <FormField label="Year established" error={errors.established}>
          {(f) => <Input {...f} type="number" inputMode="numeric" value={form.established} onChange={(e) => set("established", e.target.value)} placeholder="2010" />}
        </FormField>
      </div>
      <FormField label="Website" error={errors.website} hint="Optional">
        {(f) => <Input {...f} type="url" autoComplete="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://shikshafoundation.org" />}
      </FormField>
    </div>,

    <div key="mission" className="space-y-6">
      <FormField label="Mission statement" required error={errors.mission} hint="At least 20 characters.">
        {(f) => <Textarea {...f} rows={4} value={form.mission} onChange={(e) => set("mission", e.target.value)} placeholder="Describe your NGO's mission in education..." />}
      </FormField>
      <ChoiceChips label="Focus areas" options={NGO_FOCUS_AREAS} value={form.focus} onChange={(v) => set("focus", v)} error={errors.focus} />
    </div>,

    <div key="registration" className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Registration number" required error={errors.regNumber}>
          {(f) => <Input {...f} value={form.regNumber} onChange={(e) => set("regNumber", e.target.value)} placeholder="NGO/2010/REG/12345" />}
        </FormField>
        <FormField label="Registration date" required error={errors.regDate}>
          {(f) => <Input {...f} type="date" value={form.regDate} onChange={(e) => set("regDate", e.target.value)} />}
        </FormField>
      </div>
      <FormField label="PAN" required error={errors.pan} className="sm:max-w-xs">
        {(f) => <Input {...f} maxLength={10} autoComplete="off" className="uppercase" value={form.pan} onChange={(e) => set("pan", e.target.value)} placeholder="ABCDE1234F" />}
      </FormField>
      <Alert tone="neutral">Your registration details are verified by our compliance team before your account is activated.</Alert>
    </div>,

    <div key="address" className="space-y-5">
      <FormField label="Registered address" required error={errors.address}>
        {(f) => <Textarea {...f} autoComplete="street-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Full address including pin code" />}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="District" required error={errors.district}>
          {(f) => <Input {...f} value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="Bengaluru Urban" />}
        </FormField>
        <FormField label="State" required error={errors.state}>
          {(f) => (
            <Select {...f} value={form.state} onChange={(e) => set("state", e.target.value)}>
              <option value="">Select state</option>
              {NGO_STATES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          )}
        </FormField>
      </div>
    </div>,

    <div key="contact" className="space-y-5">
      <FormField label="Primary contact name" required error={errors.contactName}>
        {(f) => <Input {...f} autoComplete="name" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Programme Director" />}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Official email" required error={errors.email} hint="Used to sign in.">
          {(f) => <Input {...f} type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@ngo.org" />}
        </FormField>
        <FormField label="Phone" required error={errors.phone}>
          {(f) => <Input {...f} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />}
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Password" required error={errors.password} hint="At least 8 characters.">
          {(f) => <Input {...f} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 8 characters" />}
        </FormField>
        <FormField label="Confirm password" required error={errors.confirm}>
          {(f) => <Input {...f} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} placeholder="Repeat password" />}
        </FormField>
      </div>
      <FormField label="Alternate phone" error={errors.altPhone} hint="Optional" className="sm:max-w-xs">
        {(f) => <Input {...f} type="tel" value={form.altPhone} onChange={(e) => set("altPhone", e.target.value)} placeholder="+91 98765 43210" />}
      </FormField>
    </div>,

    <div key="documents" className="space-y-5">
      {Object.entries(uploadRules).map(([field, rule]) => (
        <FileUploadField key={field} field={field} rule={rule} file={files[field]} onChange={(file) => setFile(field, file)} error={errors[field]} />
      ))}
      <Alert tone="neutral">Documents are stored privately and are visible only to your NGO account and VIDYADAAN administrators for verification.</Alert>
    </div>,

    <div key="review" className="space-y-5">
      <ReviewSummary
        items={[
          ["NGO name", form.ngoName], ["Type", form.type], ["Reg. no.", form.regNumber], ["PAN", form.pan.toUpperCase()],
          ["State", form.state], ["Email", form.email], ["Focus", form.focus.join(", ")], ["Documents", attachedDocs.join(", ") || "None attached"],
        ]}
      />
      <AgreeCheckbox checked={form.agree} onChange={(v) => set("agree", v)} error={errors.agree}>
        I declare all information is accurate and agree to VIDYADAAN's <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 underline underline-offset-2 hover:text-primary-700">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 underline underline-offset-2 hover:text-primary-700">Privacy Policy</a>.
      </AgreeCheckbox>
    </div>,
  ];

  return (
    <RegistrationLayout
      label="NGO registration"
      steps={STEPS}
      step={step}
      isLastStep={isLastStep}
      messages={messages}
      loading={loading}
      nextDisabled={isLastStep && !form.agree}
      nextLabel={isLastStep ? (loading ? "Submitting…" : "Submit registration") : "Continue"}
      onPrev={prev}
      onNext={isLastStep ? handleSubmit : handleContinue}
      loginHref="/login/ngo"
    >
      {steps[step]}
    </RegistrationLayout>
  );
};

export default NGORegister;
