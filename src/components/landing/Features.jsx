import {
  LuCamera, LuCheck, LuChevronDown, LuCircleCheck, LuFileCheck, LuFileSpreadsheet, LuIdCard, LuKeyRound, LuLock, LuLogOut,
  LuSchool, LuUndo2, LuUserCheck,
} from "react-icons/lu";
import { FcGoogle } from "react-icons/fc";
import { PASSWORD_RESET_TTL_MINUTES } from "../../../shared/registrationRules.js";
import SectionIntro from "./SectionIntro";
import { BODY, BOX, H3, SURFACE, WRAP } from "./styles";

// Each box pairs a real feature with a small drawing of that part of the product. The drawings use
// the app's own labels and placeholder text, never invented schools, names or amounts.

const Feature = ({ title, body, className = "", children }) => (
  <article className={`${BOX} flex flex-col overflow-hidden ${className}`}>
    <div className="p-6 sm:p-7">
      <h3 className={H3}>{title}</h3>
      <p className={`${BODY} mt-2 max-w-md`}>{body}</p>
    </div>
    <div className="mt-auto px-6 pb-6 sm:px-7 sm:pb-7" aria-hidden="true">{children}</div>
  </article>
);

const FormField = ({ label, placeholder, select = false, className = "" }) => (
  <div className={className}>
    <p className="text-xs font-medium text-zinc-700">{label}</p>
    <div className="mt-1.5 flex h-9 items-center justify-between rounded-lg border border-zinc-200 px-3 text-[0.8125rem] text-zinc-400">
      <span className="truncate">{placeholder}</span>
      {select && <LuChevronDown className="w-3.5 h-3.5 shrink-0" />}
    </div>
  </div>
);

const ProjectFormDrawing = () => (
  <div className={`${SURFACE} p-5`}>
    <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
      <p className="text-sm font-semibold text-zinc-900">New project</p>
      <span className="font-landing-mono text-[0.6875rem] uppercase tracking-wider text-zinc-400">Draft</span>
    </div>
    <div className="grid grid-cols-2 gap-4 pt-4">
      <FormField label="Project title" placeholder="e.g. Smart classroom for Grades 3–5" className="col-span-2" />
      <FormField label="Category" placeholder="Select a category" select />
      <FormField label="Priority" placeholder="Select a priority" select />
      <FormField label="Estimated budget (₹)" placeholder="120000" />
      <FormField label="Students benefited" placeholder="240" />
    </div>
    <div className="mt-5 flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
      <span className="text-xs text-zinc-500">Sent to our team for review</span>
      <span className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">Create project</span>
    </div>
  </div>
);

// What each kind of account uploads (the documents the registration forms require).
const ChecklistDrawing = () => (
  <div className="space-y-3">
    <div className={SURFACE}>
      <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <LuSchool className="w-4 h-4" />
        </span>
        <p className="min-w-0 flex-1 text-[0.8125rem] font-medium text-zinc-900">School application</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Approved</span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {[
          [LuFileCheck, "Registration certificate"],
          [LuIdCard, "Principal's ID proof"],
          [LuUserCheck, "Checked by our team"],
        ].map(([Icon, label]) => (
          <li key={label} className="flex items-center gap-3 px-4 py-3 text-[0.8125rem] text-zinc-700">
            <Icon className="w-4 h-4 shrink-0 text-zinc-400" />
            <span className="flex-1">{label}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50">
              <LuCheck className="w-3 h-3 text-emerald-600" />
            </span>
          </li>
        ))}
      </ul>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {[
        ["NGOs", "Registration certificate and PAN"],
        ["Donors", "PAN card"],
      ].map(([who, docs]) => (
        <div key={who} className={`${SURFACE} p-3.5`}>
          <p className="text-[0.8125rem] font-medium text-zinc-900">{who}</p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-500">{docs}</p>
        </div>
      ))}
    </div>
  </div>
);

const ReviewDrawing = () => (
  <div className="space-y-2.5">
    <div className={`${SURFACE} flex items-start gap-3 p-4`}>
      <LuCircleCheck className="mt-0.5 w-4 h-4 shrink-0 text-emerald-600" />
      <div>
        <p className="text-[0.8125rem] font-medium text-zinc-900">Approved</p>
        <p className="text-xs text-zinc-500">Ready for NGOs and donors</p>
      </div>
    </div>
    <div className={`${SURFACE} flex items-start gap-3 p-4`}>
      <LuUndo2 className="mt-0.5 w-4 h-4 shrink-0 text-amber-600" />
      <div>
        <p className="text-[0.8125rem] font-medium text-zinc-900">Changes requested</p>
        <p className="text-xs text-zinc-500">With the reason, so the school can fix it</p>
      </div>
    </div>
  </div>
);

const PhotoStagesDrawing = () => (
  <div className="grid grid-cols-3 gap-3">
    {[
      ["Before", "bg-zinc-100 text-zinc-400"],
      ["During", "bg-blue-50 text-blue-400"],
      ["After", "bg-emerald-50 text-emerald-500"],
    ].map(([stage, tint]) => (
      <div key={stage} className={`${SURFACE} p-2`}>
        <div className={`flex aspect-[4/3] items-center justify-center rounded-lg ${tint}`}>
          <LuCamera className="w-6 h-6" />
        </div>
        <p className="px-1 pb-0.5 pt-2 text-xs font-medium text-zinc-700">{stage}</p>
      </div>
    ))}
  </div>
);

const PrivacyDrawing = () => (
  <div className={`${SURFACE} flex items-center gap-4 p-4`}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white">
      <LuLock className="w-4 h-4" />
    </span>
    <div className="min-w-0">
      <p className="text-[0.8125rem] font-medium text-zinc-900">Your documents</p>
      <p className="text-xs text-zinc-500">Visible to you and the VIDYADAAN team only</p>
    </div>
  </div>
);

const ReportDrawing = () => (
  <div className={`${SURFACE} p-4`}>
    <div className="space-y-2.5">
      {[92, 64, 38].map((width, i) => (
        <div key={width} className="flex items-center gap-3">
          <span className="h-2 w-10 rounded-full bg-zinc-100" />
          <span className={`h-2.5 rounded-r ${i === 0 ? "bg-blue-600" : "bg-zinc-200"}`} style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
    <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3 text-xs font-medium text-zinc-700">
      <LuFileSpreadsheet className="w-4 h-4 text-emerald-600" />
      projects-report.csv
    </div>
  </div>
);

const SignInDrawing = () => (
  <ul className={`${SURFACE} divide-y divide-zinc-100`}>
    {[
      [LuKeyRound, `Reset links expire in ${PASSWORD_RESET_TTL_MINUTES} min`],
      [LuLogOut, "A reset signs out other devices"],
      [FcGoogle, "Sign in with Google"],
    ].map(([Icon, label]) => (
      <li key={label} className="flex items-center gap-3 px-4 py-3 text-[0.8125rem] text-zinc-700">
        <Icon className="w-4 h-4 shrink-0 text-zinc-400" />
        {label}
      </li>
    ))}
  </ul>
);

const Features = () => (
  <section id="features" aria-labelledby="features-heading" className="scroll-mt-16 bg-white pb-20 pt-10 sm:pb-28 sm:pt-14">
    <div className={WRAP}>
      <SectionIntro
        id="features-heading"
        eyebrow="Platform"
        title="Built around one idea: check everything first"
        description="Every account, every request and every document goes through a person before anyone else can see it."
      />

      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        <Feature
          className="lg:col-span-2"
          title="Post a specific need"
          body="Schools describe the problem, the budget, the priority and how many students it helps. The form checks every field as you go."
        >
          <ProjectFormDrawing />
        </Feature>
        <Feature
          title="A person checks every account"
          body="Schools, NGOs and donors upload documents when they register. Nobody can sign in until our team approves them."
        >
          <ChecklistDrawing />
        </Feature>

        <Feature title="Every request is reviewed" body="Only approved requests reach NGOs and donors. Anything unclear goes back with a reason.">
          <ReviewDrawing />
        </Feature>
        <Feature
          className="lg:col-span-2"
          title="Progress you can see"
          body="Schools add photos to each project before, during and after the work, so everyone can see what changed."
        >
          <PhotoStagesDrawing />
        </Feature>

        <Feature title="Private by default" body="Documents and photos can only be opened by their owner and the VIDYADAAN team.">
          <PrivacyDrawing />
        </Feature>
        <Feature title="Reports you can download" body="Each school sees its projects in charts and can download them as a spreadsheet.">
          <ReportDrawing />
        </Feature>
        <Feature title="Secure sign-in" body="Passwords are never stored in readable form, and every upload is checked for what it really contains.">
          <SignInDrawing />
        </Feature>
      </div>
    </div>
  </section>
);

export default Features;
