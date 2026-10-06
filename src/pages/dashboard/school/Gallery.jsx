import { useState } from "react";
import { Link } from "react-router-dom";
import { LuFolderKanban, LuImage, LuImagePlus, LuImages, LuTrash2 } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import AddPhotoModal from "../../../components/dashboard/school/AddPhotoModal";
import Alert from "../../../components/ui/Alert";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import Modal from "../../../components/ui/Modal";
import PageHeader from "../../../components/ui/PageHeader";
import ProtectedImage from "../../../components/ui/ProtectedImage";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import { buttonClasses } from "../../../components/ui/classes";
import { PHOTO_STAGES, deleteProjectPhoto } from "../../../api/photos";
import { useAuth } from "../../../context/AuthContext";
import useMyPhotos from "../../../hooks/useMyPhotos";
import useMyProjects from "../../../hooks/useMyProjects";

const formatWhen = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const describe = (photo) => photo.caption || `${photo.project?.title || "Project"} (${photo.stage.toLowerCase()})`;

const PhotoFallback = () => (
  <span className="flex w-full h-full items-center justify-center bg-slate-100">
    <LuImage className="w-6 h-6 text-slate-400" aria-hidden="true" />
  </span>
);

const Gallery = () => {
  const { user } = useAuth();
  const { projects, loading: projectsLoading } = useMyProjects();
  const { photos, loading, error, reload, add, remove } = useMyPhotos();
  const [stage, setStage] = useState("all");
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteState, setDeleteState] = useState({ busy: false, error: "" });

  const displayed = stage === "all" ? photos : photos.filter((p) => p.stage === stage);
  const stageOptions = [
    { value: "all", label: "All", count: photos.length },
    ...PHOTO_STAGES.map((s) => ({ value: s, label: s, count: photos.filter((p) => p.stage === s).length })),
  ];
  const hasProjects = projects.length > 0;

  const closeDelete = () => {
    setDeleting(null);
    setDeleteState({ busy: false, error: "" });
  };
  const confirmDelete = async () => {
    setDeleteState({ busy: true, error: "" });
    try {
      await deleteProjectPhoto(deleting.id);
      remove(deleting.id);
      closeDelete();
    } catch (deleteError) {
      setDeleteState({ busy: false, error: deleteError.message || "Could not delete the photo. Please try again." });
    }
  };

  const addButton = (
    <Button icon={LuImagePlus} onClick={() => setAdding(true)} disabled={!hasProjects}>Add photo</Button>
  );

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Photo gallery" subtitle="Your project photos">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            title="Photo gallery"
            description="Photos you've added of your projects: before, during and after the work. Only your school and the VIDYADAAN team can see them."
            actions={addButton}
          />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}

          {loading && <p className="text-sm text-slate-500" role="status">Loading your photos…</p>}

          {!loading && !error && photos.length === 0 && !projectsLoading && (
            <Card>
              {hasProjects ? (
                <EmptyState
                  icon={LuImages}
                  title="No photos yet"
                  description="Add before, in-progress and completion photos of your projects. They show how the work is going."
                  action={addButton}
                />
              ) : (
                <EmptyState
                  icon={LuFolderKanban}
                  title="Add a project first"
                  description="Every photo belongs to a project. Create your school's first project, then add its photos here."
                  action={<Link to="/dashboard/school/projects" className={buttonClasses()}>Go to projects</Link>}
                />
              )}
            </Card>
          )}

          {photos.length > 0 && (
            <>
              <SegmentedControl label="Filter photos by stage" value={stage} onChange={setStage} options={stageOptions} />

              {displayed.length === 0 ? (
                <Card>
                  <EmptyState icon={LuImages} title="No photos at this stage" />
                </Card>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {displayed.map((photo) => (
                    <li key={photo.id} className="bg-surface rounded-2xl border border-surface-line shadow-card overflow-hidden flex flex-col">
                      <button type="button" onClick={() => setViewing(photo)} className="relative block w-full h-48 bg-slate-100" aria-label={`View photo: ${describe(photo)}`}>
                        <ProtectedImage fileId={photo.file?.id} alt="" className="w-full h-full object-cover" fallback={<PhotoFallback />} />
                        <span className="absolute top-3 left-3 bg-black/60 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">{photo.stage}</span>
                      </button>
                      <div className="p-4 flex-1 flex flex-col gap-2">
                        <div className="min-w-0">
                          {photo.project && (
                            <Link to={`/dashboard/school/progress?project=${photo.project.id}`} className="block truncate text-xs font-semibold text-primary-700 hover:underline">
                              {photo.project.title}
                            </Link>
                          )}
                          {photo.caption && <p className="mt-0.5 text-sm text-slate-900 line-clamp-2">{photo.caption}</p>}
                        </div>
                        <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>Added {formatWhen(photo.createdAt)}</span>
                          <button
                            type="button"
                            onClick={() => setDeleting(photo)}
                            aria-label={`Delete photo: ${describe(photo)}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <LuTrash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </main>

      {adding && <AddPhotoModal open projects={projects} onClose={() => setAdding(false)} onAdded={add} />}

      {viewing && (
        <Modal open size="lg" onClose={() => setViewing(null)} title={viewing.project?.title || "Photo"} description={`${viewing.stage} · Added ${formatWhen(viewing.createdAt)}`}>
          <ProtectedImage
            fileId={viewing.file?.id}
            alt={describe(viewing)}
            className="w-full max-h-[65vh] object-contain rounded-lg bg-slate-100"
            fallback={<div className="h-64 rounded-lg"><PhotoFallback /></div>}
          />
          {viewing.caption && <p className="mt-3 text-sm text-slate-700">{viewing.caption}</p>}
        </Modal>
      )}

      {deleting && (
        <Modal
          open
          size="sm"
          onClose={deleteState.busy ? () => {} : closeDelete}
          title="Delete this photo?"
          description="It will be removed from your gallery for good."
          footer={
            <>
              <Button variant="secondary" onClick={closeDelete} disabled={deleteState.busy}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete} loading={deleteState.busy}>{deleteState.busy ? "Deleting…" : "Delete photo"}</Button>
            </>
          }
        >
          {deleteState.error ? <Alert tone="danger">{deleteState.error}</Alert> : <p className="text-sm text-slate-700">{describe(deleting)}</p>}
        </Modal>
      )}
    </DashboardLayout>
  );
};

export default Gallery;
