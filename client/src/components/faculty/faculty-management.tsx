"use client";
import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "@/lib/i18n/toast";
import {
  facultyFormSchema,
  manageFaculty,
  saveFaculty,
  archiveFaculty,
  type FacultyInput,
  type ManagedFaculty,
} from "@/lib/faculty-api";
import { ClubApiError } from "@/lib/club-api";
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
import { EventConfirmation } from "@/components/events/event-shared";
const blank: FacultyInput = {
  name: "",
  designation: "",
  department: "",
  specialization: "",
  photo: "",
  bio: "",
  published: false,
  teacherAccountId: "",
  assignedEventIds: [],
};
function FacultyForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile?: ManagedFaculty;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const form = useForm<FacultyInput>({
    resolver: zodResolver(facultyFormSchema),
    defaultValues: profile ?? blank,
  });
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4 rounded-xl border p-5"
      onSubmit={form.handleSubmit(async (input) => {
        setError("");
        try {
          await saveFaculty(input, profile);
          toast.success("Faculty profile saved.");
          onSaved();
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "Unable to save profile.",
          );
        }
      })}
    >
      <h2 className="text-xl font-semibold">
        {t(profile ? "Edit faculty profile" : "New faculty profile")}
      </h2>
      <p className="text-sm">
        {t(
          "Profiles never create accounts or grant roles. Optional account/activity IDs are private and can be copied from existing club records by an admin.",
        )}
      </p>

      {(
        [
          "name",
          "designation",
          "department",
          "specialization",
          "photo",
          "bio",
          "teacherAccountId",
        ] as const
      ).map((key) => (
        <label className="grid gap-1" key={key}>
          {t(
            {
              name: "Name",
              designation: "Designation",
              department: "Department",
              specialization: "Specialization",
              photo: "Photo HTTPS URL (optional)",
              bio: "Biography",
              teacherAccountId: "Existing teacher account ID (optional)",
            }[key],
          )}
          {key === "bio" ? (
            <textarea
              rows={4}
              {...form.register(key)}
              className="rounded border p-2"
            />
          ) : (
            <input {...form.register(key)} className="rounded border p-2" />
          )}
          {form.formState.errors[key] && (
            <span role="alert">{t(form.formState.errors[key]?.message)}</span>
          )}
        </label>
      ))}
      <label className="grid gap-1">
        {t("Assigned event IDs (comma separated, optional)")}
        <textarea
          rows={2}
          className="rounded border p-2"
          defaultValue={profile?.assignedEventIds.join(", ") ?? ""}
          onChange={(event) =>
            form.setValue(
              "assignedEventIds",
              event.target.value.split(/[\s,]+/).filter(Boolean),
              { shouldValidate: true },
            )
          }
        />
        {form.formState.errors.assignedEventIds && (
          <span role="alert">
            {t(
              "Check event IDs: use distinct existing 24-character IDs, at most 50.",
            )}
          </span>
        )}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" {...form.register("published")} />
        {t("Publish this faculty profile")}
      </label>
      {error && <p role="alert">{t(error, undefined, true)}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {t("Save faculty profile")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={form.formState.isSubmitting}
          onClick={onCancel}
        >
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
export function FacultyManagement() {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<ManagedFaculty[] | null>(null),
    [page, setPage] = useState(1),
    [hasNext, setHasNext] = useState(false),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<ManagedFaculty | "new" | null>(null),
    [archive, setArchive] = useState<ManagedFaculty | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const reload = () => {
    setItems(null);
    setError("");
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    manageFaculty(page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result.items);
          setHasNext(result.hasNext);
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ClubApiError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof ClubApiError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof Error ? cause.message : "Unable to load faculty.",
        );
      });
    return () => controller.abort();
  }, [page, revision, router]);
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("Faculty management")}</h1>
      <div className="flex gap-3">
        <Button onClick={() => setEditing("new")}>
          {t("Add faculty mentor")}
        </Button>
        <Button variant="outline" onClick={reload}>
          {t("Refresh faculty")}
        </Button>
      </div>
      {editing && (
        <FacultyForm
          key={editing === "new" ? "new" : `${editing.id}:${editing.version}`}
          profile={editing === "new" ? undefined : editing}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !items ? (
        <p role="status">{t("Loading faculty\u2026")}</p>
      ) : items.length === 0 ? (
        <p role="status">{t("No faculty profiles yet.")}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((profile) => (
            <li key={profile.id} className="space-y-3 rounded-xl border p-4">
              <h2 className="text-xl font-semibold">{profile.name}</h2>
              <p>
                {profile.department} ·{" "}
                {t(profile.published ? "Published" : "Hidden")}·{" "}
                {profile.assignedEventIds.length} {t("activities")}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditing(profile)}>
                  {t("Edit")} {profile.name}
                </Button>
                <Button variant="outline" onClick={() => setArchive(profile)}>
                  {t("Archive")} {profile.name}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex gap-4" aria-label={t("Faculty management pages")}>
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => {
            setPage((value) => value - 1);
            reload();
          }}
        >
          {t("Previous")}
        </Button>
        <span>
          {t("Page")} {page}
        </span>
        <Button
          variant="outline"
          disabled={!hasNext || page >= 1000}
          onClick={() => {
            setPage((value) => value + 1);
            reload();
          }}
        >
          {t("Next")}
        </Button>
      </nav>
      {archive && (
        <EventConfirmation
          title={t("Archive faculty profile?")}
          busy={busy}
          onCancel={() => setArchive(null)}
          onConfirm={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await archiveFaculty(archive);
              setArchive(null);
              reload();
            } catch (cause) {
              setArchive(null);
              setError(
                cause instanceof Error ? cause.message : "Unable to archive.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {archive.name}{" "}
            {t(
              "will leave the public directory and their activity assignments will be removed. Their account role is unchanged.",
            )}
          </p>
        </EventConfirmation>
      )}
    </main>
  );
}
