import RegistrationLayout, { AgreeCheckbox, RegistrationSuccess, ReviewSummary } from "../../components/auth/RegistrationLayout";
import FileUploadField from "../../components/auth/FileUploadField";
import Alert from "../../components/ui/Alert";
import FormField, { Input, Select, Textarea } from "../../components/ui/FormField";
import useRegistrationForm from "../../hooks/useRegistrationForm";
import { SCHOOL_STATES } from "../../../shared/registrationRules.js";

const STEPS = ["School details", "Principal & account", "Facilities", "Documents", "Bank details", "Review"];

const INITIAL_FORM = {
  schoolName: "", udise: "", address: "", district: "", state: "",
  principalName: "", email: "", phone: "", password: "", confirm: "", students: "", teachers: "",
  hasToilets: false, hasLibrary: false, hasComputers: false, hasDrinkingWater: false,
  bankAccount: "", ifsc: "", upi: "",
  agree: false,
};

const FACILITIES = [
  { key: "hasToilets", label: "Functional toilets" },
  { key: "hasLibrary", label: "Library" },
  { key: "hasComputers", label: "Computer lab" },
  { key: "hasDrinkingWater", label: "Drinking water" },
];

const SchoolRegister = () => {
  const { form, set, files, setFile, step, errors, messages, loading, handleContinue, handleSubmit, prev, uploadRules } = useRegistrationForm("school", INITIAL_FORM);
  const isLastStep = step === STEPS.length - 1;

  if (step === STEPS.length) {
    return (
      <RegistrationSuccess label="School registration" title="Registration submitted" actionHref="/login/school" actionLabel="Go to school sign in">
        Your school is <strong className="font-semibold text-slate-900">pending admin approval</strong>. Our team will verify your details and activate your account.
        You can sign in once it has been approved.
      </RegistrationSuccess>
    );
  }

  const attachedDocs = Object.entries(files).filter(([, f]) => f).map(([field]) => uploadRules[field].label);

  const steps = [
    <div key="school" className="space-y-5">
      <FormField label="School name" required error={errors.schoolName}>
        {(f) => <Input {...f} value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} placeholder="Govt. Primary School, Honnali" />}
      </FormField>
      <FormField label="UDISE code" required error={errors.udise} hint="The 11-digit code from the UDISE+ portal." className="sm:max-w-xs">
        {(f) => <Input {...f} inputMode="numeric" maxLength={14} value={form.udise} onChange={(e) => set("udise", e.target.value)} placeholder="29140112801" />}
      </FormField>
      <FormField label="Full address" required error={errors.address}>
        {(f) => <Textarea {...f} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="School building, Village, Taluk" />}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="District" required error={errors.district}>
          {(f) => <Input {...f} value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="Mandya" />}
        </FormField>
        <FormField label="State" required error={errors.state}>
          {(f) => (
            <Select {...f} value={form.state} onChange={(e) => set("state", e.target.value)}>
              <option value="">Select state</option>
              {SCHOOL_STATES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          )}
        </FormField>
      </div>
    </div>,

    <div key="principal" className="space-y-5">
      <FormField label="Principal name" required error={errors.principalName}>
        {(f) => <Input {...f} autoComplete="name" value={form.principalName} onChange={(e) => set("principalName", e.target.value)} placeholder="Mr. / Ms. Full Name" />}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Official email" required error={errors.email} hint="Used to sign in.">
          {(f) => <Input {...f} type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="principal@school.gov.in" />}
        </FormField>
        <FormField label="Phone number" required error={errors.phone}>
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
      <div className="grid grid-cols-2 gap-5">
        <FormField label="Total students" error={errors.students}>
          {(f) => <Input {...f} type="number" min="0" inputMode="numeric" value={form.students} onChange={(e) => set("students", e.target.value)} placeholder="250" />}
        </FormField>
        <FormField label="Total teachers" error={errors.teachers}>
          {(f) => <Input {...f} type="number" min="0" inputMode="numeric" value={form.teachers} onChange={(e) => set("teachers", e.target.value)} placeholder="12" />}
        </FormField>
      </div>
    </div>,

    <fieldset key="facilities" className="space-y-4">
      <legend className="text-sm text-slate-600 mb-3">Select the facilities your school currently has.</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FACILITIES.map(({ key, label }) => (
          <label
            key={key}
            className={`flex items-center gap-3 px-4 h-12 rounded-control border cursor-pointer transition-colors ${
              form[key] ? "border-blue-300 bg-blue-50/60" : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
          >
            <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} className="w-4 h-4 rounded border-slate-300 accent-blue-600" />
            <span className="text-sm font-medium text-slate-800">{label}</span>
          </label>
        ))}
      </div>
      <p className="text-sm text-slate-500">You can add a school photograph in the next step, or later from your School Profile page.</p>
    </fieldset>,

    <div key="documents" className="space-y-5">
      {Object.entries(uploadRules).map(([field, rule]) => (
        <FileUploadField key={field} field={field} rule={rule} file={files[field]} onChange={(file) => setFile(field, file)} error={errors[field]} />
      ))}
      <Alert tone="neutral">
        Documents are stored privately. Only your school account and VIDYADAAN administrators (for verification) can view them.
      </Alert>
    </div>,

    <div key="bank" className="space-y-5">
      <FormField label="Bank account number" required error={errors.bankAccount}>
        {(f) => <Input {...f} inputMode="numeric" autoComplete="off" value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} placeholder="1234567890123" />}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="IFSC code" required error={errors.ifsc}>
          {(f) => <Input {...f} autoComplete="off" className="uppercase" value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)} placeholder="SBIN0001234" />}
        </FormField>
        <FormField label="UPI ID" error={errors.upi} hint="Optional">
          {(f) => <Input {...f} autoComplete="off" value={form.upi} onChange={(e) => set("upi", e.target.value)} placeholder="school@upi" />}
        </FormField>
      </div>
      <Alert tone="info">Funds are released to the school account only after NGO verification of project completion.</Alert>
    </div>,

    <div key="review" className="space-y-5">
      <ReviewSummary
        items={[
          ["School", form.schoolName], ["UDISE", form.udise], ["District", form.district], ["State", form.state],
          ["Principal", form.principalName], ["Email", form.email], ["Students", form.students], ["Teachers", form.teachers],
          ["Documents", attachedDocs.join(", ") || "None attached"],
        ]}
      />
      <AgreeCheckbox checked={form.agree} onChange={(v) => set("agree", v)} error={errors.agree}>
        I declare that all information provided is accurate and I agree to VIDYADAAN's <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 underline underline-offset-2 hover:text-primary-700">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 underline underline-offset-2 hover:text-primary-700">Privacy Policy</a>.
      </AgreeCheckbox>
    </div>,
  ];

  return (
    <RegistrationLayout
      label="School registration"
      steps={STEPS}
      step={step}
      isLastStep={isLastStep}
      messages={messages}
      loading={loading}
      nextDisabled={isLastStep && !form.agree}
      nextLabel={isLastStep ? (loading ? "Submitting…" : "Submit registration") : "Continue"}
      onPrev={prev}
      onNext={isLastStep ? handleSubmit : handleContinue}
      loginHref="/login/school"
    >
      {steps[step]}
    </RegistrationLayout>
  );
};

export default SchoolRegister;
