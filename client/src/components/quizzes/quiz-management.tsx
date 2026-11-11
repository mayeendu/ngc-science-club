"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "@/lib/i18n/toast";
import Link from "next/link";
import {
  QuizApiError,
  listQuizzes,
  quizDetail,
  quizAction,
  type QuizDetail,
  type QuizSummary,
  type QuizList,
} from "@/lib/quiz-api";
import { QuizEditor } from "./quiz-editor";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/auth/access-state";
type Action = {
  quiz: QuizSummary;
  action: "publish" | "unpublish" | "delete";
};
export function QuizManagement() {
  const t = useT();
  const [list, setList] = useState<QuizList | null>(null),
    [error, setError] = useState("");
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{
    quiz: QuizDetail | null;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false),
    [action, setAction] = useState<Action | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useId(),
    router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    listQuizzes(page, status, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setList(data);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof QuizApiError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof QuizApiError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof QuizApiError
            ? cause.message
            : "Unable to load quizzes. Please try again.",
        );
      });
    return () => controller.abort();
  }, [page, status, revision, router]);
  useEffect(() => {
    const element = dialog.current;
    if (action && element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, [action]);
  function refresh() {
    setList(null);
    setError("");
    setRevision((value) => value + 1);
  }
  function failed(cause: unknown) {
    toast.error(
      cause instanceof QuizApiError
        ? cause.message
        : "Unable to manage quizzes. Please try again.",
    );
    if (cause instanceof QuizApiError) {
      if (cause.status === 401) {
        setEditor(null);
        setAction(null);
        router.replace("/login");
      }
      if (cause.status === 403) {
        setEditor(null);
        setAction(null);
        setDenied(true);
      }
      if (cause.status === 409 || cause.status === 404) {
        setEditor(null);
        refresh();
      }
    }
  }
  async function edit(quiz: QuizSummary) {
    setBusy(true);
    try {
      const detail = await quizDetail(quiz.id);
      if (detail.status !== "draft") throw new QuizApiError(409);
      setEditor({ quiz: detail });
    } catch (cause) {
      failed(cause);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!action || busy) return;
    setBusy(true);
    try {
      await quizAction(action.quiz, action.action);
      toast.success(
        action.action === "delete"
          ? "Quiz deleted."
          : action.action === "publish"
            ? "Quiz published."
            : "Quiz unpublished.",
      );
      setAction(null);
      refresh();
    } catch (cause) {
      setAction(null);
      failed(cause);
    } finally {
      setBusy(false);
    }
  }
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("Quiz management")}</h1>
      <p className="text-slate-600">
        {t(
          "Teachers manage their own quizzes; administrators manage all. Unpublish before editing or deleting.",
        )}
      </p>
      {busy && !action && !editor && (
        <p role="status">{t("Loading quiz\u2026")}</p>
      )}
      {editor ? (
        <QuizEditor
          key={editor.quiz?.id ?? "new"}
          quiz={editor.quiz}
          cancel={() => setEditor(null)}
          failed={failed}
          saved={() => {
            toast.success("Quiz draft saved.");
            setEditor(null);
            refresh();
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setEditor({ quiz: null })} disabled={busy}>
              {t("New quiz")}
            </Button>
            <label htmlFor="quiz-status" className="text-sm font-medium">
              {t("Quiz status")}
            </label>
            <select
              id="quiz-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
                setList(null);
                setError("");
              }}
              className="rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">{t("All quizzes")}</option>
              <option value="draft">{t("Draft")}</option>
              <option value="published">{t("Published")}</option>
            </select>
            <Button variant="outline" onClick={refresh}>
              {t("Refresh quizzes")}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-red-700">
              {t(error, undefined, true)}
            </p>
          ) : !list ? (
            <p role="status">{t("Loading quizzes\u2026")}</p>
          ) : list.quizzes.length === 0 ? (
            <p role="status">
              {t("No quizzes on this page. Create a draft to get started.")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  {t("Managed science quizzes")}
                </caption>
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      t("Quiz"),
                      t("Subject"),
                      t("Duration"),
                      t("Marks"),
                      t("Status"),
                      t("Actions"),
                    ].map((label) => (
                      <th key={label} className="p-4">
                        {t(label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.quizzes.map((quiz) => (
                    <tr key={quiz.id} className="border-t">
                      <td className="max-w-xs break-words p-4 font-medium">
                        {quiz.title}
                        <span className="mt-1 block text-xs text-slate-500">
                          {quiz.questionCount} {t("questions")}
                        </span>
                      </td>
                      <td className="p-4">{quiz.subject}</td>
                      <td className="whitespace-nowrap p-4">
                        {quiz.durationMinutes} {t("min")}
                      </td>
                      <td className="p-4">{quiz.totalMarks}</td>
                      <td className="p-4 capitalize">{t(quiz.status)}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              busy ||
                              quiz.status !== "draft" ||
                              quiz.hasAttempts ||
                              quiz.closed
                            }
                            onClick={() => void edit(quiz)}
                          >
                            {t("Edit")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || quiz.hasAttempts || quiz.closed}
                            onClick={() =>
                              setAction({
                                quiz,
                                action:
                                  quiz.status === "draft"
                                    ? "publish"
                                    : "unpublish",
                              })
                            }
                          >
                            {quiz.status === "draft"
                              ? t("Publish")
                              : t("Unpublish")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              busy ||
                              quiz.status !== "draft" ||
                              quiz.hasAttempts ||
                              quiz.closed
                            }
                            onClick={() =>
                              setAction({ quiz, action: "delete" })
                            }
                          >
                            {t("Delete")}
                          </Button>
                          {quiz.status === "published" && (
                            <Link
                              href={`/dashboard/teacher/quizzes/${quiz.id}/results`}
                              className="self-center text-blue-700 underline"
                            >
                              {t("Results and analytics")}
                            </Link>
                          )}
                          {quiz.hasAttempts && (
                            <span className="text-xs text-slate-600">
                              {t("Content locked after first attempt")}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {list && (
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                disabled={page === 1 || busy}
                onClick={() => {
                  setPage((value) => value - 1);
                  setList(null);
                }}
              >
                {t("Previous quizzes")}
              </Button>
              <span>
                {t("Page")} {page}
              </span>
              <Button
                variant="outline"
                disabled={!list.hasNext || page >= 1000 || busy}
                onClick={() => {
                  setPage((value) => value + 1);
                  setList(null);
                }}
              >
                {t("Next quizzes")}
              </Button>
            </div>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={heading}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setAction(null);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
      >
        {action && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
            className="space-y-4"
          >
            <h2 id={heading} className="text-xl font-bold">
              {action.action === "delete"
                ? t("Delete quiz?")
                : action.action === "publish"
                  ? t("Publish quiz?")
                  : t("Unpublish quiz?")}
            </h2>
            <p className="break-words">{action.quiz.title}</p>
            <p className="text-sm text-slate-600">
              {action.action === "delete"
                ? t(
                    "This draft will be removed from management. Its stored record is retained.",
                  )
                : action.action === "publish"
                  ? t(
                      "Publishing requires at least one valid question with four options and one correct answer.",
                    )
                  : t("The quiz will return to draft status.")}
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                {t("Cancel action")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? t("Saving\u2026") : t("Confirm action")}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}
