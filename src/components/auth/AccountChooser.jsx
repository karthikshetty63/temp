import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuArrowRight, LuCheck } from "react-icons/lu";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import VidyadaanLogo from "../ui/VidyadaanLogo";

const LAST_PORTAL_KEY = "vidyadaan:last-portal";

// Shared timing for the option states: short, no movement, off for reduced motion.
const TRANSITION = "duration-150 ease-out motion-reduce:transition-none";
const LINK = "group ml-1 whitespace-nowrap font-medium text-blue-700 underline-offset-4 transition-colors duration-150 hover:text-blue-800 hover:underline";
// Inline-block keeps the arrow out of the underline; it only moves when motion is allowed.
const LINK_ARROW = "ml-1 inline-block transition-transform duration-150 ease-out motion-safe:group-hover:translate-x-0.5";

const readLastPortal = () => {
  try {
    return localStorage.getItem(LAST_PORTAL_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * "Which account?" screen used by /login and /join.
 * A focused panel with a single-choice list and one Continue button.
 * With `rememberChoice`, the last choice is remembered on this device and pre-selected next time.
 *
 * options: [{ key, icon, title, description, href, continueLabel }]
 */
const AccountChooser = ({ eyebrow, title, description, options, legend, headerLink, note, footer, rememberChoice = false }) => {
  const navigate = useNavigate();
  const [lastUsed] = useState(() => (rememberChoice && options.some((o) => o.key === readLastPortal()) ? readLastPortal() : ""));
  const [selected, setSelected] = useState(lastUsed);
  const choice = options.find((o) => o.key === selected);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!choice) return;
    if (rememberChoice) {
      try {
        localStorage.setItem(LAST_PORTAL_KEY, choice.key);
      } catch {
        /* storage unavailable — nothing to remember */
      }
    }
    navigate(choice.href);
  };

  // Shown top-right on larger screens, below the panel on phones.
  const headerPrompt = headerLink && (
    <>
      {headerLink.prompt}{" "}
      <Link to={headerLink.href} className={LINK}>
        {headerLink.label}
        <LuArrowRight aria-hidden="true" className={`${LINK_ARROW} h-3.5 w-3.5 align-[-2px]`} />
      </Link>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="h-16 shrink-0 flex items-center justify-between gap-4 px-4 sm:px-8">
        <Link to="/" aria-label="VIDYADAAN home"><VidyadaanLogo variant="dark" showTagline={false} /></Link>
        {headerPrompt && <p className="hidden sm:block text-sm text-slate-600">{headerPrompt}</p>}
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-panel shadow-xs px-5 py-7 sm:px-8 sm:py-8">
            {eyebrow && <p className="text-[13px] leading-5 font-medium tracking-[0.02em] text-slate-500">{eyebrow}</p>}
            <h1 className={`${eyebrow ? "mt-1" : ""} text-2xl leading-tight font-semibold tracking-[-0.01em] text-slate-900`}>{title}</h1>
            {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}

            <form onSubmit={handleSubmit} className="mt-7">
              <fieldset>
                <legend className="sr-only">{legend}</legend>
                <div className="space-y-2">
                  {options.map(({ key, icon: Icon, title: optionTitle, description: optionDescription }) => {
                    const isSelected = selected === key;
                    return (
                      <label
                        key={key}
                        className={`group relative flex items-center gap-3.5 rounded-control border px-4 py-3.5 cursor-pointer ${TRANSITION} transition-[border-color,background-color,box-shadow] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-xs"
                        }`}
                      >
                        <input
                          type="radio"
                          name="account-type"
                          value={key}
                          checked={isSelected}
                          onChange={() => setSelected(key)}
                          className="sr-only"
                        />
                        <span
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-inset ${TRANSITION} transition-[color,background-color,box-shadow] ${
                            isSelected
                              ? "bg-blue-600 text-white ring-blue-600"
                              : "bg-slate-100 text-slate-600 ring-transparent group-hover:bg-white group-hover:text-blue-700 group-hover:ring-slate-200"
                          }`}
                          aria-hidden="true"
                        >
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-[15px] leading-6 font-semibold text-slate-900">{optionTitle}</span>
                            {lastUsed === key && <Badge>Last used</Badge>}
                          </span>
                          <span className="block text-sm leading-5 text-slate-500">{optionDescription}</span>
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${TRANSITION} transition-[border-color,background-color] ${
                            isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white group-hover:border-slate-400"
                          }`}
                          aria-hidden="true"
                        >
                          <LuCheck
                            className={`w-3.5 h-3.5 ${TRANSITION} transition-opacity ${isSelected ? "opacity-100" : "opacity-0"}`}
                            strokeWidth={3}
                          />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <Button type="submit" size="lg" fullWidth className="mt-6" disabled={!choice}>
                {choice?.continueLabel || "Continue"}
              </Button>
            </form>

            {note && <p className="mt-4 text-xs text-slate-500 text-center">{note}</p>}
          </div>

          {headerPrompt && <p className="sm:hidden mt-6 text-center text-sm text-slate-600">{headerPrompt}</p>}
          {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-slate-500">© {new Date().getFullYear()} VIDYADAAN</footer>
    </div>
  );
};

export default AccountChooser;
