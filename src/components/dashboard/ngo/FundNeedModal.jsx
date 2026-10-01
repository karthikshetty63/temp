import { useState } from "react";
import { LuCheck } from "react-icons/lu";
import { commitFunding } from "../../../api/projects";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import { formatINR, freeParts, partsLabel, schoolPlace, sumAmounts } from "./format";

const optionClasses = (selected) =>
  `rounded-xl border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
    selected ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-300 bg-white hover:border-slate-400"
  }`;

/**
 * Choose how much of a need to fund: the full amount (every free part) or one or more of its equal
 * parts. `need` is always the latest version from the list, so a part another NGO takes meanwhile
 * shows as taken. Calls onCommitted(project, message), or onConflict() when the need changed.
 */
const FundNeedModal = ({ need, onClose, onCommitted, onConflict }) => {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const free = freeParts(need);
  // A part that was taken meanwhile drops out of the selection.
  const chosen = free.filter((p) => selected.includes(p.part));
  const total = sumAmounts(chosen);
  const allFree = free.length === need.parts.length;
  const everyFreeChosen = free.length > 0 && chosen.length === free.length;
  const place = schoolPlace(need.school);
  const [smallest, largest] = [Math.min(...need.parts.map((p) => p.amount)), Math.max(...need.parts.map((p) => p.amount))];

  const toggle = (part) => setSelected((s) => (s.includes(part) ? s.filter((x) => x !== part) : [...s, part]));
  const chooseAll = () => setSelected(everyFreeChosen ? [] : free.map((p) => p.part));

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const data = await commitFunding(need.id, chosen.map((p) => p.part));
      onCommitted(data.project, data.message);
    } catch (commitError) {
      setError(commitError.message || "Could not save your commitment. Please try again.");
      if (commitError.status === 409 || commitError.status === 404) onConflict?.();
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      size="lg"
      title="Fund this need"
      description={`${need.title} · ${need.school.name}${place ? `, ${place}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!chosen.length}>
            {saving ? "Committing…" : chosen.length ? `Commit ${formatINR(total)}` : "Commit"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          The budget of <span className="font-medium text-slate-900">{formatINR(need.budget)}</span> is split into {need.parts.length} equal parts of{" "}
          {smallest === largest ? formatINR(smallest) : `${formatINR(smallest)}–${formatINR(largest)}`}. Fund the full amount, or take one or more parts.
        </p>

        {free.length === 0 ? (
          <Alert tone="neutral">Every part of this need has been taken.</Alert>
        ) : (
          <button type="button" aria-pressed={everyFreeChosen} onClick={chooseAll} className={`w-full flex items-center justify-between gap-4 p-4 ${optionClasses(everyFreeChosen)}`}>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{allFree ? "Fund the full amount" : "Fund all remaining parts"}</span>
              <span className="block text-xs text-slate-500">
                {allFree ? `All ${need.parts.length} parts` : partsLabel(free.map((p) => p.part))}
              </span>
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-slate-900">
              {formatINR(sumAmounts(free))}
              {everyFreeChosen && <LuCheck className="w-4 h-4 text-blue-700" aria-hidden="true" />}
            </span>
          </button>
        )}

        <fieldset>
          <legend className="text-sm font-medium text-slate-900">{free.length ? "Or choose parts" : "Parts"}</legend>
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
            {need.parts.map((p) => {
              const taken = Boolean(p.takenBy);
              const on = !taken && selected.includes(p.part);
              const state = p.takenBy === "you" ? "Yours" : p.takenBy === "other" ? "Taken" : on ? "Selected" : "Free";
              return (
                <button
                  key={p.part}
                  type="button"
                  disabled={taken}
                  aria-pressed={taken ? undefined : on}
                  aria-label={`Part ${p.part}, ${formatINR(p.amount)}, ${state.toLowerCase()}`}
                  onClick={() => toggle(p.part)}
                  className={`p-3 ${taken ? "rounded-xl border border-slate-200 bg-slate-50 text-left cursor-not-allowed" : optionClasses(on)}`}
                >
                  <span className="flex items-center justify-between text-xs font-medium text-slate-500">
                    Part {p.part}
                    {on && <LuCheck className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />}
                  </span>
                  <span className={`mt-1 block text-sm font-semibold tabular-nums ${taken ? "text-slate-400" : "text-slate-900"}`}>{formatINR(p.amount)}</span>
                  <span className={`mt-0.5 block text-xs ${p.takenBy === "you" ? "font-medium text-blue-700" : taken ? "text-slate-400" : "text-slate-500"}`}>{state}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="text-sm text-slate-700" role="status">
          {chosen.length
            ? <>You&rsquo;re committing <span className="font-semibold text-slate-900">{formatINR(total)}</span> ({everyFreeChosen && allFree ? "the full amount" : `${partsLabel(chosen.map((p) => p.part)).toLowerCase()} of ${need.parts.length}`}).</>
            : free.length > 0 && "Choose the full amount or at least one part."}
        </p>

        <Alert tone="info" title="How funding works">
          Committing reserves these parts for your NGO. You then pay the school directly (we show you its bank account) and record the payment
          under Funding with the challan, receipt or transaction screenshot. The school accepts it once the money reaches its account. The
          school also sees your NGO&rsquo;s name, email and phone number. Until you&rsquo;ve paid, you can withdraw.
        </Alert>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
};

export default FundNeedModal;
