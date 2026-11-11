"use client";
import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "@/lib/i18n/toast";
import { useSession } from "@/lib/auth-client";
import {
  feedbackCategories,
  feedbackStatuses,
  feedbackFormSchema,
  feedbackList,
  submitFeedback,
  replyFeedback,
  assignFeedback,
  type FeedbackInput,
  type FeedbackThread,
  type FeedbackStatus,
} from "@/lib/feedback-api";
import { ClubApiError } from "@/lib/club-api";
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
function NewFeedback({ onSaved }: { onSaved: () => void }) {
  const t = useT();
  const form = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { category: "suggestion", subject: "", message: "" },
  });
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4 rounded-xl border p-5"
      onSubmit={form.handleSubmit(async (input) => {
        setError("");
        try {
          await submitFeedback(input);
          form.reset();
          toast.success("Feedback submitted privately.");
          onSaved();
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to submit feedback.",
          );
        }
      })}
    >
      <h2 className="text-xl font-semibold">
        {t("Send feedback or a suggestion")}
      </h2>
      <label className="grid gap-1">
        {t("Category")}
        <select {...form.register("category")} className="rounded border p-2">
          {feedbackCategories.map((value) => (
            <option value={value} key={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        {t("Subject")}
        <input
          maxLength={150}
          {...form.register("subject")}
          className="rounded border p-2"
        />
        {form.formState.errors.subject && (
          <span role="alert">{t(form.formState.errors.subject?.message)}</span>
        )}
      </label>
      <label className="grid gap-1">
        {t("Message")}
        <textarea
          rows={4}
          maxLength={3000}
          {...form.register("message")}
          className="rounded border p-2"
        />
        {form.formState.errors.message && (
          <span role="alert">{t(form.formState.errors.message?.message)}</span>
        )}
      </label>
      {error && <p role="alert">{t(error, undefined, true)}</p>}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {t("Send feedback")}
      </Button>
    </form>
  );
}
function Thread({
  thread,
  staff,
  admin,
  onSaved,
}: {
  thread: FeedbackThread;
  staff: boolean;
  admin: boolean;
  onSaved: () => void;
}) {
  const t = useT();
  const [message, setMessage] = useState(""),
    [status, setStatus] = useState<FeedbackStatus>(thread.status),
    [teacher, setTeacher] = useState(thread.assignedTeacherId ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update feedback.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-4 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">{thread.subject}</h2>
      <p className="text-sm">
        {t(thread.category)} · {t(thread.status)} ·{" "}
        {new Date(thread.createdAt).toLocaleDateString("en-GB", {
          timeZone: "Asia/Dhaka",
        })}
        {thread.memberName ? ` · ${thread.memberName}` : ""}
      </p>
      <ol
        className="space-y-3"
        aria-label={t("Messages for {0}", [thread.subject])}
      >
        {thread.messages.map((item, index) => (
          <li key={index} className="rounded-lg bg-slate-50 p-3">
            <p className="text-sm font-medium">
              {t(item.author === "staff" ? "Club staff" : "Member")} ·{" "}
              {new Date(item.sentAt).toLocaleString("en-GB", {
                timeZone: "Asia/Dhaka",
              })}
            </p>
            <p className="whitespace-pre-wrap break-words">{item.message}</p>
          </li>
        ))}
      </ol>
      {thread.messages.length < 50 ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void act(() =>
              replyFeedback(thread, message.trim(), staff, status),
            );
          }}
        >
          <label className="grid gap-1">
            {t("Reply to")} {thread.subject}
            <textarea
              required
              minLength={1}
              maxLength={3000}
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="rounded border p-2"
            />
          </label>
          {staff && (
            <label className="grid gap-1">
              {t("Status for")} {thread.subject}
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as FeedbackStatus)
                }
                className="rounded border p-2"
              >
                {feedbackStatuses.map((value) => (
                  <option key={value} value={value}>
                    {t(value)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit" disabled={busy || !message.trim()}>
            {t("Send reply")}
          </Button>
        </form>
      ) : (
        <p>
          {t(
            "This thread reached its 50-message limit. Submit a new feedback thread if needed.",
          )}
        </p>
      )}
      {admin && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void act(() => assignFeedback(thread, teacher.trim()));
          }}
        >
          <label className="grid gap-1">
            {t("Assigned teacher account ID for")} {thread.subject}
            <input
              pattern="[a-f0-9]{24}|"
              value={teacher}
              onChange={(event) => setTeacher(event.target.value)}
              className="rounded border p-2"
            />
          </label>
          <Button type="submit" variant="outline" disabled={busy}>
            {t("Save assignment")}
          </Button>
          <p className="text-sm">
            {t("Leave blank to return to the admin queue.")}
          </p>
        </form>
      )}
      {error && <p role="alert">{t(error, undefined, true)}</p>}
    </article>
  );
}
export function FeedbackBoard({ staff = false }: { staff?: boolean }) {
  const t = useT();
  const router = useRouter(),
    { data: session } = useSession();
  const [data, setData] = useState<Awaited<
      ReturnType<typeof feedbackList>
    > | null>(null),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const refresh = () => {
    setData(null);
    setError("");
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    feedbackList(staff, page, status, category, controller.signal)
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
          cause instanceof Error ? cause.message : "Unable to load feedback.",
        );
      });
    return () => controller.abort();
  }, [staff, page, status, category, revision, router]);
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">
        {t(staff ? "Feedback management" : "My feedback and suggestions")}
      </h1>
      <p>
        {t(
          staff
            ? "Admins manage all feedback. Teachers see only threads explicitly assigned to them."
            : "Your messages are private to you, club administrators and the teacher assigned to your thread. A new member reply reopens the thread.",
        )}
      </p>
      {!staff && (
        <NewFeedback
          onSaved={() => {
            setPage(1);
            refresh();
          }}
        />
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          {t("Filter status")}
          <select
            value={status}
            className="rounded border p-2"
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
              refresh();
            }}
          >
            <option value="">{t("All statuses")}</option>
            {feedbackStatuses.map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          {t("Filter category")}
          <select
            value={category}
            className="rounded border p-2"
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
              refresh();
            }}
          >
            <option value="">{t("All categories")}</option>
            {feedbackCategories.map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={refresh}>
          {t("Refresh feedback")}
        </Button>
      </div>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <p role="status">{t("Loading feedback\u2026")}</p>
      ) : data.items.length === 0 ? (
        <p role="status">{t("No feedback matches these filters.")}</p>
      ) : (
        data.items.map((thread) => (
          <Thread
            key={`${thread.id}:${thread.version}`}
            thread={thread}
            staff={staff}
            admin={staff && session?.user.role === "admin"}
            onSaved={refresh}
          />
        ))
      )}
      <nav className="flex gap-4" aria-label={t("Feedback pages")}>
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
    </main>
  );
}
