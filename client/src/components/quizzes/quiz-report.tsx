"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  AssessmentError,
  quizReport,
  controlAssessment,
  type reportSchema,
} from "@/lib/assessment-api";
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export function QuizReport({ id }: { id: string }) {
  const [data, setData] = useState<z.infer<typeof reportSchema> | null>(null),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState<"close" | "release" | null>(null),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useId(),
    router = useRouter();
  function failed(cause: unknown) {
    if (cause instanceof AssessmentError && cause.status === 401)
      router.replace("/login");
    if (cause instanceof AssessmentError && cause.status === 403)
      setDenied(true);
    setError(
      cause instanceof AssessmentError
        ? cause.message
        : "Unable to load quiz report.",
    );
  }
  useEffect(() => {
    const controller = new AbortController();
    quizReport(id, page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof AssessmentError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof AssessmentError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof AssessmentError
            ? cause.message
            : "Unable to load quiz report.",
        );
      });
    return () => controller.abort();
  }, [id, page, revision, router]);
  useEffect(() => {
    const element = dialog.current;
    if (action && element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, [action]);
  function refresh() {
    setData(null);
    setError("");
    setRevision((value) => value + 1);
  }
  async function confirm() {
    if (!action || busy) return;
    setBusy(true);
    try {
      await controlAssessment(id, action);
      toast.success(
        action === "close"
          ? "Quiz closed and active attempts submitted."
          : "Results released to students.",
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
      <h1 className="text-3xl font-bold">Quiz results and analytics</h1>
      <Button variant="outline" onClick={refresh}>
        Refresh report
      </Button>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading quiz results…</p>
      ) : (
        <>
          <h2 className="text-2xl font-semibold">{data.quiz.title}</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy || data.quiz.closed}
              onClick={() => setAction("close")}
            >
              Close quiz
            </Button>
            <Button
              disabled={busy || !data.quiz.closed || data.quiz.resultsReleased}
              onClick={() => setAction("release")}
            >
              Release results
            </Button>
            <span className="self-center text-sm">
              {data.quiz.resultsReleased
                ? "Results released"
                : data.quiz.closed
                  ? "Closed; results held"
                  : "Open for attempts"}
            </span>
          </div>
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              ["Participants", data.participants],
              ["Submitted", data.submitted],
              [
                "Average score",
                `${data.averageScore} / ${data.quiz.totalMarks}`,
              ],
            ].map(([title, value]) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle>
                    <h3>{title}</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-800">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          {data.submitted === 0 ? (
            <p role="status">No submitted attempts yet.</p>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Question accuracy</h3>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Question accuracy chart">
                  <ResponsiveContainer width="100%" height={280} minWidth={0}>
                    <BarChart data={data.questions} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="question" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar
                        dataKey="accuracy"
                        name="Accuracy %"
                        fill="#0f766e"
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          <section>
            <h3 className="mb-3 text-xl font-semibold">Rankings</h3>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["Rank", "Member", "Score", "Percentage"].map((label) => (
                      <th key={label} className="p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rankings.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3">{row.rank}</td>
                      <td className="p-3">{row.name}</td>
                      <td className="p-3">{row.score}</td>
                      <td className="p-3">{row.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="mt-4 flex gap-4" aria-label="Ranking pages">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => {
                  setData(null);
                  setPage((value) => value - 1);
                }}
              >
                Previous
              </Button>
              <span>Page {page}</span>
              <Button
                variant="outline"
                disabled={!data.hasNext}
                onClick={() => {
                  setData(null);
                  setPage((value) => value + 1);
                }}
              >
                Next
              </Button>
            </nav>
          </section>
          <section>
            <h3 className="mb-3 text-xl font-semibold">
              Question-wise statistics
            </h3>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Question",
                      "Correct",
                      "Incorrect",
                      "Unanswered",
                      "Accuracy",
                    ].map((label) => (
                      <th key={label} className="p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.questions.map((row) => (
                    <tr key={row.question} className="border-t">
                      <td className="p-3">
                        {row.question}. {row.text}
                      </td>
                      <td className="p-3">{row.correct}</td>
                      <td className="p-3">{row.incorrect}</td>
                      <td className="p-3">{row.unanswered}</td>
                      <td className="p-3">{row.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
              {action === "close"
                ? "Close this quiz permanently?"
                : "Release results and answer explanations?"}
            </h2>
            <p>
              {action === "close"
                ? "New starts and answer changes will stop. Active attempts are scored from saved answers. The quiz cannot be reopened."
                : "Students with submitted attempts will see their scores, correct answers and explanations. Release cannot be undone."}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}
