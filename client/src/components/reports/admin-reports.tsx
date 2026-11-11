"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clubRequest } from "@/lib/club-api";
import { useT } from "@/components/i18n/language";
import { Button } from "@/components/ui/button";
const schema = z.object({
  success: z.literal(true),
  report: z.object({
    range: z.object({ from: z.string(), to: z.string() }),
    generatedAt: z.iso.datetime(),
    sections: z.array(
      z.object({
        key: z.string(),
        total: z.number(),
        states: z.array(z.object({ state: z.string(), count: z.number() })),
        monthly: z.array(z.object({ month: z.string(), count: z.number() })),
      }),
    ),
  }),
});
type Report = z.infer<typeof schema>["report"];
export function AdminReports() {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 4) + "-01-01"),
    [to, setTo] = useState(today);
  const [query, setQuery] = useState(""),
    [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    clubRequest(`admin/reports?${query}`, schema, { signal: controller.signal })
      .then((data) => {
        setReport(data.report);
        setFrom(data.report.range.from);
        setTo(data.report.range.to);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [query, revision]);
  async function csv() {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AUTH_URL}/api/admin/reports/export.csv?${new URLSearchParams(report!.range)}`,
        {
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw new Error("Unable to export report.");
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = `club-report-${report!.range.from}-${report!.range.to}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Unable to export report.");
    }
  }
  const labels: Record<string, string> = {
    members: t("Members"),
    quizzes: t("Quizzes"),
    events: t("Events"),
    attendance: t("Attendance"),
    feedback: t("Feedback"),
  };
  return (
    <main className="report-page mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("Club reports")}</h1>
      <p>
        {t(
          "Counts use submission, quiz creation, event start, registration and feedback creation dates in UTC. Statuses reflect the current state; archived events and quizzes are excluded.",
        )}
      </p>
      <form
        className="no-print flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setReport(undefined);
          setQuery(new URLSearchParams({ from, to }).toString());
          setRevision((value) => value + 1);
        }}
      >
        <label>
          {t("From")}
          <input
            className="block rounded border p-2"
            type="date"
            required
            min="2000-01-01"
            max="2100-12-31"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          {t("To")}
          <input
            className="block rounded border p-2"
            type="date"
            required
            min={from}
            max="2100-12-31"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={busy}>
          {t("Apply filters")}
        </Button>
      </form>
      {busy && <p role="status">{t("Loading reports…")}</p>}
      {error && <p role="alert">{t(error, undefined, true)}</p>}
      {report && !busy && (
        <>
          <p>
            {report.range.from} – {report.range.to} · {t("Generated at")}{" "}
            {report.generatedAt}
          </p>
          <div className="no-print flex gap-3">
            <Button onClick={csv}>{t("Export CSV")}</Button>
            <Button onClick={() => window.print()}>
              {t("Print or save PDF")}
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.sections.map((section) => (
              <section key={section.key} className="rounded-xl border p-4">
                <h2 className="text-xl font-semibold">{labels[section.key]}</h2>
                <p className="text-3xl font-bold">{section.total}</p>
                <dl>
                  {section.states.map((state) => (
                    <div
                      key={state.state}
                      className="flex justify-between gap-4"
                    >
                      <dt>{t(state.state)}</dt>
                      <dd>{state.count}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          {!report.sections.some((section) => section.total) && (
            <p>{t("No activity in this date range.")}</p>
          )}
          <section
            className="no-print h-72"
            aria-label={t("Activity comparison")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.sections.map((section) => ({
                  label: labels[section.key],
                  count: section.total,
                }))}
                accessibilityLayer
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name={t("Total")} fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </section>
          <h2 className="text-xl font-semibold">{t("Monthly activity")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t("Monthly activity")}</caption>
              <thead>
                <tr>
                  <th>{t("Category")}</th>
                  <th>{t("Month")}</th>
                  <th>{t("Total")}</th>
                </tr>
              </thead>
              <tbody>
                {report.sections.flatMap((section) =>
                  section.monthly.map((month) => (
                    <tr key={`${section.key}-${month.month}`}>
                      <td>{labels[section.key]}</td>
                      <td>{month.month}</td>
                      <td>{month.count}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
