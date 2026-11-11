"use client";

import { useT } from "@/components/i18n/language";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPerformance, type Performance } from "@/lib/performance-api";
import { AssessmentError } from "@/lib/assessment-api";
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function PerformanceDashboard({
  student = false,
}: {
  student?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [filters, setFilters] = useState({ from: "", to: "", subject: "" });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<Performance | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    getPerformance(student, params, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof AssessmentError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof AssessmentError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof AssessmentError
            ? cause.message
            : "Unable to load performance. Please retry.",
        );
      });
    return () => controller.abort();
  }, [student, query, page, refresh, router]);
  function reload() {
    setData(null);
    setError("");
    setRefresh((value) => value + 1);
  }
  if (denied) return <AccessDenied />;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold">
        {student ? t("My performance") : t("Student performance")}
      </h1>
      <p>
        {t(
          "Released quiz results only. Averages give each submitted quiz attempt equal weight. Dates use UTC submission days; the default range is the last 12 calendar months.",
        )}
      </p>
      <nav
        aria-label={t("Participation history")}
        className="flex flex-wrap gap-5 text-blue-700 underline"
      >
        <Link
          href={
            student
              ? "/dashboard/student/results"
              : "/dashboard/teacher/quizzes"
          }
        >
          {student
            ? t("All quiz participation and results")
            : t("Per-quiz reports and rankings")}
        </Link>
        <Link
          href={
            student ? "/dashboard/student/events" : "/dashboard/teacher/events"
          }
        >
          {student
            ? t("My event participation and attendance")
            : t("Event participation reports")}
        </Link>
      </nav>
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !!filters.from !== !!filters.to ||
            (filters.from && filters.from > filters.to)
          ) {
            setError("Choose an ordered pair of dates.");
            setData(null);
            return;
          }
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(filters))
            if (value.trim()) params.set(key, value.trim());
          setQuery(params.toString());
          setPage(1);
          reload();
        }}
      >
        {(["from", "to", "subject"] as const).map((key) => (
          <label key={key} className="grid gap-1 text-sm font-medium">
            {key === "from"
              ? t("From (UTC)")
              : key === "to"
                ? t("To (UTC)")
                : t("Subject (exact match)")}
            <input
              type={key === "subject" ? "text" : "date"}
              maxLength={key === "subject" ? 100 : undefined}
              min={key === "subject" ? undefined : "2000-01-01"}
              max={key === "subject" ? undefined : "2100-12-31"}
              className="rounded-md border bg-white p-2"
              value={filters[key]}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
        <Button type="submit">{t("Apply filters")}</Button>
        <Button type="button" variant="outline" onClick={reload}>
          {t("Refresh")}
        </Button>
      </form>
      {error ? (
        <p role="alert">{t(error, undefined, true)}</p>
      ) : !data ? (
        <p role="status">{t("Loading performance\u2026")}</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {data.range.from} {t("to")} {data.range.to} {t("(UTC)")}
          </p>
          <section
            aria-label={t("Performance summary")}
            className="grid gap-4 sm:grid-cols-3"
          >
            {[
              ["Released attempts", data.completed],
              ["Average percentage", `${data.averagePercentage}%`],
              ["Best percentage", `${data.bestPercentage}%`],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle>
                    <h2>{t(label)}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-800">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          {data.completed === 0 ? (
            <p role="status">{t("No released results match these filters.")}</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>{t("Monthly progress")}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    role="img"
                    aria-label={t("Monthly average percentage chart")}
                  >
                    <ResponsiveContainer width="100%" height={260} minWidth={0}>
                      <LineChart data={data.timeline} accessibilityLayer>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line
                          dataKey="averagePercentage"
                          name={t("Average %")}
                          stroke="#0f766e"
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        {t("Monthly progress data")}
                      </caption>
                      <thead>
                        <tr>
                          <th className="p-2">{t("Month")}</th>
                          <th className="p-2">{t("Attempts")}</th>
                          <th className="p-2">{t("Average %")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.timeline.map((row) => (
                          <tr key={row.month}>
                            <td className="p-2">{row.month}</td>
                            <td className="p-2">{row.completed}</td>
                            <td className="p-2">{row.averagePercentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>{t("Quiz comparisons")}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    role="img"
                    aria-label={t("Quiz average percentage comparison")}
                  >
                    <ResponsiveContainer width="100%" height={280} minWidth={0}>
                      <BarChart data={data.quizzes} accessibilityLayer>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="title" hide />
                        <YAxis domain={[0, 100]} />
                        <Tooltip
                          labelFormatter={(_label, payload) =>
                            payload?.[0]?.payload?.title ?? "Quiz"
                          }
                        />
                        <Bar
                          dataKey="averagePercentage"
                          name={t("Average %")}
                          fill="#2563eb"
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        {t("Quiz comparison data")}
                      </caption>
                      <thead>
                        <tr>
                          {[
                            t("Quiz"),
                            t("Subject"),
                            t("Attempts"),
                            t("Average %"),
                          ].map((label) => (
                            <th key={label} className="p-2">
                              {t(label)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.quizzes.map((row) => (
                          <tr key={row.quizId} className="border-t">
                            <td className="p-2">{row.title}</td>
                            <td className="p-2">{row.subject}</td>
                            <td className="p-2">{row.completed}</td>
                            <td className="p-2">{row.averagePercentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              {student ? (
                <section>
                  <h2 className="text-xl font-semibold">
                    {t("Released score history")}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          {[
                            t("Quiz"),
                            t("Submitted (UTC)"),
                            t("Score"),
                            t("Percentage"),
                          ].map((label) => (
                            <th key={label} className="p-2">
                              {t(label)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.history.map((row) => (
                          <tr key={row.quizId} className="border-t">
                            <td className="p-2">{row.title}</td>
                            <td className="p-2">
                              {row.submittedAt.slice(0, 10)}
                            </td>
                            <td className="p-2">
                              {row.score} / {row.totalMarks}
                            </td>
                            <td className="p-2">{row.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <section>
                  <h2 className="text-xl font-semibold">
                    {t("Student rankings")}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {t(
                      "Ranked by average percentage rounded to two decimals; ties share a rank. Students may have taken different quizzes. Teachers see their own quizzes; admins see all.",
                    )}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          {[
                            t("Rank"),
                            t("Member"),
                            t("Attempts"),
                            t("Average %"),
                          ].map((label) => (
                            <th key={label} className="p-2">
                              {t(label)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.rankings.map((row, index) => (
                          <tr key={`${row.rank}-${index}`} className="border-t">
                            <td className="p-2">{row.rank}</td>
                            <td className="p-2">{row.name}</td>
                            <td className="p-2">{row.completed}</td>
                            <td className="p-2">{row.averagePercentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              <nav
                aria-label={t("Performance pages")}
                className="flex items-center gap-4"
              >
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => {
                    setPage((value) => value - 1);
                    setData(null);
                  }}
                >
                  {t("Previous")}
                </Button>
                <span>
                  {t("Page")} {page}
                </span>
                <Button
                  variant="outline"
                  disabled={
                    page >= 1000 ||
                    !(
                      data.quizzesHasNext ||
                      (student ? data.historyHasNext : data.rankingsHasNext)
                    )
                  }
                  onClick={() => {
                    setPage((value) => value + 1);
                    setData(null);
                  }}
                >
                  {t("Next")}
                </Button>
              </nav>
            </>
          )}
        </>
      )}
    </main>
  );
}
