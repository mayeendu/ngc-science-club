"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/components/i18n/language";
import {
  resourceCategories,
  resourceFormats,
  resourceFormSchema,
  listResources,
  saveResource,
  resourceAction,
  uploadResource,
  downloadResource,
  type Resource,
  type ResourceInput,
} from "@/lib/resource-api";
import { ClubApiError } from "@/lib/club-api";
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
import { EventConfirmation } from "@/components/events/event-shared";
function ResourceForm({
  current,
  done,
  cancel,
}: {
  current?: Resource;
  done: () => void;
  cancel: () => void;
}) {
  const t = useT(),
    [error, setError] = useState("");
  const form = useForm<ResourceInput>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: current ?? {
      title: "",
      description: "",
      category: "Physics",
      format: "pdf",
      url: "",
    },
  });
  return (
    <form
      className="space-y-4 rounded-xl border p-5"
      onSubmit={form.handleSubmit(async (input) => {
        try {
          await saveResource(input, current);
          done();
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "Unable to save resource.",
          );
        }
      })}
    >
      <h2 className="text-xl font-semibold">
        {t(current ? "Edit resource" : "New resource")}
      </h2>
      {(["title", "description", "url"] as const).map((key) => (
        <label key={key} className="grid gap-1">
          {t(
            {
              title: "Title",
              description: "Description",
              url: "External HTTPS URL (links only)",
            }[key],
          )}
          {key === "description" ? (
            <textarea
              {...form.register(key)}
              rows={3}
              className="rounded border p-2"
            />
          ) : (
            <input {...form.register(key)} className="rounded border p-2" />
          )}
          {form.formState.errors[key] && (
            <span role="alert">
              {t(form.formState.errors[key]?.message, undefined, true)}
            </span>
          )}
        </label>
      ))}
      <label className="grid gap-1">
        {t("Category")}
        <select {...form.register("category")} className="rounded border p-2">
          {resourceCategories.map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        {t("Resource format")}
        <select {...form.register("format")} className="rounded border p-2">
          {resourceFormats
            .filter((value) => !current?.file || value === current.format)
            .map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
        </select>
      </label>
      {error && <p role="alert">{t(error, undefined, true)}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {t("Save draft")}
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
export function ResourceLibrary({ staff = false }: { staff?: boolean }) {
  const t = useT(),
    router = useRouter();
  const [data, setData] = useState<Awaited<
      ReturnType<typeof listResources>
    > | null>(null),
    [page, setPage] = useState(1),
    [category, setCategory] = useState(""),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<Resource | "new" | null>(null),
    [archive, setArchive] = useState<Resource | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const refresh = () => {
    setData(null);
    setError("");
    setRevision((value) => value + 1);
  };
  function failed(cause: unknown) {
    if (cause instanceof ClubApiError && cause.status === 401)
      router.replace("/login");
    if (cause instanceof ClubApiError && cause.status === 403) setDenied(true);
    setError(
      cause instanceof Error ? cause.message : "Unable to load resources.",
    );
  }
  async function act(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      refresh();
    } catch (cause) {
      failed(cause);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    listResources(staff, page, category, q, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ClubApiError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof ClubApiError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof Error ? cause.message : "Unable to load resources.",
        );
      });
    return () => controller.abort();
  }, [staff, page, category, q, revision, router]);
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">
        {t(staff ? "Resource management" : "Science learning library")}
      </h1>
      <p>
        {t(
          "PDFs, UTF-8 notes, PPTX presentations and external links. Maximum file size: 5 MiB. Unpublish before editing or replacing files.",
        )}
      </p>
      {staff && (
        <Button onClick={() => setEditing("new")}>{t("Add resource")}</Button>
      )}
      {editing && (
        <ResourceForm
          key={editing === "new" ? "new" : `${editing.id}:${editing.version}`}
          current={editing === "new" ? undefined : editing}
          done={() => {
            setEditing(null);
            refresh();
          }}
          cancel={() => setEditing(null)}
        />
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(search.trim());
          setPage(1);
          refresh();
        }}
      >
        <label className="grid gap-1">
          {t("Search resources")}
          <input
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          {t("Category")}
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
              refresh();
            }}
            className="rounded border p-2"
          >
            <option value="">{t("All categories")}</option>
            {resourceCategories.map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">{t("Apply filters")}</Button>
        <Button type="button" variant="outline" onClick={refresh}>
          {t("Refresh")}
        </Button>
      </form>
      {error && <p role="alert">{t(error, undefined, true)}</p>}
      {!data ? (
        !error && <p role="status">{t("Loading resources…")}</p>
      ) : !data.items.length ? (
        <p role="status">{t("No resources match these filters.")}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {data.items.map((item) => (
            <article key={item.id} className="space-y-3 rounded-xl border p-5">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p>
                {t(item.category)} · {t(item.format)}
                {staff ? ` · ${t(item.published ? "Published" : "Draft")}` : ""}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {item.description}
              </p>
              {item.file && (
                <p>
                  {item.file.name} · {Math.ceil(item.file.size / 1024)}{" "}
                  {t("KiB")}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {item.format === "link" ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline"
                  >
                    {t("Open resource link")}
                  </a>
                ) : (
                  item.file && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void act(() => downloadResource(item, staff))
                      }
                    >
                      {t("Download resource")}
                    </Button>
                  )
                )}
                {staff && (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy || item.published}
                      onClick={() => setEditing(item)}
                    >
                      {t("Edit")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void act(() => resourceAction(item, !item.published))
                      }
                    >
                      {t(item.published ? "Unpublish" : "Publish")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setArchive(item)}
                    >
                      {t("Archive")}
                    </Button>
                    {!item.published && item.format !== "link" && (
                      <label className="grid gap-1">
                        {t("Upload resource file")}
                        <input
                          type="file"
                          accept={
                            item.format === "note"
                              ? ".pdf,.txt"
                              : item.format === "presentation"
                                ? ".pdf,.pptx"
                                : ".pdf"
                          }
                          disabled={busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file)
                              void act(() => uploadResource(item, file));
                          }}
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <nav className="flex gap-4" aria-label={t("Resource pages")}>
        <Button
          variant="outline"
          disabled={page === 1 || busy}
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
          disabled={!data?.hasNext || busy || page >= 1000}
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
          title={t("Archive resource?")}
          busy={busy}
          onCancel={() => setArchive(null)}
          onConfirm={() =>
            void act(async () => {
              await resourceAction(archive);
              setArchive(null);
            })
          }
        >
          <p>{t("This resource will no longer be available to students.")}</p>
        </EventConfirmation>
      )}
    </main>
  );
}
