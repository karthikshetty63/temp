import FileUploadField from "../../components/auth/FileUploadField";
import RegistrationLayout, { AgreeCheckbox, RegistrationSuccess, ReviewSummary } from "../../components/auth/RegistrationLayout";
import Alert from "../../components/ui/Alert";
import ChoiceChips from "../../components/ui/ChoiceChips";
import FormField, { Input, Select, Textarea } from "../../components/ui/FormField";
import SegmentedControl from "../../components/ui/SegmentedControl";
import useRegistrationForm from "../../hooks/useRegistrationForm";
import { DONOR_CAUSES, DONOR_FREQUENCIES, DONOR_STATES } from "../../../shared/registrationRules.js";

const STEPS = ["Personal details", "Address", "Password", "Preferences", "Documents", "Review"];

const INITIAL_FORM = {
  name: "", email: "", phone: "", dob: "",
  address: "", city: "", state: "", pin: "",
  password: "", confirm: "",
  causes: [], frequency: "", anonymous: false,
  agree: false,
};

const DonorRegister = () => {
  const { form, set, files, setFile, step, errors, messages, loading, handleContinue, handleSubmit, prev, uploadRules } = useRegistrationForm("donor", INITIAL_FORM);
  const isLastStep = step === STEPS.length - 1;

  if (step === STEPS.length) {
    return (
      <RegistrationSuccess label="Donor registration" title="Registration submitted" actionHref="/login/donor" actionLabel="Go to donor sign in">
        Your account is <strong className="font-semibold text-slate-900">pending admin approval</strong>. Our team will check your PAN card, and you can
        sign in once your account is approved.
      </RegistrationSuccess>
    );
  }

  const attachedDocs = Object.entries(files).filter(([, f]) => f).map(([field]) => uploadRules[field].label);

  const passwordsMatch = form.password && form.confirm && form.password === form.confirm;

  const steps = [
    <div key="personal" className="space-y-5">
      <FormField label="Full name" required error={errors.name}>
        {(f) => <Input {...f} autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ramesh Kumar" />}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Email address" required error={errors.email}>
          {(f) => <Input {...f} type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />}
        </FormField>
        <FormField label="Phone number" required error={errors.phone}>
          {(f) => <Input {...f} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />}
        </FormField>
      </div>
      <FormField label="Date of birth" error={errors.dob} className="sm:max-w-xs">
        {(f) => <Input {...f} type="date" autoComplete="bday" value={form.dob} onChange={(e) => set("dob", e.target.value)} />}
      </FormField>
    </div>,

    <div key="address" className="space-y-5">
      <FormField label="Address" required error={errors.address}>
        {(f) => <Textarea {...f} autoComplete="street-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Flat / House / Street..." />}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <FormField label="City" required error={errors.city}>
          {(f) => <Input {...f} autoComplete="address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Bengaluru" />}
        </FormField>
        <FormField label="State" required error={errors.state}>
          {(f) => (
            <Select {...f} value={form.state} onChange={(e) => set("state", e.target.value)}>
              <option value="">Select state</option>
              {DONOR_STATES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          )}
        </FormField>
        <FormField label="PIN code" required error={errors.pin}>
          {(f) => <Input {...f} inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pin} onChange={(e) => set("pin", e.target.value)} placeholder="560001" />}
        </FormField>
      </div>
    </div>,

    <div key="password" className="space-y-5">
      <FormField label="Password" required error={errors.password} hint="At least 8 characters. A mix of letters, numbers and symbols is recommended.">
        {(f) => <Input {...f} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 8 characters" />}
      </FormField>
      <FormField label="Confirm password" required error={errors.confirm} hint={passwordsMatch ? "Passwords match." : undefined}>
        {(f) => <Input {...f} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} placeholder="Repeat password" />}
      </FormField>
    </div>,

    <div key="preferences" className="space-y-6">
      <ChoiceChips label="Causes you'd like to support" options={DONOR_CAUSES} value={form.causes} onChange={(v) => set("causes", v)} error={errors.causes} />
      <div>
        <p id="frequency-label" className="block text-sm font-medium text-slate-700 mb-2">Preferred donation frequency</p>
        <SegmentedControl
          label="Preferred donation frequency"
          options={DONOR_FREQUENCIES.map((f) => ({ value: f, label: f }))}
          value={form.frequency}
          onChange={(v) => set("frequency", v)}
        />
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={form.anonymous} onChange={(e) => set("anonymous", e.target.checked)} className="w-4 h-4 rounded border-slate-300 accent-blue-600" />
        Keep my donations anonymous
      </label>
    </div>,

    <div key="documents" className="space-y-5">
      {Object.entries(uploadRules).map(([field, rule]) => (
        <FileUploadField key={field} field={field} rule={rule} file={files[field]} onChange={(file) => setFile(field, file)} error={errors[field]} />
      ))}
      <Alert tone="neutral">
        Your PAN card is used to verify your account and for 80G tax-exemption receipts. It is stored privately: only you and
        VIDYADAAN administrators (for verification) can view it.
      </Alert>
    </div>,

    <div key="review" className="space-y-5">
      <ReviewSummary
        items={[
          ["Name", form.name], ["Email", form.email], ["Phone", form.phone], ["City", form.city], ["State", form.state],
          ["Causes", form.causes.join(", ")], ["Frequency", form.frequency], ["Anonymous", form.anonymous ? "Yes" : "No"],
          ["Documents", attachedDocs.join(", ") || "None attached"],
        ]}
      />
      <AgreeCheckbox checked={form.agree} onChange={(v) => set("agree", v)} error={errors.agree}>
        I agree to VIDYADAAN's <span className="font-medium text-slate-900">Terms of Service</span> and <span className="font-medium text-slate-900">Privacy Policy</span>.
      </AgreeCheckbox>
    </div>,
  ];

  return (
    <RegistrationLayout
      label="Donor registration"
      steps={STEPS}
      step={step}
      isLastStep={isLastStep}
      messages={messages}
      loading={loading}
      nextDisabled={isLastStep && !form.agree}
      nextLabel={isLastStep ? (loading ? "Submitting…" : "Submit registration") : "Continue"}
      onPrev={prev}
      onNext={isLastStep ? handleSubmit : handleContinue}
      loginHref="/login/donor"
    >
      {steps[step]}
    </RegistrationLayout>
  );
};

export default DonorRegister;
