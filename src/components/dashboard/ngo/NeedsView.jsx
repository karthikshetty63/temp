import { useState } from "react";
import { LuClipboardList } from "react-icons/lu";
import { PROJECT_PRIORITIES } from "../../../api/projects";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import { Select } from "../../ui/FormField";
import PageHeader from "../../ui/PageHeader";
import ApprovedNeedCard from "./ApprovedNeedCard";

const ALL = "";

/** Every approved school need, with filters. `notice` is a success message from the last action. */
const NeedsView = ({ needs, loading, error, homeState, notice, onView, onFund }) => {
  const [category, setCategory] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [homeStateOnly, setHomeStateOnly] = useState(false);

  // Only categories that actually have a need are offered.
  const categories = [...new Set(needs.map((n) => n.category))].sort();
  const shown = needs.filter(
    (n) =>
      (category === ALL || n.category === category) &&
      (priority === ALL || n.priority === priority) &&
      (!homeStateOnly || n.school.state === homeState)
  );
  const filtered = category !== ALL || priority !== ALL || homeStateOnly;
  const clearFilters = () => {
    setCategory(ALL);
    setPriority(ALL);
    setHomeStateOnly(false);
  };

  return (
    <>
      <PageHeader
        title="School needs"
        description="Requests the VIDYADAAN team has checked and approved. Each budget is split into 5 equal parts: fund the full amount or one or more parts."
      />

      {needs.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-56">
            <option value={ALL}>All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full sm:w-44">
            <option value={ALL}>All priorities</option>
            {PROJECT_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          {homeState && (
            <label className="inline-flex h-10 items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={homeStateOnly}
                onChange={(e) => setHomeStateOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600"
              />
              Only in {homeState}
            </label>
          )}
          <p className="text-sm text-slate-500 sm:ml-auto" role="status">
            {filtered && shown.length > 0 ? `Showing ${shown.length} of ${needs.length} needs` : `${needs.length} ${needs.length === 1 ? "need" : "needs"}`}
          </p>
        </div>
      )}
      {notice}

      {loading && <Card><p className="px-5 py-4 text-sm text-slate-500" role="status">Loading school needs…</p></Card>}
      {!loading && error && needs.length === 0 && <Card><p className="px-5 py-4 text-sm text-slate-500">{error}</p></Card>}
      {!loading && !error && needs.length === 0 && (
        <Card>
          <EmptyState
            icon={LuClipboardList}
            title="No approved school needs yet"
            description="When the VIDYADAAN team approves a school's request, it will appear here."
          />
        </Card>
      )}
      {!loading && needs.length > 0 && shown.length === 0 && (
        <Card>
          <EmptyState
            title="No needs match these filters"
            description="Try another category or priority."
            action={<Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
          />
        </Card>
      )}
      {!loading && shown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((need) => <ApprovedNeedCard key={need.id} need={need} onView={onView} onFund={onFund} />)}
        </div>
      )}
    </>
  );
};

export default NeedsView;
