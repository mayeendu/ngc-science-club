"use client";
import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "@/lib/i18n/toast";
import {
  listAnnouncements,
  getAnnouncement,
  manageAnnouncements,
  saveAnnouncement,
  archiveAnnouncement,
  announcementFormSchema,
  type Announcement,
  type ManagedAnnouncement,
  type AnnouncementInput,
} from "@/lib/communication-api";
import { ClubApiError } from "@/lib/club-api";
import { AccessDenied } from "@/components/auth/access-state";
import { EventConfirmation } from "@/components/events/event-shared";
import { Button } from "@/components/ui/button";
function AnnouncementForm({
  current,
  onSaved,
  onCancel,
}: {
  current?: ManagedAnnouncement;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const form = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: current ?? { title: "", body: "", published: false },
  });
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4 rounded-xl border p-5"
      onSubmit={form.handleSubmit(async (input) => {
        setError("");
        try {
          await saveAnnouncement(input, current);
          toast.success("Announcement saved.");
          window.dispatchEvent(new Event("club-notifications-updated"));
          onSaved();
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to save announcement.",
          );
        }
      })}
    >
      <h2 className="text-xl font-semibold">
        {t(current ? "Edit announcement" : "New announcement")}
      </h2>
      <label className="grid gap-1">
        {t("Announcement title")}
        <input
          maxLength={150}
          {...form.register("title")}
          className="rounded border p-2"
        />
        {form.formState.errors.title && (
          <span role="alert">{t(form.formState.errors.title?.message)}</span>
        )}
      </label>
      <label className="grid gap-1">
        {t("Announcement message")}
        <textarea
          rows={5}
          maxLength={5000}
          {...form.register("body")}
          className="rounded border p-2"
        />
        {form.formState.errors.body && (
          <span role="alert">{t(form.formState.errors.body?.message)}</span>
        )}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" {...form.register("published")} />
        {t("Publish announcement")}
      </label>
      {error && <p role="alert">{t(error, undefined, true)}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {t("Save announcement")}
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
export function Announcements({
  manage = false,
  id,
}: {
  manage?: boolean;
  id?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<
      (Announcement | ManagedAnnouncement)[] | null
    >(null),
    [hasNext, setHasNext] = useState(false),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<ManagedAnnouncement | "new" | null>(null),
    [archive, setArchive] = useState<ManagedAnnouncement | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const refresh = () => {
    setItems(null);
    setError("");
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    (id
      ? getAnnouncement(id, controller.signal).then((result) => ({
          items: [result.announcement],
          hasNext: false,
        }))
      : manage
        ? manageAnnouncements(page, controller.signal)
        : listAnnouncements(page, controller.signal)
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result.items);
          setHasNext(result.hasNext);
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ClubApiError && cause.status === 401 && manage)
          router.replace("/login");
        if (cause instanceof ClubApiError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load announcements.",
        );
      });
    return () => controller.abort();
  }, [manage, id, page, revision, router]);
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">
        {t(manage ? "Announcement management" : "Club announcements")}
      </h1>
      {manage && (
        <>
          <p>
            {t("Teachers manage their own announcements; admins manage all.")}
          </p>
          <Button onClick={() => setEditing("new")}>
            {t("Create announcement")}
          </Button>
        </>
      )}
      <Button variant="outline" onClick={refresh}>
        {t("Refresh announcements")}
      </Button>
      {editing && (
        <AnnouncementForm
          key={editing === "new" ? "new" : `${editing.id}:${editing.version}`}
          current={editing === "new" ? undefined : editing}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !items ? (
        <p role="status">{t("Loading announcements\u2026")}</p>
      ) : !items.length ? (
        <p role="status">{t("No announcements yet.")}</p>
      ) : (
        items.map((item) => (
          <article
            id={item.id}
            key={item.id}
            className="space-y-3 rounded-xl border p-5"
          >
            <h2 className="text-xl font-semibold">{item.title}</h2>
            {!manage && !id && (
              <Link
                href={`/announcements/${item.id}`}
                className="text-blue-700 underline"
              >
                {t("Read announcement")}
              </Link>
            )}
            <p className="text-sm">
              {new Date(item.updatedAt).toLocaleString("en-GB", {
                timeZone: "Asia/Dhaka",
              })}{" "}
              {t("(Dhaka)")}{" "}
              {"published" in item
                ? t(item.published ? " · Published" : " · Draft")
                : ""}
            </p>
            <p className="whitespace-pre-wrap break-words">{item.body}</p>
            {manage && "version" in item && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditing(item)}>
                  {t("Edit")} {item.title}
                </Button>
                <Button variant="outline" onClick={() => setArchive(item)}>
                  {t("Archive")} {item.title}
                </Button>
              </div>
            )}
          </article>
        ))
      )}
      {!id && (
        <nav className="flex gap-4" aria-label={t("Announcement pages")}>
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => {
              setPage((value) => value - 1);
              refresh();
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
              refresh();
            }}
          >
            {t("Next")}
          </Button>
        </nav>
      )}
      {archive && (
        <EventConfirmation
          title={t("Archive announcement?")}
          busy={busy}
          onCancel={() => setArchive(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await archiveAnnouncement(archive);
              setArchive(null);
              window.dispatchEvent(new Event("club-notifications-updated"));
              refresh();
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
            {archive.title}{" "}
            {t(
              "will be removed from public announcements and notification inboxes.",
            )}
          </p>
        </EventConfirmation>
      )}
    </main>
  );
}
