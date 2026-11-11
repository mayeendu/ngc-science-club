"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/components/i18n/language";
import {
  showcaseFormSchema,
  listShowcase,
  saveShowcase,
  archiveShowcase,
  type ShowcaseInput,
  type ShowcaseItem,
} from "@/lib/showcase-api";
import { ClubApiError } from "@/lib/club-api";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/auth/access-state";
import { EventConfirmation } from "@/components/events/event-shared";
function ShowcaseForm({
  current,
  done,
  cancel,
}: {
  current?: ShowcaseItem;
  done: () => void;
  cancel: () => void;
}) {
  const t = useT(),
    [error, setError] = useState("");
  const form = useForm<ShowcaseInput>({
    resolver: zodResolver(showcaseFormSchema),
    defaultValues: current
      ? { ...current, published: !!current.published }
      : {
          kind: "achievement",
          title: "",
          description: "",
          image: "",
          occurredOn: new Date().toISOString().slice(0, 10),
          published: false,
        },
  });
  return (
    <form
      className="space-y-4 rounded-xl border p-5"
      onSubmit={form.handleSubmit(
        async (input) => {
          try {
            await saveShowcase(input, current);
            done();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to save content.",
            );
          }
        },
        () => setError("Unable to save content."),
      )}
    >
      <h2 className="text-xl font-semibold">
        {t(current ? "Edit content" : "New content")}
      </h2>
      <label className="grid gap-1">
        {t("Content type")}
        <select {...form.register("kind")} className="rounded border p-2">
          <option value="achievement">{t("achievement")}</option>
          <option value="gallery">{t("Photo gallery")}</option>
        </select>
      </label>
      {(["title", "description", "occurredOn", "image"] as const).map((key) => (
        <label key={key} className="grid gap-1">
          {t(
            {
              title: "Title",
              description: "Description",
              occurredOn: "Achievement or photo date",
              image: "Image URL (optional HTTPS)",
            }[key],
          )}
          {key === "description" ? (
            <textarea
              rows={3}
              {...form.register(key)}
              className="rounded border p-2"
            />
          ) : (
            <input
              type={key === "occurredOn" ? "date" : "text"}
              min={key === "occurredOn" ? "2000-01-01" : undefined}
              max={
                key === "occurredOn"
                  ? new Date().toISOString().slice(0, 10)
                  : undefined
              }
              {...form.register(key)}
              className="rounded border p-2"
            />
          )}
          {form.formState.errors[key] && (
            <span role="alert">
              {t(form.formState.errors[key]?.message, undefined, true)}
            </span>
          )}
        </label>
      ))}
      <label className="flex items-center gap-2">
        <input type="checkbox" {...form.register("published")} />
        {t("Publish content")}
      </label>
      {error && <p role="alert">{t(error, undefined, true)}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {t("Save content")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={form.formState.isSubmitting}
          onClick={cancel}
        >
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
export function ShowcaseBoard({
  staff = false,
  kind = "",
}: {
  staff?: boolean;
  kind?: string;
}) {
  const t = useT(),
    router = useRouter();
  const [data, setData] = useState<Awaited<
      ReturnType<typeof listShowcase>
    > | null>(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<ShowcaseItem | "new" | null>(null),
    [archive, setArchive] = useState<ShowcaseItem | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const refresh = () => {
    setData(null);
    setError("");
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    listShowcase(staff, page, kind, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ClubApiError && cause.status === 401 && staff)
          router.replace("/login");
        if (cause instanceof ClubApiError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof Error ? cause.message : "Unable to load content.",
        );
      });
    return () => controller.abort();
  }, [staff, page, kind, revision, router]);
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">
        {t(
          staff
            ? "Achievements and gallery management"
            : kind === "gallery"
              ? "Photo gallery"
              : "Club achievements",
        )}
      </h1>
      {staff && (
        <>
          <p>
            {t(
              "Teachers manage their own content; admins manage all. Publish only approved club material.",
            )}
          </p>
          <Button onClick={() => setEditing("new")}>{t("Add content")}</Button>
        </>
      )}
      <Button variant="outline" onClick={refresh}>
        {t("Refresh")}
      </Button>
      {editing && (
        <ShowcaseForm
          key={editing === "new" ? "new" : `${editing.id}:${editing.version}`}
          current={editing === "new" ? undefined : editing}
          done={() => {
            setEditing(null);
            refresh();
          }}
          cancel={() => setEditing(null)}
        />
      )}
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <p role="status">{t("Loading content…")}</p>
      ) : !data.items.length ? (
        <p role="status">{t("No published content is available.")}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <article
              key={item.id}
              className="space-y-3 overflow-hidden rounded-xl border p-5"
            >
              {item.image && (
                <Image
                  unoptimized
                  src={item.image}
                  alt={item.title}
                  width={800}
                  height={500}
                  referrerPolicy="no-referrer"
                  className="h-52 w-full rounded object-cover"
                />
              )}
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p>
                {item.occurredOn}
                {staff ? ` · ${t(item.published ? "Published" : "Draft")}` : ""}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {item.description}
              </p>
              {staff && (
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setEditing(item)}>
                    {t("Edit")}
                  </Button>
                  <Button variant="outline" onClick={() => setArchive(item)}>
                    {t("Archive")}
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <nav className="flex gap-4" aria-label={t("Showcase pages")}>
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
          disabled={!data?.hasNext || page >= 1000}
          onClick={() => {
            setPage((value) => value + 1);
            refresh();
          }}
        >
          {t("Next")}
        </Button>
      </nav>
      {archive && (
        <EventConfirmation
          title={t("Archive content?")}
          busy={busy}
          onCancel={() => setArchive(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await archiveShowcase(archive);
              setArchive(null);
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
          <p>{t("This content will be removed from public pages.")}</p>
        </EventConfirmation>
      )}
    </main>
  );
}
