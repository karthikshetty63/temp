import { LuPencil, LuTrash2, LuUserPlus, LuUsers } from "react-icons/lu";
import Button from "../../ui/Button";
import Card, { CardHeader } from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import PageHeader from "../../ui/PageHeader";
import { formatPhone } from "./format";

/** The NGO's own volunteers and the school need each one works on. */
const VolunteersView = ({ volunteers, loading, error, reload, notice, onAdd, onEdit, onRemove }) => (
  <>
    <PageHeader
      title="Volunteers"
      description="People from your NGO who work on school projects, and the need each one is working on."
      actions={!loading && !error && <Button icon={LuUserPlus} onClick={onAdd}>Add volunteer</Button>}
    />
    {notice}
    <Card>
      {loading && <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading volunteers…</p>}
      {!loading && error && (
        <p className="px-5 py-4 text-sm text-slate-500">
          {error}{" "}
          <button type="button" onClick={reload} className="font-medium text-blue-700 underline underline-offset-2">Try again</button>
        </p>
      )}
      {!loading && !error && volunteers.length === 0 && (
        <EmptyState icon={LuUsers} title="No volunteers yet" description="Add the people from your NGO who work on school projects." />
      )}
      {volunteers.length > 0 && (
        <>
          <CardHeader title="Your volunteers" description={`${volunteers.length} ${volunteers.length === 1 ? "person" : "people"}`} />
          {/* Phones: one row per volunteer instead of a squeezed table. */}
          <ul className="divide-y divide-slate-200 md:hidden">
            {volunteers.map((v) => (
              <li key={v.id} className="flex items-start gap-3 px-5 py-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700" aria-hidden="true">
                  {v.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{v.name}</p>
                  <p className="text-xs text-slate-500">
                    {v.role}
                    {v.phone && <> · <a href={`tel:${v.phone}`} className="tabular-nums hover:underline">{formatPhone(v.phone)}</a></>}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{v.project ? `Working on ${v.project.title}` : "Not assigned"}</p>
                  <div className="mt-2 flex gap-1 -ml-2">
                    <Button variant="ghost" size="sm" icon={LuPencil} onClick={() => onEdit(v)} aria-label={`Edit ${v.name}`}>Edit</Button>
                    <Button variant="ghost" size="sm" icon={LuTrash2} onClick={() => onRemove(v)} aria-label={`Remove ${v.name}`}>Remove</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {/* relative: keeps the sr-only header inside the scroller, so it can't widen the page */}
          <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  {["Volunteer", "Role", "Phone", "Working on"].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap px-5 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                  ))}
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {volunteers.map((v) => (
                  <tr key={v.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700" aria-hidden="true">
                          {v.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="whitespace-nowrap font-medium text-slate-900">{v.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{v.role}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600">
                      {v.phone ? <a href={`tel:${v.phone}`} className="hover:underline">{formatPhone(v.phone)}</a> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{v.project?.title || <span className="text-slate-400">Not assigned</span>}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <Button variant="ghost" size="sm" icon={LuPencil} onClick={() => onEdit(v)} aria-label={`Edit ${v.name}`}>Edit</Button>
                      <Button variant="ghost" size="sm" icon={LuTrash2} onClick={() => onRemove(v)} aria-label={`Remove ${v.name}`}>Remove</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  </>
);

export default VolunteersView;
