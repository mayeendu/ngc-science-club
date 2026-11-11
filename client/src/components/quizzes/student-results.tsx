"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import type { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  AssessmentError,
  myResults,
  myPerformance,
  type historySchema,
  type performanceSchema,
} from "@/lib/assessment-api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export function StudentResults() {
  const t = useT();
  const [history, setHistory] = useState<z.infer<typeof historySchema> | null>(
      null,
    ),
    [performance, setPerformance] = useState<z.infer<
      typeof performanceSchema
    > | null>(null),
    [error, setError] = useState("");
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      myResults(page, controller.signal),
      myPerformance(controller.signal),
    ])
      .then(([results, summary]) => {
        if (!controller.signal.aborted) {
          setHistory(results);
          setPerformance(summary);
        }
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof AssessmentError && cause.status === 401)
          router.replace("/login");
        setError(
          cause instanceof AssessmentError
            ? cause.message
            : "Unable to load results.",
        );
      });
    return () => controller.abort();
  }, [page, revision, router]);
  function refresh() {
    setError("");
    setHistory(null);
    setPerformance(null);
    setRevision((value) => value + 1);
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">
        {t("My quiz results and performance")}
      </h1>
      <p className="text-slate-600">
        {t("Only released results contribute to performance statistics.")}
      </p>
      <Button variant="outline" onClick={refresh}>
        {t("Refresh results")}
      </Button>
      <Link
        href="/dashboard/student/quizzes"
        className="ml-4 text-blue-700 underline"
      >
        {t("Available quizzes")}
      </Link>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !history || !performance ? (
        <p role="status">{t("Loading results\u2026")}</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              ["Released results", performance.completed],
              ["Average percentage", `${performance.averagePercentage}%`],
              ["Best percentage", `${performance.bestPercentage}%`],
            ].map(([title, value]) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle>
                    <h2>{t(title)}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-800">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          {performance.timeline.length > 0 ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>
                  <h2>{t("Performance progress")}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  role="img"
                  aria-label={t("Student performance chart")}
                  className="min-w-0"
                >
                  <ResponsiveContainer width="100%" height={280} minWidth={0}>
                    <LineChart data={performance.timeline} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="title" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line
                        dataKey="percentage"
                        name={t("Percentage")}
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p role="status">{t("No released results yet.")}</p>
          )}
          {performance.subjects.length > 0 && (
            <section
              aria-label={t("Subject performance")}
              className="grid gap-3 sm:grid-cols-2"
            >
              {performance.subjects.map((subject) => (
                <Card key={subject.subject}>
                  <CardContent className="pt-5">
                    <h2 className="font-semibold">{subject.subject}</h2>
                    <p>
                      {subject.averagePercentage} {t("% average across")}{" "}
                      {subject.completed} {t("results")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
          <section>
            <h2 className="mb-4 text-xl font-semibold">
              {t("Attempt history")}
            </h2>
            {history.items.length === 0 ? (
              <p>{t("No attempts yet.")}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        t("Quiz"),
                        t("Status"),
                        t("Score"),
                        t("Percentage"),
                        t("Attempt"),
                      ].map((title) => (
                        <th key={title} className="p-3">
                          {t(title)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.items.map((item) => (
                      <tr key={item.quizId} className="border-t">
                        <td className="p-3">{item.title}</td>
                        <td className="p-3">
                          {item.status === "in_progress"
                            ? t("In progress")
                            : item.released
                              ? t("Released")
                              : t("Awaiting release")}
                        </td>
                        <td className="p-3">
                          {item.score === null
                            ? t("Held")
                            : `${item.score} / ${item.totalMarks}`}
                        </td>
                        <td className="p-3">
                          {item.percentage === null
                            ? t("Held")
                            : `${item.percentage}%`}
                        </td>
                        <td className="p-3">
                          <Link
                            href={`/dashboard/student/quizzes/${item.quizId}`}
                            className="text-blue-700 underline"
                          >
                            {item.status === "in_progress"
                              ? t("Resume attempt")
                              : t("View result")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <nav className="flex gap-4" aria-label={t("Attempt history pages")}>
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => {
                setHistory(null);
                setPage((value) => value - 1);
              }}
            >
              {t("Previous")}
            </Button>
            <span>
              {t("Page")} {page}
            </span>
            <Button
              variant="outline"
              disabled={!history.hasNext}
              onClick={() => {
                setHistory(null);
                setPage((value) => value + 1);
              }}
            >
              {t("Next")}
            </Button>
          </nav>
        </>
      )}
    </main>
  );
}
