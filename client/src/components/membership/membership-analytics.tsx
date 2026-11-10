"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  AnalyticsError,
  defaultAnalyticsDates,
  getMembershipAnalytics,
  type MembershipAnalytics,
} from "@/lib/membership-analytics-api";
import { AccessDenied } from "@/components/auth/access-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics">
      <span className="sr-only">Loading membership analytics</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-28 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-6 h-80 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"
      />
    </div>
  );
}
export function MembershipAnalyticsDashboard() {
  const [draft, setDraft] = useState(defaultAnalyticsDates);
  const [dates, setDates] = useState(draft);
  const [data, setData] = useState<MembershipAnalytics | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [revision, setRevision] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    getMembershipAnalytics(dates, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof AnalyticsError && cause.status === 401)
          router.replace("/login");
        if (cause instanceof AnalyticsError && cause.status === 403)
          setDenied(true);
        setError(
          cause instanceof AnalyticsError
            ? cause.message
            : "Unable to load membership analytics. Please try again.",
        );
      });
    return () => controller.abort();
  }, [dates, revision, router]);
  function refresh() {
    setData(null);
    setError("");
    setRevision((value) => value + 1);
  }
  if (denied) return <AccessDenied />;
  return (
    <main className="min-h-[80vh] bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="mb-2 text-sm font-semibold text-teal-700">
            NGC Science Club
          </p>
          <h1 className="text-3xl font-bold">Membership analytics</h1>
          <p className="mt-3 text-slate-600">
            Application activity and newly approved membership, calculated by
            the API.
          </p>
        </header>
        <form
          className="flex flex-wrap items-end gap-4 rounded-xl border bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const start = Date.parse(draft.from),
              end = Date.parse(draft.to);
            if (
              !Number.isFinite(start) ||
              !Number.isFinite(end) ||
              start > end ||
              end - start >= 731 * 86_400_000
            ) {
              setError("Select valid dates in order, at most 731 days apart.");
              setData(null);
              return;
            }
            setDates({ ...draft });
            refresh();
          }}
        >
          <div>
            <label
              htmlFor="analytics-from"
              className="mb-2 block text-sm font-medium"
            >
              From date (UTC)
            </label>
            <Input
              id="analytics-from"
              type="date"
              required
              min="2000-01-01"
              max="2100-12-31"
              value={draft.from}
              onChange={(event) =>
                setDraft((value) => ({ ...value, from: event.target.value }))
              }
            />
          </div>
          <div>
            <label
              htmlFor="analytics-to"
              className="mb-2 block text-sm font-medium"
            >
              To date (UTC)
            </label>
            <Input
              id="analytics-to"
              type="date"
              required
              min="2000-01-01"
              max="2100-12-31"
              value={draft.to}
              onChange={(event) =>
                setDraft((value) => ({ ...value, to: event.target.value }))
              }
            />
          </div>
          <Button type="submit">Apply date range</Button>
          <Button type="button" variant="outline" onClick={refresh}>
            Refresh analytics
          </Button>
        </form>
        {error ? (
          <div role="alert" className="rounded-xl border bg-white p-5">
            <p>{error}</p>
            <Button className="mt-3" variant="outline" onClick={refresh}>
              Retry analytics
            </Button>
          </div>
        ) : !data ? (
          <AnalyticsSkeleton />
        ) : (
          <AnalyticsContent data={data} />
        )}
      </div>
    </main>
  );
}
function AnalyticsContent({ data }: { data: MembershipAnalytics }) {
  const kpis = [
    ["Total applications", data.kpis.totalApplications],
    ["Pending", data.kpis.pending],
    ["Approved", data.kpis.approved],
    ["Rejected", data.kpis.rejected],
    ["Approval rate", `${data.kpis.approvalRate}%`],
  ];
  const noData =
    data.kpis.totalApplications === 0 &&
    data.monthly.every((month) => month.approvedMembers === 0);
  return (
    <>
      <p className="text-sm text-slate-600">
        {data.range.from} to {data.range.to}, inclusive UTC. KPIs use submission
        dates and current status; approval rate is approved / total
        applications. Charts of members use approval dates.
      </p>
      <section
        aria-label="Membership KPIs"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {kpis.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>
                <h2 className="text-sm text-slate-600">{label}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-800">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Application trend</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            {data.trend.change >= 0 ? "+" : ""}
            {data.trend.change} applications versus the preceding equal-length
            period.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {data.trend.changePercent === null
              ? "No previous applications for a percentage comparison."
              : `${data.trend.changePercent}% change`}{" "}
            Previous period: {data.trend.previousApplications} applications.
          </p>
        </CardContent>
      </Card>
      {noData ? (
        <div
          role="status"
          className="rounded-xl border bg-white p-8 text-center"
        >
          <h2 className="text-xl font-semibold">
            No membership activity in this range
          </h2>
          <p className="mt-2 text-slate-600">
            Choose another date range after applications or approvals are
            recorded.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>
                <h2>Monthly membership growth</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                aria-label="Monthly membership growth chart"
                role="img"
                className="min-w-0"
              >
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <LineChart data={data.monthly} accessibilityLayer>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={35} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="applications"
                      name="Applications"
                      stroke="#1d4ed8"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="approvedMembers"
                      name="New approved members"
                      stroke="#0f766e"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>
                <h2>Department membership distribution</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.departments.length === 0 ? (
                <p>No approved members in this date range.</p>
              ) : (
                <div
                  role="img"
                  aria-label="Department membership distribution chart"
                  className="min-w-0"
                >
                  <ResponsiveContainer width="100%" height={300} minWidth={0}>
                    <BarChart data={data.departments} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} width={35} />
                      <Tooltip />
                      <Bar
                        dataKey="members"
                        name="New approved members"
                        fill="#0f766e"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <details className="rounded-xl border bg-white p-5">
        <summary className="cursor-pointer font-medium">
          View chart data
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left">Monthly activity (UTC)</caption>
            <thead>
              <tr>
                <th className="p-2">Month</th>
                <th className="p-2">Applications</th>
                <th className="p-2">New approved members</th>
              </tr>
            </thead>
            <tbody>
              {data.monthly.map((month) => (
                <tr key={month.month} className="border-t">
                  <td className="p-2">{month.month}</td>
                  <td className="p-2">{month.applications}</td>
                  <td className="p-2">{month.approvedMembers}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="mt-5 w-full text-left text-sm">
            <caption className="mb-3 text-left">
              Approved members by department
            </caption>
            <thead>
              <tr>
                <th className="p-2">Department</th>
                <th className="p-2">Members</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.map((item) => (
                <tr key={item.department} className="border-t">
                  <td className="p-2">{item.department}</td>
                  <td className="p-2">{item.members}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Recent applications</h2>
          </CardTitle>
          <p className="text-sm text-slate-600">
            Anonymous activity summaries; no student details are included.
          </p>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p>No recent applications in this range.</p>
          ) : (
            <ul className="divide-y">
              {data.recent.map((item, index) => (
                <li
                  key={index}
                  className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                >
                  <span className="capitalize">{item.status}</span>
                  <time dateTime={item.submittedAt}>
                    {new Date(item.submittedAt).toLocaleString("en-GB", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
