"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT } from "@/components/i18n/language";
import { getPerformance, type Performance } from "@/lib/performance-api";
import { AssessmentError } from "@/lib/assessment-api";

export function DashboardProgress({ student }: { student: boolean }) {
  const t = useT();
  const [data, setData] = useState<Performance | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getPerformance(student, new URLSearchParams(), controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof AssessmentError && cause.status === 403
              ? "An approved student membership is required"
              : "Unable to load performance. Please retry.",
          );
      });
    return () => controller.abort();
  }, [student, retry]);
  return (
    <section
      className="dashboard-progress"
      aria-label={t("Student performance")}
    >
      <div className="dashboard-progress-heading">
        <h2>
          {t(
            student
              ? "My performance analytics"
              : "Student performance analytics",
          )}
        </h2>
        <Link
          href={
            student
              ? "/dashboard/student/performance"
              : "/dashboard/teacher/analytics"
          }
        >
          {t("View report")}
        </Link>
      </div>
      {error ? (
        <div className="dashboard-chart-state" role="status">
          <p>{t(error)}</p>
          <button
            className="text-blue-700 underline"
            onClick={() => {
              setError("");
              setData(null);
              setRetry(retry + 1);
            }}
          >
            {t("Retry")}
          </button>
        </div>
      ) : !data ? (
        <div className="dashboard-chart-state" role="status">
          {t("Loading analytics")}
        </div>
      ) : (
        <>
          <div className="dashboard-stat-grid">
            <div>
              <span>{t("Completed attempts")}</span>
              <strong>{data.completed}</strong>
            </div>
            <div>
              <span>{t("Average percentage")}</span>
              <strong>{data.averagePercentage.toFixed(1)}%</strong>
            </div>
            <div>
              <span>{t("Best percentage")}</span>
              <strong>{data.bestPercentage.toFixed(1)}%</strong>
            </div>
          </div>
          {data.completed === 0 ? (
            <div className="dashboard-chart-state">
              {t("No released results in this range.")}
            </div>
          ) : (
            <div className="dashboard-chart-grid">
              <div className="dashboard-chart">
                <h3>{t("Monthly progress")}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={data.timeline}
                    margin={{ left: -20, right: 10, top: 15 }}
                  >
                    <defs>
                      <linearGradient
                        id={`progress-${student ? "student" : "staff"}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#009cf4"
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="100%"
                          stopColor="#009cf4"
                          stopOpacity={0.03}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area
                      dataKey="averagePercentage"
                      name={t("Average percentage")}
                      stroke="#009cf4"
                      strokeWidth={3}
                      fill={`url(#progress-${student ? "student" : "staff"})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="dashboard-chart">
                <h3>{t("Completed attempts")}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.timeline}
                    margin={{ left: -20, right: 10, top: 15 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar
                      dataKey="completed"
                      name={t("Completed attempts")}
                      fill="#7560df"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <details className="dashboard-chart-table">
            <summary>{t("View data table")}</summary>
            <div className="overflow-x-auto">
              <table>
                <caption>{t("Monthly progress")}</caption>
                <thead>
                  <tr>
                    <th>{t("Month")}</th>
                    <th>{t("Completed attempts")}</th>
                    <th>{t("Average percentage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.timeline.map((row) => (
                    <tr key={row.month}>
                      <th scope="row">{row.month}</th>
                      <td>{row.completed}</td>
                      <td>{row.averagePercentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
