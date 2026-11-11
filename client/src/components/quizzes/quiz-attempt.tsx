"use client";

import { useT } from "@/components/i18n/language";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "@/lib/i18n/toast";
import {
  AssessmentError,
  readAttempt,
  startAttempt,
  saveAnswers,
  submitAttempt,
  type AttemptState,
} from "@/lib/assessment-api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export function QuizAttempt({ id }: { id: string }) {
  const t = useT();
  const [data, setData] = useState<AttemptState | null>(null),
    [choices, setChoices] = useState<(number | null)[]>([]),
    [index, setIndex] = useState(0);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [blocked, setBlocked] = useState(false),
    [now, setNow] = useState(0),
    [clockOffset, setClockOffset] = useState(0);
  const revision = useRef(0),
    latest = useRef<(number | null)[]>([]),
    ended = useRef(false),
    active = useRef(true),
    autoRequested = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const accept = useCallback((next: AttemptState, replace = false) => {
    if (
      !active.current ||
      (next.attempt && next.attempt.revision < revision.current)
    )
      return;
    if (ended.current && next.attempt?.status === "in_progress") return;
    revision.current = next.attempt?.revision ?? 0;
    ended.current = next.attempt?.status === "submitted";
    setClockOffset(Date.parse(next.serverNow) - Date.now());
    setData(next);
    setNow(Date.now());
    if (replace) {
      latest.current = next.attempt?.answers ?? [];
      setChoices([...latest.current]);
    }
  }, []);
  const failed = useCallback(
    (cause: unknown) => {
      if (!active.current) return;
      setMessage(
        cause instanceof AssessmentError
          ? cause.message
          : "Unable to save or load the attempt. Please retry.",
      );
      if (cause instanceof AssessmentError && cause.status === 401)
        router.replace("/login");
      if (
        cause instanceof AssessmentError &&
        (cause.status === 409 || cause.status === 403)
      )
        setBlocked(true);
    },
    [router],
  );
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    readAttempt(id, controller.signal)
      .then((result) => accept(result, true))
      .catch((cause) => {
        if (!controller.signal.aborted) failed(cause);
      });
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => {
      active.current = false;
      controller.abort();
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, accept, failed]);
  const deadline = data?.attempt ? Date.parse(data.attempt.deadlineAt) : 0;
  const remaining = Math.max(
    0,
    Math.ceil((deadline - now - clockOffset) / 1000),
  );
  const finish = useCallback(
    async (expired: boolean) => {
      setBusy(true);
      if (timer.current) clearTimeout(timer.current);
      try {
        if (!expired) await queue.current;
        const result = await submitAttempt(
          id,
          expired
            ? {}
            : { revision: revision.current, answers: [...latest.current] },
        );
        accept(result);
        setMessage("");
        toast.success("Attempt submitted.");
      } catch (cause) {
        failed(cause);
      } finally {
        if (active.current) setBusy(false);
      }
    },
    [id, accept, failed],
  );
  useEffect(() => {
    if (
      data?.attempt?.status === "in_progress" &&
      now > 0 &&
      remaining === 0 &&
      !autoRequested.current
    ) {
      autoRequested.current = true;
      void finish(true);
    }
  }, [data?.attempt?.status, remaining, now, finish]);
  function autosave() {
    queue.current = queue.current.then(async () => {
      if (!active.current || ended.current) return;
      setSaving(true);
      try {
        const result = await saveAnswers(id, revision.current, [
          ...latest.current,
        ]);
        accept(result);
        setMessage("");
      } catch (cause) {
        failed(cause);
      } finally {
        if (active.current) setSaving(false);
      }
    });
  }
  function choose(value: number | null) {
    const next = [...latest.current];
    next[index] = value;
    latest.current = next;
    setChoices(next);
    setMessage("Answer pending save…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(autosave, 600);
  }
  async function reload() {
    setBusy(true);
    try {
      const state = await readAttempt(id);
      setBlocked(false);
      setMessage("");
      accept(state, true);
    } catch (cause) {
      failed(cause);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setBusy(true);
    try {
      accept(await startAttempt(id), true);
    } catch (cause) {
      failed(cause);
    } finally {
      setBusy(false);
    }
  }
  const attempt = data?.attempt,
    question = attempt?.questions[index];
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <Link
        href="/dashboard/student/quizzes"
        className="text-blue-700 underline"
      >
        {t("Back to quizzes")}
      </Link>
      {message && (
        <div role="alert" className="rounded-md border p-3">
          <p>{message}</p>
          {blocked && (
            <p className="mt-2 text-sm">
              {t(
                "Reload server answers to continue. Unsaved local choices will be replaced.",
              )}
            </p>
          )}
        </div>
      )}
      {!data ? (
        <div>
          <p role="status">{t("Loading quiz\u2026")}</p>
          <Button variant="outline" onClick={() => void reload()}>
            {t("Retry quiz")}
          </Button>
        </div>
      ) : (
        <>
          <h1 className="break-words text-3xl font-bold">{data.quiz.title}</h1>
          <p>{data.quiz.description}</p>
          {!attempt ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>{t("Quiz instructions")}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  {data.quiz.questionCount} {t("questions \u00B7")}{" "}
                  {data.quiz.durationMinutes} {t("minutes \u00B7")}{" "}
                  {data.quiz.totalMarks} {t("marks")}
                </p>
                <p>
                  {t(
                    "One attempt only. The server starts and enforces your deadline. Answers autosave after selection; only successfully saved answers count if time expires. Results are held until the teacher closes the quiz and releases them.",
                  )}
                </p>
                <Button
                  disabled={busy || data.quiz.closed}
                  onClick={() => void start()}
                >
                  {data.quiz.closed
                    ? t("Quiz closed")
                    : busy
                      ? t("Starting\u2026")
                      : t("Start quiz")}
                </Button>
              </CardContent>
            </Card>
          ) : attempt.status === "submitted" ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>{t("Attempt submitted")}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {!attempt.result ? (
                  <p role="status">
                    {t("Results are awaiting teacher release.")}
                  </p>
                ) : (
                  <>
                    <p className="text-xl font-bold">
                      {t("Score:")} {attempt.result.score} /{" "}
                      {data.quiz.totalMarks} ({attempt.result.percentage}%)
                    </p>
                    {attempt.result.review.map((review, i) => (
                      <section
                        key={i}
                        className="space-y-2 rounded-md border p-4"
                      >
                        <h3 className="font-semibold">
                          {t("Question")} {i + 1}: {review.text}
                        </h3>
                        <p>
                          {t("Your answer:")}{" "}
                          {review.selectedOption === null
                            ? t("Unanswered")
                            : review.options[review.selectedOption]}
                        </p>
                        <p>
                          {t("Correct answer:")}{" "}
                          {review.options[review.correctOption]}
                        </p>
                        <p>
                          {t("Marks:")} {review.earnedMarks} / {review.marks}
                        </p>
                        <p className="whitespace-pre-wrap break-words">
                          {review.explanation}
                        </p>
                      </section>
                    ))}
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => void reload()}
                  disabled={busy}
                >
                  {t("Refresh result")}
                </Button>
                <Link
                  href="/dashboard/student/results"
                  className="ml-4 text-blue-700 underline"
                >
                  {t("My results")}
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap justify-between gap-3 rounded-xl border bg-white p-4">
                <p role="timer" aria-label={t("Time remaining")}>
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                  {t("remaining")}
                </p>
                <p>
                  {choices.filter((value) => value !== null).length} /{" "}
                  {attempt.questions.length} {t("answered")}
                </p>
                <p role="status">
                  {saving
                    ? t("Saving answers\u2026")
                    : message
                      ? t("Check save status")
                      : t("Answers saved")}
                </p>
              </div>
              <progress
                aria-label={t("Quiz progress")}
                max={attempt.questions.length}
                value={choices.filter((value) => value !== null).length}
                className="h-3 w-full accent-teal-600"
              />
              <nav
                aria-label={t("Question navigation")}
                className="flex flex-wrap gap-2"
              >
                {attempt.questions.map((_, i) => (
                  <Button
                    key={i}
                    variant={index === i ? "default" : "outline"}
                    aria-label={t("Go to question {0}", [i + 1])}
                    aria-current={index === i ? "step" : undefined}
                    onClick={() => setIndex(i)}
                  >
                    {i + 1}
                    {choices[i] !== null ? " ✓" : ""}
                  </Button>
                ))}
              </nav>
              {question && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h2>
                        {t("Question")} {index + 1}: {question.text}
                      </h2>
                    </CardTitle>
                    <p>
                      {question.marks} {t("marks")}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <fieldset
                      disabled={busy || blocked || remaining === 0}
                      className="space-y-3"
                    >
                      <legend className="sr-only">
                        {t("Choose one answer")}
                      </legend>
                      {question.options.map((option, value) => (
                        <label
                          key={value}
                          className="flex cursor-pointer items-start gap-3 rounded-md border p-4"
                        >
                          <input
                            type="radio"
                            name={`question-${index}`}
                            checked={choices[index] === value}
                            onChange={() => choose(value)}
                            className="mt-1"
                          />
                          <span className="break-words">{option}</span>
                        </label>
                      ))}
                      <Button variant="outline" onClick={() => choose(null)}>
                        {t("Clear answer")}
                      </Button>
                    </fieldset>
                  </CardContent>
                </Card>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setIndex((value) => value - 1)}
                >
                  {t("Previous question")}
                </Button>
                <Button
                  variant="outline"
                  disabled={index >= attempt.questions.length - 1}
                  onClick={() => setIndex((value) => value + 1)}
                >
                  {t("Next question")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void reload()}
                >
                  {t("Reload server answers")}
                </Button>
                <Button
                  disabled={busy || blocked || remaining === 0}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Submit your quiz? Submitted answers cannot be changed.",
                      )
                    )
                      void finish(false);
                  }}
                >
                  {busy ? t("Submitting\u2026") : t("Submit quiz")}
                </Button>
                {remaining === 0 && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void finish(true)}
                  >
                    {t("Finalize expired attempt")}
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
